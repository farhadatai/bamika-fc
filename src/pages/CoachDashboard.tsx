import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { uploadPhoto } from '../lib/upload';
import { useNavigate } from 'react-router-dom';
import { Loader, Phone, FileText, User, Camera, Upload, Calendar, Clock, MapPin } from 'lucide-react';

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
    full_name: string;
    phone: string;
  };
}

interface Game {
  id: string;
  date: string;
  time: string;
  opponent: string;
  location: string;
}

export default function CoachDashboard() {
  const { user, userRole } = useAuthStore();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Check if we have a user
    if (!user) return;

    // 2. If role is loaded and NOT coach, redirect
    if (userRole && userRole !== 'coach') {
      navigate('/dashboard');
      return;
    }

    // 3. If role IS coach, fetch data
    if (userRole === 'coach') {
      fetchPlayers();
      fetchProfile();
      fetchGames();
    }
  }, [user, userRole, navigate]);

  const fetchProfile = async () => {
    try {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
    } catch (e) {
      console.error("Profile fetch error", e);
    }
  };

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

  const fetchGames = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true });

      if (data) setGames(data);
    } catch (e) {
      console.error("Games fetch error", e);
    }
  };

  const fetchPlayers = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user) return;

      // SIMPLIFIED & BULLETPROOF QUERY
      const { data, error } = await supabase
        .from('registrations')
        .select('*, profiles:parent_id(*)') // Simple select with join
        .eq('coach_id', user.id) // Explicit filter
        .order('first_name', { ascending: true });

      if (error) throw error;

      if (data) {
        // Map data safely
        const formattedData = data.map((p: any) => {
          const profileData = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
          return {
            ...p,
            profiles: profileData || { full_name: 'N/A', phone: 'N/A' }
          };
        });
        setPlayers(formattedData);
      }
    } catch (err: any) {
      console.error('Error fetching roster:', err);
      setError('Failed to load roster.');
    } finally {
      // CRITICAL: Always stop loading
      setLoading(false);
    }
  };

  const calculateAge = (dob: string) => {
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
        <div className="text-red-600 font-bold text-xl">{error}</div>
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
        {profile && (
          <button 
            onClick={() => setShowEditProfile(!showEditProfile)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-bold shadow-sm"
          >
            <User size={18} />
            My Profile
          </button>
        )}
      </div>

      {/* MY PROFILE SECTION */}
      {showEditProfile && profile && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-bold text-gray-900 mb-6">My Profile</h2>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                {profile.photo_url ? (
                  <img 
                    src={profile.photo_url} 
                    alt={profile.full_name} 
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
                <div className="flex items-center gap-2 text-primary font-bold hover:text-red-700 transition-colors bg-red-50 px-4 py-2 rounded-full hover:bg-red-100">
                  <Camera size={18} />
                  Change Profile Photo
                </div>
              </label>
            </div>
            
            <div className="flex-1 space-y-4 w-full text-center md:text-left">
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase">Full Name</label>
                <p className="text-xl font-bold text-gray-900">{profile.full_name}</p>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase">Email</label>
                <p className="text-lg text-gray-700">{user?.email}</p>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase">Role</label>
                <span className="inline-block mt-1 px-3 py-1 bg-blue-100 text-blue-800 font-bold rounded-full text-sm">
                  Official Coach
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {players.length === 0 ? (
        <div className="bg-white p-6 rounded-xl shadow-sm text-center text-gray-500">
          No active players found.
        </div>
      ) : (
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
                    player.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {player.status === 'active' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <Phone className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-800 uppercase">Emergency Contact</p>
                    <p className="font-medium text-gray-900">{player.profiles.full_name}</p>
                    <a href={`tel:${player.profiles.phone}`} className="text-red-600 font-bold hover:underline">
                      {player.profiles.phone}
                    </a>
                  </div>
                </div>

                {player.medical_conditions && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                    <FileText className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
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
      )}

      {/* UPCOMING GAMES SECTION */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Games</h2>
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
