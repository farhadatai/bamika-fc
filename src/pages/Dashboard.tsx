import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { CheckCircle, UserPlus, X, Users, Calendar, Trophy } from 'lucide-react';

interface Registration {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  dob: string;
}

interface Player {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: string;
  team_assigned: string;
  jersey_number: string;
  parent_id: string;
  photo_url?: string;
}

export default function Dashboard() {
  const { user, userRole } = useAuthStore();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleChecking, setRoleChecking] = useState(true);
  const [searchParams] = useSearchParams();
  const showSuccess = searchParams.get('success') === 'true';

  // Modal State
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    fullName: '',
    dob: '',
    gender: 'Male',
    position: 'TBD',
    jerseySize: 'YM',
    medicalConditions: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Immediate Store Check
    if (userRole === 'admin') {
      navigate('/admin');
      return;
    }
    if (userRole === 'coach') {
      navigate('/coach');
      return;
    }
  }, [userRole, navigate]);

  useEffect(() => {
    let mounted = true;

    async function checkRoleAndFetchData() {
      if (!user) return;

      try {
        // If store already has role, skip fetch (handled by effect above)
        // But if store is null (first load), we double check DB
        
        let currentRole = userRole;

        if (!currentRole) {
           const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
            
           currentRole = profile?.role;
        }

        if (!mounted) return;

        // Fallback: Check email if role is missing
        const isAdminEmail = user.email?.toLowerCase().includes('admin');
        
        if (currentRole === 'admin' || isAdminEmail) {
          navigate('/admin');
          return;
        } 
        
        if (currentRole === 'coach') {
          navigate('/coach');
          return;
        }

        // If we are here, we are a parent
        if (mounted) setRoleChecking(false);
        
        // Fetch Registrations
        const { data: regData } = await supabase
          .from('registrations')
          .select('*')
          .eq('parent_id', user.id);

        if (regData && mounted) {
          setRegistrations(regData);
        }

        // Fetch Players (My Athletes)
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('parent_id', user.id);

        if (playersData && mounted) {
          setPlayers(playersData);
        }

      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          setRoleChecking(false);
        }
      }
    }

    checkRoleAndFetchData();

    return () => {
      mounted = false;
    };
  }, [user, navigate]);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Basic validation
    if (!newPlayer.fullName || !newPlayer.dob) {
      alert('Please fill in all required fields (Name and Date of Birth).');
      return;
    }

    setIsSubmitting(true);

    try {
      const safeDob = newPlayer.dob ? new Date(`${newPlayer.dob}T12:00:00`).toISOString() : null;

      const { error } = await supabase
        .from('players')
        .insert({
          parent_id: user.id,
          full_name: newPlayer.fullName,
          date_of_birth: safeDob,
          gender: newPlayer.gender,
          position: newPlayer.position,
          jersey_size: newPlayer.jerseySize,
          medical_conditions: newPlayer.medicalConditions,
          team_assigned: 'Unassigned',
          jersey_number: '-'
        });

      if (error) throw error;

      // Refresh data
      const { data: updatedPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('parent_id', user.id);
        
      if (updatedPlayers) {
        setPlayers(updatedPlayers);
      }

      setNewPlayer({ 
        fullName: '', 
        dob: '', 
        gender: 'Male',
        position: 'TBD',
        jerseySize: 'YM',
        medicalConditions: ''
      });
      setIsAddPlayerModalOpen(false);
      alert('Player registered successfully!');

    } catch (error: any) {
      alert('Error registering player: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (roleChecking || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="flex flex-col items-center gap-2">
          {/* Replaced Icon with Text to prevent crashes */}
          <span className="text-4xl animate-spin">⟳</span>
          <span className="text-lg font-bold text-gray-600">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-lg shadow-sm flex flex-col items-center text-center animate-fade-in">
          <CheckCircle className="h-16 w-16 text-green-600 mb-3" />
          <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
          <p>Welcome to the team! Your player registration is complete.</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Parent Dashboard</h1>
        <Link 
          to="/register/new"
          className="bg-primary text-white px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
        >
          <UserPlus size={20} /> Register New Player
        </Link>
      </div>

      {/* MY ATHLETES SECTION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="text-primary" /> My Athletes
          </h2>
        </div>
        
        {players.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="mb-4">No athletes linked to your account yet.</p>
            <Link 
              to="/register/new"
              className="text-primary font-bold hover:underline"
            >
              Register your first athlete now
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((player) => (
              <div key={player.id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-bl-lg uppercase">
                  {player.team_assigned}
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-xl overflow-hidden border border-gray-200">
                    {player.photo_url ? (
                      <img 
                        src={player.photo_url} 
                        alt={player.full_name} 
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          console.error('Error loading image:', player.photo_url);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      player.full_name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{player.full_name}</h3>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Calendar size={14} /> {player.date_of_birth ? new Date(player.date_of_birth).toLocaleDateString() : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      Jersey: <span className="font-mono text-gray-600">{player.jersey_number}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RECENT REGISTRATIONS (Legacy/History) */}
      {registrations.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 opacity-75">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Registration History</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registrations.map((reg) => (
              <div key={reg.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-sm text-gray-600">{reg.first_name} {reg.last_name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    reg.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {reg.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500">Registered: {new Date(reg.dob).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: REGISTER NEW PLAYER */}
      {isAddPlayerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-bold text-xl text-gray-900">Register New Athlete</h3>
              <button onClick={() => setIsAddPlayerModalOpen(false)} className="text-gray-500 hover:text-black">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddPlayer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. John Doe"
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  value={newPlayer.fullName}
                  onChange={e => setNewPlayer({...newPlayer, fullName: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Date of Birth *</label>
                  <input 
                    type="date" 
                    required
                    className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    value={newPlayer.dob}
                    onChange={e => setNewPlayer({...newPlayer, dob: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Gender *</label>
                  <select
                    className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    value={newPlayer.gender}
                    onChange={e => setNewPlayer({...newPlayer, gender: e.target.value})}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Preferred Position</label>
                  <select
                    className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    value={newPlayer.position}
                    onChange={e => setNewPlayer({...newPlayer, position: e.target.value})}
                  >
                    <option value="TBD">TBD</option>
                    <option value="Forward">Forward</option>
                    <option value="Midfielder">Midfielder</option>
                    <option value="Defender">Defender</option>
                    <option value="Goalkeeper">Goalkeeper</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Jersey Size</label>
                  <select
                    className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    value={newPlayer.jerseySize}
                    onChange={e => setNewPlayer({...newPlayer, jerseySize: e.target.value})}
                  >
                    <option value="YS">Youth Small (YS)</option>
                    <option value="YM">Youth Medium (YM)</option>
                    <option value="YL">Youth Large (YL)</option>
                    <option value="S">Small (S)</option>
                    <option value="M">Medium (M)</option>
                    <option value="L">Large (L)</option>
                    <option value="XL">Extra Large (XL)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Medical Conditions (Optional)</label>
                <textarea
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  rows={2}
                  placeholder="Allergies, asthma, etc."
                  value={newPlayer.medicalConditions}
                  onChange={e => setNewPlayer({...newPlayer, medicalConditions: e.target.value})}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-all shadow-lg transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Registering...' : 'Complete Registration'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
