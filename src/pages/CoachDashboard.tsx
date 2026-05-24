import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { uploadPhoto } from '../lib/upload';
import { useNavigate } from 'react-router-dom';
import { Loader, Phone, FileText, User, Camera, Calendar, Clock, MapPin, Megaphone, Mail, Trash2, X, CreditCard, Shirt, Target } from 'lucide-react';

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

export default function CoachDashboard() {
  const { user, userRole } = useAuthStore();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-neutral-950 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase italic text-white">Coach Dashboard</h1>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-gray-500">
            {teamId ? teamId : 'No team assigned yet'}
          </p>
        </div>
        {profile && (
          <button 
            onClick={() => setShowEditProfile(!showEditProfile)}
            className="flex items-center gap-2 px-4 py-2 bg-black border border-gray-300 rounded-lg hover:bg-gray-900 text-gray-300 font-bold shadow-sm"
          >
            <User size={18} />
            My Profile
          </button>
        )}
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
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{players.length} players</div>
          </div>

          {players.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-800 bg-black p-6 text-center text-gray-500">
              No players assigned to {teamId} yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-800 bg-black">
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
          )}
        </section>
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
