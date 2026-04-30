import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { uploadPhoto } from '../lib/upload';
import { useNavigate } from 'react-router-dom';
import { Loader, Phone, FileText, User, Camera, Calendar, Clock, MapPin, Megaphone, Mail } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  medical_conditions: string;
  status: string;
  photo_url?: string;
  age_group?: string;
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
  priority: string;
  is_pinned: boolean;
  created_at: string;
}

interface CoachProfile {
  first_name: string;
  last_name: string;
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
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('first_name, last_name, photo_url').eq('id', user.id).single();
      if (data) setProfile(data);
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
        .order('last_name', { ascending: true });

      let rosterRows = data as PlayerRow[] | null;

      if (error) {
        console.warn('Roster parent join failed, retrying basic roster query:', error);
        const { data: basicPlayers, error: basicPlayersError } = await supabase
          .from('players')
          .select('*')
          .eq('team_assigned', teamId)
          .order('last_name', { ascending: true });

        if (basicPlayersError) throw basicPlayersError;
        rosterRows = basicPlayers as PlayerRow[] | null;
      }

      if (rosterRows) {
        // Map data safely
        const formattedData = rosterRows.map((p) => ({
          ...p,
          dob: p.date_of_birth || '',
          profiles: p.profiles || { first_name: 'N/A', last_name: '', phone: 'N/A', email: '' }
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

    const { error } = await supabase.from('announcements').insert([{
      ...newAnnouncement,
      audience: 'team',
      team_id: teamId,
      is_pinned: false,
    }]);

    if (!error) {
      setNewAnnouncement({ title: '', body: '', priority: 'normal' });
      fetchTeamData();
    } else {
      alert(error.message);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const ageDifMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

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
                    alt={`${profile.first_name} ${profile.last_name}`} 
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
                <p className="text-xl font-bold text-white">{profile.first_name} {profile.last_name}</p>
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
              <button type="submit" className="btn-primary w-full">Post Team Message</button>
            </div>
          </form>

          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <h2 className="mb-4 text-lg font-black uppercase italic text-white">Team Announcements</h2>
            {teamAnnouncements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-black p-6 text-center text-sm text-gray-500">
                No team messages yet.
              </div>
            ) : (
              <div className="space-y-3">
                {teamAnnouncements.map((announcement) => (
                  <article key={announcement.id} className={`rounded-xl border p-4 ${announcement.priority === 'important' ? 'border-[#EF4444]/70 bg-[#EF4444]/10' : 'border-gray-800 bg-black'}`}>
                    <h3 className="font-black uppercase italic text-white">{announcement.title}</h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-400">{announcement.body}</p>
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
      
      {teamId && players.length === 0 ? (
        <div className="bg-black p-6 rounded-xl shadow-sm text-center text-gray-500">
          No players assigned to {teamId} yet.
        </div>
      ) : teamId ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <div key={player.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{player.first_name} {player.last_name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 font-medium">{calculateAge(player.dob)} Years Old</span>
                    {player.age_group && (
                      <span className="px-2 py-0.5 text-xs font-bold text-blue-700 bg-blue-100 rounded-full border border-blue-200">
                        {player.age_group}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {player.photo_url ? (
                    <img 
                      src={player.photo_url} 
                      alt={`${player.first_name} ${player.last_name}`}
                      className="h-12 w-12 rounded-full object-cover border-2 border-gray-200"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                      <User className="text-gray-400 h-6 w-6" />
                    </div>
                  )}
                  <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-full ${
                    player.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                  }`}>
                    {player.status === 'active' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <Phone className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-300 uppercase">Emergency Contact</p>
                    <p className="font-medium text-gray-900">{player.profiles.first_name} {player.profiles.last_name}</p>
                    <div className="flex flex-wrap gap-3">
                      <a href={`tel:${player.profiles.phone}`} className="text-red-600 font-bold hover:underline">
                        {player.profiles.phone}
                      </a>
                      {player.profiles.email && (
                        <a href={`mailto:${player.profiles.email}`} className="inline-flex items-center gap-1 text-red-600 font-bold hover:underline">
                          <Mail size={14} />
                          Email
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {player.medical_conditions && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-900 rounded-lg">
                    <FileText className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-yellow-800 uppercase">Medical Notes</p>
                      <p className="text-sm text-gray-800">{player.medical_conditions}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* UPCOMING GAMES SECTION */}
      <div>
        <h2 className="text-2xl font-black uppercase italic text-white mb-4">Upcoming Games</h2>
        {games.length === 0 ? (
          <div className="bg-white p-6 rounded-xl shadow-sm text-center text-gray-500 border border-gray-200">
            No upcoming games scheduled.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <div key={game.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span className="text-red-600">VS</span> {game.opponent}
                  </h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="font-medium">{new Date(game.date).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock size={16} className="text-gray-400" />
                      <span className="font-medium">{game.time}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin size={16} className="text-gray-400" />
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
