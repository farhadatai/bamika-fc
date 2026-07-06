import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { uploadPhoto } from '../lib/upload';
import { useNavigate } from 'react-router-dom';
import { Loader, Phone, User, Camera, Calendar, Clock, MapPin, Megaphone, Mail, Trash2, X, CreditCard, Target, Plus } from 'lucide-react';

interface Player {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  dob: string;
  medical_conditions: string;
  status: string;
  photo_url?: string;
  age_group?: string;
  position?: string;
  jersey_number?: string;
  jersey_size?: string;
  team_assigned?: string;
  payment_status?: string;
  profiles: {
    first_name: string;
    last_name: string;
    phone: string;
    email?: string;
  };
}

interface PlayerRow extends Omit<Player, 'dob' | 'profiles'> {
  date_of_birth?: string;
  profiles?: Player['profiles'];
}

interface ClubPlayerSummary {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  status: string;
  payment_status: string;
  team_assigned: string;
  created_at?: string | null;
  parent_name: string;
}

const getPlayerName = (player: Pick<Player, 'first_name' | 'last_name' | 'full_name'>) => (
  `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name || 'Bamika Player'
);

const POSITION_OPTIONS = ['TBD', 'Forward', 'Midfielder', 'Defender', 'Goalkeeper'];
const JERSEY_SIZE_OPTIONS = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'S', 'M', 'L', 'XL', '2XL'];
const COACH_MESSAGE_PREFIX = '__BAMIKA_COACH__:';

const getCoachDisplayName = (profile?: CoachProfile | null, fallbackEmail?: string) => (
  `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
  || profile?.full_name
  || fallbackEmail?.split('@')[0]
  || 'Coach'
);

const parseCoachMessage = (body = '') => {
  if (!body.startsWith(COACH_MESSAGE_PREFIX)) {
    return { coachName: 'Coach', body };
  }

  const [firstLine = '', ...rest] = body.split('\n');
  return {
    coachName: firstLine.replace(COACH_MESSAGE_PREFIX, '').trim() || 'Coach',
    body: rest.join('\n').trim(),
  };
};

const getParentName = (profiles?: Player['profiles']) => (
  `${profiles?.first_name || ''} ${profiles?.last_name || ''}`.trim()
);

const getRosterStatusClass = (status = '') => {
  const normalized = status.toLowerCase();
  if (normalized === 'active' || normalized === 'paid' || normalized === 'waived') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (normalized === 'pending' || normalized === 'pending_payment') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200';
  return 'border-gray-700 bg-gray-500/10 text-gray-300';
};

interface Game {
  id: string;
  date: string;
  time: string;
  opponent: string;
  location: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience?: string;
  player_id?: string | null;
  priority: string;
  is_pinned: boolean;
  created_at: string;
}

interface CoachProfile {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  photo_url?: string;
}

const emptyCoachPlayerInvite = {
  player_first_name: '',
  player_last_name: '',
  date_of_birth: '',
  position: 'TBD',
  jersey_size: 'YM',
  parent_first_name: '',
  parent_last_name: '',
  parent_email: '',
  parent_phone: '',
};

const getClubRegistrationStatus = (player: ClubPlayerSummary): 'active' | 'inactive' | 'pending' => {
  const status = String(player.status || '').toLowerCase();
  const paymentStatus = String(player.payment_status || '').toLowerCase();
  if (['inactive', 'cancelled', 'canceled', 'paused'].includes(status)) return 'inactive';
  if (status === 'active' || ['paid', 'active', 'waived'].includes(paymentStatus)) return 'active';
  return 'pending';
};

