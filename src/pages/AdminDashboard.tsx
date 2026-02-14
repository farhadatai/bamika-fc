import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadPhoto } from '../lib/upload';
import { useNavigate } from 'react-router-dom';
import { X, Pencil, Trash2, Calendar, Clock, MapPin, Users, UserPlus, Shield, Baby, ChevronDown, ChevronUp } from 'lucide-react';

interface RosterPlayer {
  id: string;
  full_name: string;
  position: string;
  team_assigned: string;
  jersey_number?: string;
  photo_url?: string;
  parent_id?: string;
  date_of_birth?: string;
  gender?: string;
  profiles?: {
    full_name: string;
    email: string;
    phone: string;
  };
}

interface Coach {
  id: string;
  email: string;
  full_name: string;
  photo_url?: string;
}

interface Game {
  id: string;
  date: string;
  time: string;
  opponent: string;
  location: string;
  team_group: string;
}

interface User {
  id: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  created_at?: string;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]); // All profiles (Parents)
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'parents' | 'roster' | 'coaches' | 'schedule'>('parents');
  
  // Expanded Parent Rows
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Modals
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isEditPlayerModalOpen, setIsEditPlayerModalOpen] = useState(false);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  
  // Form States
  const [gameLoading, setGameLoading] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [newGame, setNewGame] = useState({
    date: '',
    time: '',
    opponent: '',
    location: '',
    teamGroup: 'All'
  });

  const [editingPlayer, setEditingPlayer] = useState<RosterPlayer | null>(null);
  const [playerForm, setPlayerForm] = useState({
    position: '',
    team_assigned: '',
    jersey_number: ''
  });

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedParentName, setSelectedParentName] = useState<string>('');
  const [newChild, setNewChild] = useState({
    fullName: '',
    dob: '',
    gender: 'Male'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch All Profiles (Users/Parents)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'user')
        .order('created_at', { ascending: false });
      
      if (profilesData) {
        setUsers(profilesData);
      }

      // 2. Fetch Roster Players (Joined with parent profiles)
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*, profiles:parent_id(full_name, email, phone)');
      
      if (playersData) {
        setRosterPlayers(playersData);
      }

      // 3. Fetch Coaches
      const { data: coachesData, error: coachesError } = await supabase
        .from('coaches')
        .select('*, profiles:id(photo_url, email)');
        
      if (coachesData) {
        setCoaches(coachesData.map((c: any) => ({
          ...c,
          photo_url: c.profiles?.photo_url,
          email: c.profiles?.email
        })));
      }

      // 4. Fetch Games
      const { data: gamesData } = await supabase
        .from('games')
        .select('*')
        .order('date', { ascending: true });
        
      if (gamesData) {
        setGames(gamesData);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS: PARENTS TAB ---

  const toggleParentExpansion = (parentId: string) => {
    const newExpanded = new Set(expandedParents);
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId);
    } else {
      newExpanded.add(parentId);
    }
    setExpandedParents(newExpanded);
  };

  const handleOpenAddPlayerModal = (user: User) => {
    setSelectedParentId(user.id);
    setSelectedParentName(user.full_name);
    setNewChild({ fullName: '', dob: '', gender: 'Male' });
    setIsAddPlayerModalOpen(true);
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId) return;

    try {
      const { error } = await supabase
        .from('players')
        .insert({
          parent_id: selectedParentId,
          full_name: newChild.fullName,
          date_of_birth: newChild.dob,
          gender: newChild.gender,
          position: 'TBD',
          team_assigned: 'Unassigned',
          jersey_number: '-'
        });

      if (error) throw error;

      alert(`Successfully added ${newChild.fullName}!`);
      setIsAddPlayerModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Error adding child: ' + err.message);
    }
  };

  // --- ACTIONS: ROSTER TAB ---

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to permanently remove this player from the academy?')) return;

    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId);

      if (error) throw error;

      alert('Player removed successfully.');
      fetchData();
    } catch (error: any) {
      alert('Error removing player: ' + error.message);
    }
  };

  const handleEditPlayerClick = (player: RosterPlayer) => {
    setEditingPlayer(player);
    setPlayerForm({
      position: player.position || '',
      team_assigned: player.team_assigned || '',
      jersey_number: player.jersey_number || ''
    });
    setIsEditPlayerModalOpen(true);
  };

  const handleSavePlayerDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;

    try {
      const { error } = await supabase
        .from('players')
        .update({
          position: playerForm.position,
          team_assigned: playerForm.team_assigned,
          jersey_number: playerForm.jersey_number
        })
        .eq('id', editingPlayer.id);

      if (error) throw error;

      alert('Player details updated!');
      setIsEditPlayerModalOpen(false);
      setEditingPlayer(null);
      fetchData();
    } catch (error: any) {
      alert('Error updating player: ' + error.message);
    }
  };

  // --- ACTIONS: COACHES ---

  const handleMakeCoach = async (user: User) => {
    try {
      // 1. Update Profile Role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'coach' })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Insert into Coaches Table
      const { error: coachError } = await supabase
        .from('coaches')
        .insert({
          id: user.id,
          full_name: user.full_name,
          email: user.email
        });

      if (coachError) {
        await supabase.from('profiles').update({ role: 'user' }).eq('id', user.id);
        throw coachError;
      }

      alert(`${user.full_name} is now a Coach!`);
      fetchData();
    } catch (error: any) {
      alert('Error making coach: ' + error.message);
    }
  };

  const handleRemoveCoach = async (coachId: string) => {
    if (!confirm('Are you sure you want to remove this coach? They will be demoted to a regular user.')) return;

    try {
      // 1. Delete from Coaches Table
      const { error: deleteError } = await supabase
        .from('coaches')
        .delete()
        .eq('id', coachId);

      if (deleteError) throw deleteError;

      // 2. Update Profile Role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'user' })
        .eq('id', coachId);

      if (profileError) throw profileError;

      alert('Coach removed successfully.');
      fetchData();
    } catch (error: any) {
      alert('Error removing coach: ' + error.message);
    }
  };

  // --- ACTIONS: GLOBAL ---

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this user account? This will remove the parent and all linked players.')) return;

    try {
      const { error } = await supabase.rpc('delete_user_account', { target_user_id: userId });

      if (error) throw error;

      alert('User account permanently deleted.');
      fetchData();
    } catch (error: any) {
      alert('Error deleting user: ' + error.message);
    }
  };

  // --- ACTIONS: GAMES ---

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setGameLoading(true);

    try {
      if (editingGame) {
        const { error } = await supabase
          .from('games')
          .update({
            date: newGame.date,
            time: newGame.time,
            opponent: newGame.opponent,
            location: newGame.location,
            team_group: newGame.teamGroup
          })
          .eq('id', editingGame.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('games')
          .insert({
            date: newGame.date,
            time: newGame.time,
            opponent: newGame.opponent,
            location: newGame.location,
            team_group: newGame.teamGroup
          });
        if (error) throw error;
      }
      
      alert(editingGame ? 'Game updated!' : 'Game scheduled!');
      setIsGameModalOpen(false);
      setEditingGame(null);
      setNewGame({ date: '', time: '', opponent: '', location: '', teamGroup: 'All' });
      fetchData();
    } catch (err: any) {
      alert('Error saving game: ' + err.message);
    } finally {
      setGameLoading(false);
    }
  };

  const handleDeleteGame = async (id: string) => {
    if (!confirm('Delete this game?')) return;
    try {
      await supabase.from('games').delete().eq('id', id);
      setGames(games.filter(g => g.id !== id));
    } catch (err) {
      alert('Failed to delete game');
    }
  };

  const handleEditGameClick = (game: Game) => {
    setEditingGame(game);
    setNewGame({
      date: game.date,
      time: game.time,
      opponent: game.opponent,
      location: game.location,
      teamGroup: game.team_group
    });
    setIsGameModalOpen(true);
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // --- RENDER HELPERS ---

  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* TABS */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden mb-6">
        <button
          className={`px-6 py-3 font-bold text-sm ${activeTab === 'parents' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('parents')}
        >
          Parents / Users
        </button>
        <button
          className={`px-6 py-3 font-bold text-sm ${activeTab === 'roster' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('roster')}
        >
          Player Roster (Master)
        </button>
        <button
          className={`px-6 py-3 font-bold text-sm ${activeTab === 'coaches' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('coaches')}
        >
          Coaches
        </button>
        <button
          className={`px-6 py-3 font-bold text-sm ${activeTab === 'schedule' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('schedule')}
        >
          Game Schedule
        </button>
      </div>

      {/* TAB 1: PARENTS */}
      {activeTab === 'parents' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Registered Parents</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Parent Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contact Info</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => {
                  const parentPlayers = rosterPlayers.filter(p => p.parent_id === user.id);
                  const isExpanded = expandedParents.has(user.id);

                  return (
                    <React.Fragment key={user.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 mr-3">
                              {user.full_name.charAt(0)}
                            </div>
                            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>{user.email}</div>
                          <div className="text-xs text-gray-400">{user.phone || 'No Phone'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenAddPlayerModal(user)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700 flex items-center gap-1"
                            >
                              <UserPlus size={14} /> Add Player
                            </button>
                            <button
                              onClick={() => toggleParentExpansion(user.id)}
                              className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold hover:bg-blue-200 flex items-center gap-1"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 
                              Children ({parentPlayers.length})
                            </button>
                            {/* Make Coach Button moved to end or kept if needed */}
                            <button
                              onClick={() => handleMakeCoach(user)}
                              className="text-gray-400 hover:text-blue-600 p-1"
                              title="Promote to Coach"
                            >
                              <Shield size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Delete Account"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Children Row */}
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={3} className="px-6 py-4">
                            <div className="pl-12">
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Linked Players</h4>
                              {parentPlayers.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {parentPlayers.map(child => (
                                    <div key={child.id} className="bg-white p-3 rounded border border-gray-200 flex justify-between items-center">
                                      <div>
                                        <div className="font-bold text-sm">{child.full_name}</div>
                                        <div className="text-xs text-gray-500">{child.team_assigned} • {calculateAge(child.date_of_birth)} yrs</div>
                                      </div>
                                      <button 
                                        onClick={() => handleEditPlayerClick(child)}
                                        className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 italic">No players registered yet.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PLAYER ROSTER (MASTER) */}
      {activeTab === 'roster' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Master Player Roster</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Player</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Age / DOB</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Parent</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Jersey</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rosterPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">{player.full_name}</div>
                      <div className="text-xs text-gray-500">{player.position}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div>{calculateAge(player.date_of_birth)} years</div>
                      <div className="text-xs text-gray-400">{player.date_of_birth || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-bold uppercase rounded-full bg-blue-100 text-blue-800">
                        {player.team_assigned}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="font-medium">{player.profiles?.full_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{player.profiles?.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                      #{player.jersey_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditPlayerClick(player)}
                          className="bg-yellow-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-yellow-600 flex items-center gap-1"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(player.id)}
                          className="bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"
                          title="Remove Player"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rosterPlayers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 italic">No players on the roster yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: COACHES */}
      {activeTab === 'coaches' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Coaching Staff</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Profile</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {coaches.map((coach) => (
                  <tr key={coach.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 overflow-hidden border border-gray-300">
                        {coach.photo_url ? (
                          <img src={coach.photo_url} alt={coach.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <Users size={20} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{coach.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{coach.email || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRemoveCoach(coach.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700 flex items-center gap-1"
                        >
                          <X size={14} /> Remove Access
                        </button>
                        <button
                          onClick={() => handleDeleteUser(coach.id)}
                          className="bg-red-100 text-red-600 p-1 rounded hover:bg-red-200"
                          title="Permanently Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {coaches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500 italic">No coaches found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SCHEDULE */}
      {activeTab === 'schedule' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Upcoming Games</h2>
            <button 
              onClick={() => {
                setEditingGame(null);
                setNewGame({ date: '', time: '', opponent: '', location: '', teamGroup: 'All' });
                setIsGameModalOpen(true);
              }}
              className="bg-primary text-white px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              + Schedule Game
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Opponent</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Group</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {games.map((game) => (
                  <tr key={game.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex items-center gap-2">
                      <Calendar size={16} className="text-gray-400" />
                      {new Date(game.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" />
                        {game.time}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{game.opponent}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-gray-400" />
                        {game.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-bold uppercase rounded-full bg-blue-100 text-blue-800">
                        {game.team_group}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center gap-2">
                      <button
                        onClick={() => handleEditGameClick(game)}
                        className="text-gray-600 hover:text-blue-600 p-1 rounded-full hover:bg-gray-100"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteGame(game.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD PLAYER FOR PARENT */}
      {isAddPlayerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-bold text-xl text-gray-900">Add Child for {selectedParentName}</h3>
              <button onClick={() => setIsAddPlayerModalOpen(false)} className="text-gray-500 hover:text-black"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddChild} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Child Full Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border rounded-lg p-2"
                  value={newChild.fullName}
                  onChange={e => setNewChild({...newChild, fullName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Date of Birth</label>
                <input 
                  type="date" 
                  required
                  className="w-full border rounded-lg p-2"
                  value={newChild.dob}
                  onChange={e => setNewChild({...newChild, dob: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Gender</label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={newChild.gender}
                  onChange={e => setNewChild({...newChild, gender: e.target.value})}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700">
                Register Player
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GAME */}
      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-bold text-xl text-gray-900">{editingGame ? 'Edit Game' : 'Schedule New Game'}</h3>
              <button onClick={() => setIsGameModalOpen(false)} className="text-gray-500 hover:text-black"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddGame} className="p-6 space-y-4">
              <input type="date" required className="w-full border rounded-lg p-2" value={newGame.date} onChange={e => setNewGame({...newGame, date: e.target.value})} />
              <input type="time" required className="w-full border rounded-lg p-2" value={newGame.time} onChange={e => setNewGame({...newGame, time: e.target.value})} />
              <input type="text" placeholder="Opponent" required className="w-full border rounded-lg p-2" value={newGame.opponent} onChange={e => setNewGame({...newGame, opponent: e.target.value})} />
              <input type="text" placeholder="Location" required className="w-full border rounded-lg p-2" value={newGame.location} onChange={e => setNewGame({...newGame, location: e.target.value})} />
              <select className="w-full border rounded-lg p-2" value={newGame.teamGroup} onChange={e => setNewGame({...newGame, teamGroup: e.target.value})}>
                <option value="All">All Teams</option>
                <option value="U6">U6</option>
                <option value="U8">U8</option>
                <option value="U10">U10</option>
                <option value="U12">U12</option>
                <option value="U14">U14</option>
              </select>
              <button type="submit" disabled={gameLoading} className="w-full bg-primary text-white py-2 rounded-lg font-bold hover:bg-red-700">
                {gameLoading ? 'Saving...' : 'Save Game'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PLAYER */}
      {isEditPlayerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-bold text-xl text-gray-900">Edit Player Details</h3>
              <button onClick={() => setIsEditPlayerModalOpen(false)} className="text-gray-500 hover:text-black"><X size={24} /></button>
            </div>
            <form onSubmit={handleSavePlayerDetails} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Position</label>
                <select 
                  className="w-full border rounded-lg p-2"
                  value={playerForm.position}
                  onChange={e => setPlayerForm({...playerForm, position: e.target.value})}
                >
                  <option value="TBD">TBD</option>
                  <option value="Forward">Forward</option>
                  <option value="Midfielder">Midfielder</option>
                  <option value="Defender">Defender</option>
                  <option value="Goalkeeper">Goalkeeper</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Team Assignment</label>
                <select 
                  className="w-full border rounded-lg p-2"
                  value={playerForm.team_assigned}
                  onChange={e => setPlayerForm({...playerForm, team_assigned: e.target.value})}
                >
                  <option value="Unassigned">Unassigned</option>
                  <option value="U6">U6</option>
                  <option value="U8">U8</option>
                  <option value="U10">U10</option>
                  <option value="U12">U12</option>
                  <option value="U14">U14</option>
                  <option value="U16">U16</option>
                  <option value="First Team">First Team</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Jersey Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. 10" 
                  className="w-full border rounded-lg p-2"
                  value={playerForm.jersey_number}
                  onChange={e => setPlayerForm({...playerForm, jersey_number: e.target.value})}
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700">
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