export default function CoachDashboard() {
  const { user, userRole } = useAuthStore();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [clubPlayers, setClubPlayers] = useState<ClubPlayerSummary[]>([]);
  const [clubSearch, setClubSearch] = useState('');
  const [clubStatusFilter, setClubStatusFilter] = useState('all');
  const [directoryError, setDirectoryError] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamAnnouncements, setTeamAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', body: '', priority: 'normal' });
  const [messageTarget, setMessageTarget] = useState('team');
  const [selectedMessagePlayerId, setSelectedMessagePlayerId] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerInvite, setNewPlayerInvite] = useState(emptyCoachPlayerInvite);
  const [submittingInvite, setSubmittingInvite] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      if (!user) return;
      const { data, error } = await supabase.from('profiles').select('first_name, last_name, full_name, photo_url').eq('id', user.id).single();
      if (data) {
        setProfile(data);
        return;
      }

      if (error) {
        const { data: legacyProfile } = await supabase.from('profiles').select('full_name, photo_url').eq('id', user.id).single();
        if (legacyProfile) setProfile(legacyProfile);
      }
    } catch (e) {
      console.error("Profile fetch error", e);
    }
  }, [user]);

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    
    setUploadingPhoto(true);
    const publicUrl = await uploadPhoto(e.target.files[0], 'coaches');
    
    if (publicUrl) {
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', user.id);
        
      if (!error) {
        setProfile({ ...profile, photo_url: publicUrl });
      } else {
        alert('Failed to update profile');
      }
    }
    setUploadingPhoto(false);
  };

  const fetchGames = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('games')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true });

      if (data) setGames(data);
    } catch (e) {
      console.error("Games fetch error", e);
    }
  }, []);

  const fetchTeamData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user) return;

      setDirectoryError('');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setClubPlayers([]);
        setDirectoryError('Please log in again to view club registrations.');
      } else {
        const directoryResponse = await fetch('/api/auth/coach-player-directory', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const directoryResult = await directoryResponse.json().catch(() => ({}));

        if (directoryResponse.ok) {
          setClubPlayers(Array.isArray(directoryResult.players) ? directoryResult.players : []);
        } else {
          setClubPlayers([]);
          setDirectoryError(directoryResult.error || 'Club registrations could not be loaded.');
        }
      }

      // 1. Get the coach's team_id
      const { data: coachData, error: coachError } = await supabase
        .from('coaches')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (coachError || !coachData) {
        console.warn('Coach team lookup did not return a team yet:', coachError);
        setTeamId(null);
        setPlayers([]);
        setTeamAnnouncements([]);
        setLoading(false);
        return;
      }

      const teamId = coachData.team_id;
      setTeamId(teamId || null);

      if (!teamId) {
        setPlayers([]);
        setTeamAnnouncements([]);
        setLoading(false);
        return;
      }

      // 2. Fetch players assigned to that team_id
      const { data, error } = await supabase
        .from('players')
        .select('*, profiles:parent_id(first_name, last_name, phone, email)')
        .eq('team_assigned', teamId)
        .order('full_name', { ascending: true });

      let rosterRows = data as PlayerRow[] | null;

      if (error) {
        console.warn('Roster parent join failed, retrying basic roster query:', error);
        const { data: basicPlayers, error: basicPlayersError } = await supabase
          .from('players')
          .select('*')
          .eq('team_assigned', teamId)
          .order('full_name', { ascending: true });

        if (basicPlayersError) throw basicPlayersError;
        rosterRows = basicPlayers as PlayerRow[] | null;
      }

      if (rosterRows) {
        // Map data safely
        const formattedData = rosterRows.map((p) => ({
          ...p,
          dob: p.date_of_birth || '',
          profiles: p.profiles || { first_name: '', last_name: '', phone: '', email: '' }
        }));
        setPlayers(formattedData);
      }

      const { data: announcements, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .eq('team_id', teamId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (announcementsError) {
        console.warn('Team announcements unavailable:', announcementsError);
        setTeamAnnouncements([]);
      } else {
        setTeamAnnouncements(announcements || []);
      }
    } catch (err) {
      console.error('Error fetching roster:', err);
      setError('Failed to load roster.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (userRole && userRole !== 'coach') {
      navigate('/dashboard');
      return;
    }

    if (userRole === 'coach') {
      fetchTeamData();
      fetchProfile();
      fetchGames();
    }
  }, [user, userRole, navigate, fetchTeamData, fetchProfile, fetchGames]);

  const handlePostTeamAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;
    const selectedPlayerForMessage = players.find((player) => player.id === selectedMessagePlayerId);

    if (messageTarget === 'player' && !selectedPlayerForMessage) {
      alert('Choose a player for the individual message.');
      return;
    }

    const coachName = getCoachDisplayName(profile, user?.email);
    const { error } = await supabase.from('announcements').insert([{
      ...newAnnouncement,
      body: `${COACH_MESSAGE_PREFIX}${coachName}\n\n${newAnnouncement.body}`,
      audience: messageTarget === 'player' ? 'player' : 'team',
      team_id: teamId,
      player_id: messageTarget === 'player' ? selectedPlayerForMessage?.id : null,
      is_pinned: false,
    }]);

    if (!error) {
      setNewAnnouncement({ title: '', body: '', priority: 'normal' });
      if (messageTarget === 'player') setSelectedMessagePlayerId('');
      fetchTeamData();
    } else {
      alert(error.message);
    }
  };

  const handleDeleteTeamAnnouncement = async (announcementId: string) => {
    if (!window.confirm('Delete this team message?')) return;

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId)
      .eq('team_id', teamId);

    if (error) {
      alert(error.message);
      return;
    }

    setTeamAnnouncements((currentAnnouncements) => currentAnnouncements.filter((announcement) => announcement.id !== announcementId));
  };

  const handleUpdatePlayer = async (playerId: string, updates: Partial<Pick<Player, 'position' | 'jersey_number' | 'jersey_size'>>) => {
    const { error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', playerId);

    if (error) {
      alert(error.message);
      return;
    }

    setPlayers((currentPlayers) => currentPlayers.map((player) => (
      player.id === playerId ? { ...player, ...updates } : player
    )));
  };

  const handleCoachAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingInvite(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        alert('Please log in as a coach again before adding a player.');
        return;
      }

      const response = await fetch('/api/auth/invite-parent-player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newPlayerInvite),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(result.error || 'Unable to add player and invite parent.');
        return;
      }

      setNewPlayerInvite(emptyCoachPlayerInvite);
      setShowAddPlayer(false);
      await fetchTeamData();
      alert(result.message || 'Player added and parent invite sent.');
    } finally {
      setSubmittingInvite(false);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const ageDifMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const selectedPlayerMessages = selectedPlayer
    ? teamAnnouncements.filter((announcement) => announcement.audience === 'player' && announcement.player_id === selectedPlayer.id)
    : [];
  const clubRegistrationStats = clubPlayers.reduce((stats, player) => {
    stats.total += 1;
    stats[getClubRegistrationStatus(player)] += 1;
    return stats;
  }, { total: 0, active: 0, inactive: 0, pending: 0 });
  const filteredClubPlayers = clubPlayers.filter((player) => {
    const status = getClubRegistrationStatus(player);
    const searchTarget = [
      getPlayerName(player),
      player.parent_name,
      player.team_assigned,
      status,
      player.payment_status,
    ].filter(Boolean).join(' ').toLowerCase();
    return (clubStatusFilter === 'all' || status === clubStatusFilter)
      && (!clubSearch.trim() || searchTarget.includes(clubSearch.trim().toLowerCase()));
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen flex-col gap-4">
        <div className="text-[#EF4444] font-bold text-xl">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-primary text-white px-4 py-2 rounded font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-neutral-950 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase italic text-white sm:text-3xl">Coach Dashboard</h1>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-gray-500">
            {teamId ? teamId : 'No team assigned yet'}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => navigate('/register-new-athlete')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-4 py-3 text-sm font-black uppercase text-white hover:bg-red-700 sm:py-2"
          >
            <Plus size={17} /> Register My Child
          </button>
          {profile && (
            <button
              onClick={() => setShowEditProfile(!showEditProfile)}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-black px-4 py-3 text-sm font-bold text-gray-300 shadow-sm hover:bg-gray-900 sm:py-2"
            >
              <User size={18} />
              My Profile
            </button>
          )}
        </div>
      </div>

      {/* MY PROFILE SECTION */}
      {showEditProfile && profile && (
        <div className="bg-black p-6 rounded-xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-black uppercase italic text-white mb-6">My Profile</h2>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                {profile.photo_url ? (
                  <img 
                    src={profile.photo_url} 
                    alt={getCoachDisplayName(profile, user?.email)}
                    className="h-32 w-32 rounded-full object-cover border-4 border-gray-100 shadow-md"
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-200">
                    <User className="h-16 w-16 text-gray-400" />
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <Loader className="h-8 w-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleProfilePhotoUpload} 
                  className="hidden"
                  disabled={uploadingPhoto}
                />
                <div className="flex items-center gap-2 text-primary font-bold hover:text-red-700 transition-colors bg-red-900 px-4 py-2 rounded-full hover:bg-red-100">
                  <Camera size={18} />
                  Change Profile Photo
                </div>
              </label>
            </div>
            
            <div className="flex-1 space-y-4 w-full text-center md:text-left">
              <div>
                <label className="text-sm font-bold text-gray-400 uppercase">Full Name</label>
                <p className="text-xl font-bold text-white">{getCoachDisplayName(profile, user?.email)}</p>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase">Email</label>
                <p className="text-lg text-gray-300">{user?.email}</p>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase">Role</label>
                <span className="inline-block mt-1 px-3 py-1 bg-blue-900 text-blue-300 font-bold rounded-full text-sm">
                  Official Coach
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-blue-500/30 bg-neutral-950 p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-blue-300">Limited coach access</div>
            <h2 className="mt-2 text-xl font-black uppercase italic text-white">Club Registration Overview</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
              View every registered player, their parent name, team, and active status. Addresses, medical details, documents, and other private information stay hidden.
            </p>
          </div>
          <button type="button" onClick={() => navigate('/register-new-athlete')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-400/50 px-4 py-3 text-xs font-black uppercase text-blue-100 hover:bg-blue-500/10">
            <Plus size={15} /> Register My Child
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Registered', value: clubRegistrationStats.total, color: 'text-white' },
            { label: 'Active', value: clubRegistrationStats.active, color: 'text-green-300' },
            { label: 'Pending', value: clubRegistrationStats.pending, color: 'text-yellow-200' },
            { label: 'Inactive', value: clubRegistrationStats.inactive, color: 'text-gray-300' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-800 bg-black p-4">
              <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">{stat.label}</div>
              <div className={`mt-2 text-2xl font-black ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
          <input aria-label="Search club registrations" value={clubSearch} onChange={(event) => setClubSearch(event.target.value)} placeholder="Search player, parent, or team" className="input-primary" />
          <select aria-label="Filter club registrations by status" value={clubStatusFilter} onChange={(event) => setClubStatusFilter(event.target.value)} className="input-primary">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {directoryError ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">{directoryError}</div>
        ) : filteredClubPlayers.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-800 bg-black p-6 text-center text-sm text-gray-500">No registrations match this filter.</div>
        ) : (
          <>
            <div className="mt-4 space-y-3 lg:hidden">
              {filteredClubPlayers.map((player) => {
                const status = getClubRegistrationStatus(player);
                return (
                  <article key={player.id} className="rounded-xl border border-gray-800 bg-black p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black uppercase italic text-white">{getPlayerName(player)}</h3>
                        <p className="mt-1 text-xs text-gray-500">Parent: {player.parent_name}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${getRosterStatusClass(status)}`}>{status}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-bold text-gray-500">
                      <span>{player.team_assigned}</span>
                      <span>{player.created_at ? new Date(player.created_at).toLocaleDateString() : 'Date unavailable'}</span>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="mt-4 hidden overflow-x-auto rounded-xl border border-gray-800 bg-black lg:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-gray-800 bg-neutral-950 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Parent</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Registered</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {filteredClubPlayers.map((player) => {
                    const status = getClubRegistrationStatus(player);
                    return (
                      <tr key={player.id}>
                        <td className="px-4 py-3 font-black uppercase italic text-white">{getPlayerName(player)}</td>
                        <td className="px-4 py-3 font-bold text-gray-300">{player.parent_name}</td>
                        <td className="px-4 py-3 text-gray-400">{player.team_assigned}</td>
                        <td className="px-4 py-3 text-gray-400">{player.created_at ? new Date(player.created_at).toLocaleDateString() : 'Unavailable'}</td>
                        <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${getRosterStatusClass(status)}`}>{status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {!teamId && (
        <div className="rounded-2xl border border-dashed border-gray-800 bg-black p-8 text-center">
          <h2 className="text-xl font-black uppercase italic text-white">Waiting for team assignment</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
            An admin needs to assign you to a team. After that, your players and team communication tools will appear here.
          </p>
        </div>
      )}

      {teamId && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Team</div>
            <div className="mt-2 text-2xl font-black uppercase italic text-white">{teamId}</div>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Players</div>
            <div className="mt-2 text-2xl font-black text-white">{players.length}</div>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Upcoming Games</div>
            <div className="mt-2 text-2xl font-black text-white">{games.length}</div>
          </div>
        </div>
      )}

      {teamId && (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handlePostTeamAnnouncement} className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Megaphone className="text-[#EF4444]" size={20} />
              <h2 className="text-lg font-black uppercase italic text-white">Message Team</h2>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={messageTarget}
                  className="input-primary"
                  onChange={(e) => {
                    setMessageTarget(e.target.value);
                    if (e.target.value === 'team') setSelectedMessagePlayerId('');
                  }}
                >
                  <option value="team">Whole team</option>
                  <option value="player">Individual player</option>
                </select>
                {messageTarget === 'player' && (
                  <select
                    required
                    value={selectedMessagePlayerId}
                    className="input-primary"
                    onChange={(e) => setSelectedMessagePlayerId(e.target.value)}
                  >
                    <option value="">Choose player</option>
                    {players.map((player) => (
                      <option key={player.id} value={player.id}>{getPlayerName(player)}</option>
                    ))}
                  </select>
                )}
              </div>
              <input
                required
                value={newAnnouncement.title}
                placeholder="Message title"
                className="input-primary"
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
              />
              <textarea
                required
                rows={4}
                value={newAnnouncement.body}
                placeholder="Write practice notes, reminders, or parent updates..."
                className="input-primary resize-none"
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })}
              />
              <select
                value={newAnnouncement.priority}
                className="input-primary"
                onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
              </select>
              <button type="submit" className="btn-primary w-full">
                {messageTarget === 'player' ? 'Send Player Message' : 'Post Team Message'}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <h2 className="mb-4 text-lg font-black uppercase italic text-white">Team Announcements</h2>
            {teamAnnouncements.filter((announcement) => announcement.audience !== 'player').length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-black p-6 text-center text-sm text-gray-500">
                No team messages yet.
              </div>
            ) : (
              <div className="space-y-3">
                {teamAnnouncements.filter((announcement) => announcement.audience !== 'player').map((announcement) => (
                  <article key={announcement.id} className={`rounded-xl border p-4 ${announcement.priority === 'important' ? 'border-[#EF4444]/70 bg-[#EF4444]/10' : 'border-gray-800 bg-black'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black uppercase italic text-white">{announcement.title}</h3>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-600">
                          Posted by {parseCoachMessage(announcement.body).coachName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTeamAnnouncement(announcement.id)}
                        className="rounded-lg border border-gray-800 p-2 text-gray-500 transition-colors hover:border-[#EF4444] hover:text-[#EF4444]"
                        aria-label="Delete team message"
                        title="Delete team message"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-400">{parseCoachMessage(announcement.body).body}</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-gray-600">
                      {new Date(announcement.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {teamId && (
        <section className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black uppercase italic text-white">Team Roster</h2>
              <p className="text-sm text-gray-500">Click a player name to open the full player card. Coaches can update jersey details and message families from here.</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{players.length} players</div>
              <button
                type="button"
                onClick={() => setShowAddPlayer(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-4 py-3 text-xs font-black uppercase text-white hover:bg-red-700 sm:py-2"
              >
                <Plus size={15} />
                Add Player
              </button>
            </div>
          </div>

          {players.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-800 bg-black p-6 text-center text-gray-500">
              No players assigned to {teamId} yet.
            </div>
          ) : (
            <>
            <div className="space-y-3 lg:hidden">
              {players.map((player) => (
                <article key={player.id} className="rounded-xl border border-gray-800 bg-black p-4">
                  <button type="button" onClick={() => setSelectedPlayer(player)} className="flex w-full items-center gap-3 text-left">
                    {player.photo_url ? (
                      <img src={player.photo_url} alt={getPlayerName(player)} className="h-14 w-14 rounded-xl border border-gray-800 object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-gray-800 bg-neutral-900">
                        <User className="h-6 w-6 text-gray-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-black uppercase italic text-white">{getPlayerName(player)}</h3>
                      <p className="text-xs font-bold uppercase text-gray-500">{calculateAge(player.dob)} years old - {player.age_group || teamId}</p>
                    </div>
                  </button>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getRosterStatusClass(player.status)}`}>{player.status || 'Pending'}</span>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getRosterStatusClass(player.payment_status || player.status)}`}>{player.payment_status || player.status || 'Pending'}</span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Position</span>
                      <select value={player.position || 'TBD'} onChange={(e) => handleUpdatePlayer(player.id, { position: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-800 bg-neutral-950 px-2 py-2 text-xs font-bold text-gray-300 outline-none focus:border-[#EF4444]">
                        {POSITION_OPTIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Number</span>
                      <input
                        value={player.jersey_number || ''}
                        placeholder="-"
                        onChange={(e) => {
                          const jerseyNumber = e.target.value;
                          setPlayers((currentPlayers) => currentPlayers.map((currentPlayer) => currentPlayer.id === player.id ? { ...currentPlayer, jersey_number: jerseyNumber } : currentPlayer));
                        }}
                        onBlur={(e) => handleUpdatePlayer(player.id, { jersey_number: e.target.value || '-' })}
                        className="mt-1 w-full rounded-lg border border-gray-800 bg-neutral-950 px-2 py-2 text-xs font-bold text-gray-300 outline-none focus:border-[#EF4444]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Size</span>
                      <select value={player.jersey_size || 'YM'} onChange={(e) => handleUpdatePlayer(player.id, { jersey_size: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-800 bg-neutral-950 px-2 py-2 text-xs font-bold text-gray-300 outline-none focus:border-[#EF4444]">
                        {JERSEY_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 rounded-lg border border-gray-900 bg-neutral-950 p-3">
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Parent</div>
                    <div className="mt-1 text-sm font-bold text-gray-300">{getParentName(player.profiles) || 'Parent not listed'}</div>
                    <div className="text-xs text-gray-500">{player.profiles.phone || 'No phone listed'}</div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setSelectedPlayer(player)} className="rounded-lg border border-gray-800 px-3 py-3 text-[10px] font-black uppercase text-gray-300 hover:border-[#D4AF37] hover:text-[#D4AF37]">View</button>
                    <button type="button" onClick={() => { setMessageTarget('player'); setSelectedMessagePlayerId(player.id); }} className="rounded-lg border border-gray-800 px-3 py-3 text-[10px] font-black uppercase text-gray-300 hover:border-[#EF4444] hover:text-[#EF4444]">Message</button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-gray-800 bg-black lg:block">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="border-b border-gray-800 bg-neutral-950 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Player</th>
                    <th className="px-4 py-3">Age</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">Number</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Parent</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {players.map((player) => (
                    <tr key={player.id} className="align-middle hover:bg-neutral-950/80">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => setSelectedPlayer(player)} className="flex items-center gap-3 text-left">
                          {player.photo_url ? (
                            <img src={player.photo_url} alt={getPlayerName(player)} className="h-10 w-10 rounded-lg border border-gray-800 object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-800 bg-neutral-900">
                              <User className="h-5 w-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-black uppercase italic text-white hover:text-[#EF4444]">{getPlayerName(player)}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">{player.age_group || teamId}</div>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-300">{calculateAge(player.dob)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getRosterStatusClass(player.status)}`}>{player.status || 'Pending'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getRosterStatusClass(player.payment_status || player.status)}`}>{player.payment_status || player.status || 'Pending'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select value={player.position || 'TBD'} onChange={(e) => handleUpdatePlayer(player.id, { position: e.target.value })} className="w-32 rounded-lg border border-gray-800 bg-neutral-950 px-2 py-2 text-xs font-bold text-gray-300 outline-none focus:border-[#EF4444]">
                          {POSITION_OPTIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={player.jersey_number || ''}
                          placeholder="-"
                          onChange={(e) => {
                            const jerseyNumber = e.target.value;
                            setPlayers((currentPlayers) => currentPlayers.map((currentPlayer) => currentPlayer.id === player.id ? { ...currentPlayer, jersey_number: jerseyNumber } : currentPlayer));
                          }}
                          onBlur={(e) => handleUpdatePlayer(player.id, { jersey_number: e.target.value || '-' })}
                          className="w-20 rounded-lg border border-gray-800 bg-neutral-950 px-2 py-2 text-xs font-bold text-gray-300 outline-none focus:border-[#EF4444]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select value={player.jersey_size || 'YM'} onChange={(e) => handleUpdatePlayer(player.id, { jersey_size: e.target.value })} className="w-24 rounded-lg border border-gray-800 bg-neutral-950 px-2 py-2 text-xs font-bold text-gray-300 outline-none focus:border-[#EF4444]">
                          {JERSEY_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        <div className="font-bold">{getParentName(player.profiles) || 'Parent not listed'}</div>
                        <div className="text-xs text-gray-500">{player.profiles.phone || 'No phone listed'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setSelectedPlayer(player)} className="rounded-lg border border-gray-800 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-[#D4AF37] hover:text-[#D4AF37]">View</button>
                          <button type="button" onClick={() => { setMessageTarget('player'); setSelectedMessagePlayerId(player.id); }} className="rounded-lg border border-gray-800 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-[#EF4444] hover:text-[#EF4444]">Message</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      )}

      {showAddPlayer && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setShowAddPlayer(false)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-800 bg-neutral-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-800 p-5">
              <div>
                <h2 className="text-2xl font-black uppercase italic text-white">Add Player</h2>
                <p className="mt-1 text-sm text-gray-500">Create the player record and send the parent an account setup invite.</p>
              </div>
              <button type="button" onClick={() => setShowAddPlayer(false)} className="rounded-lg border border-gray-800 p-2 text-gray-500 hover:border-[#EF4444] hover:text-[#EF4444]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCoachAddPlayer} className="space-y-5 p-5">
              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <h3 className="mb-4 text-sm font-black uppercase italic text-white">Player Details</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required value={newPlayerInvite.player_first_name} placeholder="Player first name" className="input-primary" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, player_first_name: e.target.value })} />
                  <input required value={newPlayerInvite.player_last_name} placeholder="Player last name" className="input-primary" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, player_last_name: e.target.value })} />
                  <input required type="date" value={newPlayerInvite.date_of_birth} className="input-primary" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, date_of_birth: e.target.value })} />
                  <select value={newPlayerInvite.position} className="input-primary" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, position: e.target.value })}>
                    {POSITION_OPTIONS.map((position) => <option key={position} value={position}>{position}</option>)}
                  </select>
                  <select value={newPlayerInvite.jersey_size} className="input-primary sm:col-span-2" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, jersey_size: e.target.value })}>
                    {JERSEY_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <h3 className="mb-4 text-sm font-black uppercase italic text-white">Parent Contact</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required value={newPlayerInvite.parent_first_name} placeholder="Parent first name" className="input-primary" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, parent_first_name: e.target.value })} />
                  <input required value={newPlayerInvite.parent_last_name} placeholder="Parent last name" className="input-primary" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, parent_last_name: e.target.value })} />
                  <input required type="email" value={newPlayerInvite.parent_email} placeholder="Parent email" className="input-primary" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, parent_email: e.target.value })} />
                  <input value={newPlayerInvite.parent_phone} placeholder="Parent phone" className="input-primary" onChange={(e) => setNewPlayerInvite({ ...newPlayerInvite, parent_phone: e.target.value })} />
                </div>
              </div>

              <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm leading-6 text-yellow-100">
                The parent receives the account setup email. After they create their password, the player appears in their dashboard with payment pending.
              </div>

              <button type="submit" disabled={submittingInvite} className="btn-primary w-full py-4">
                {submittingInvite ? 'Sending Invite...' : 'Add Player & Invite Parent'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setSelectedPlayer(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-800 bg-neutral-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-800 p-5">
              <div className="flex items-center gap-4">
                {selectedPlayer.photo_url ? (
                  <img src={selectedPlayer.photo_url} alt={getPlayerName(selectedPlayer)} className="h-20 w-20 rounded-2xl border border-gray-800 object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-gray-800 bg-black">
                    <User className="text-gray-500" size={32} />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-black uppercase italic text-white">{getPlayerName(selectedPlayer)}</h2>
                  <p className="mt-1 text-sm font-bold uppercase tracking-widest text-gray-500">{calculateAge(selectedPlayer.dob)} years old - {selectedPlayer.age_group || teamId}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedPlayer(null)} className="rounded-lg border border-gray-800 p-2 text-gray-500 hover:border-[#EF4444] hover:text-[#EF4444]">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <Target size={14} />
                  Player Details
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Position</div>
                    <div className="mt-1 font-black text-white">{selectedPlayer.position || 'TBD'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Number</div>
                    <div className="mt-1 font-black text-white">{selectedPlayer.jersey_number || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Size</div>
                    <div className="mt-1 font-black text-white">{selectedPlayer.jersey_size || 'YM'}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <CreditCard size={14} />
                  Status
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getRosterStatusClass(selectedPlayer.status)}`}>{selectedPlayer.status || 'Pending'}</span>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getRosterStatusClass(selectedPlayer.payment_status || selectedPlayer.status)}`}>{selectedPlayer.payment_status || selectedPlayer.status || 'Payment pending'}</span>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <Phone size={14} />
                  Parent Contact
                </div>
                <div className="font-black text-white">{getParentName(selectedPlayer.profiles) || 'Parent not listed'}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm font-bold">
                  {selectedPlayer.profiles.phone && <a href={`tel:${selectedPlayer.profiles.phone}`} className="text-[#EF4444] hover:underline">{selectedPlayer.profiles.phone}</a>}
                  {selectedPlayer.profiles.email && <a href={`mailto:${selectedPlayer.profiles.email}`} className="inline-flex items-center gap-1 text-[#EF4444] hover:underline"><Mail size={14} /> Email</a>}
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <Megaphone size={14} />
                  Individual Messages
                </div>
                {selectedPlayerMessages.length === 0 ? (
                  <p className="text-sm text-gray-500">No individual messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedPlayerMessages.slice(0, 3).map((message) => (
                      <div key={message.id} className="rounded-lg border border-gray-800 bg-neutral-950 p-3">
                        <div className="font-black uppercase italic text-white">{message.title}</div>
                        <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-gray-400">{parseCoachMessage(message.body).body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-gray-800 p-5">
              <button type="button" onClick={() => { setMessageTarget('player'); setSelectedMessagePlayerId(selectedPlayer.id); setSelectedPlayer(null); }} className="rounded-lg bg-[#EF4444] px-4 py-3 text-xs font-black uppercase text-white hover:bg-red-700">
                Message This Player
              </button>
              {selectedPlayer.profiles.phone && (
                <a href={`tel:${selectedPlayer.profiles.phone}`} className="rounded-lg border border-gray-800 px-4 py-3 text-xs font-black uppercase text-gray-300 hover:border-[#D4AF37] hover:text-[#D4AF37]">
                  Call Parent
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPCOMING GAMES SECTION */}
      <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
        <h2 className="text-xl font-black uppercase italic text-white mb-4">Upcoming Games</h2>
        {games.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-800 bg-black p-6 text-center text-gray-500">
            No upcoming games scheduled.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <div key={game.id} className="rounded-xl border border-gray-800 bg-black p-5 transition-colors hover:border-[#EF4444]/70">
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-black uppercase italic text-white flex items-center gap-2">
                    <span className="text-[#EF4444]">VS</span> {game.opponent}
                  </h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar size={16} className="text-[#EF4444]" />
                      <span className="font-medium">{new Date(game.date).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock size={16} className="text-[#EF4444]" />
                      <span className="font-medium">{game.time}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin size={16} className="text-[#EF4444]" />
                      <span>{game.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
