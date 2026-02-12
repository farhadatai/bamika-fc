import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadPhoto } from '../lib/upload';
import { useAuthStore } from '../store/auth';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle, XCircle, Pencil, Trash2, Calendar, Clock, MapPin, Users } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  status: string;
  parent_id: string;
  created_at: string;
  coach_id?: string;
  waiver_signed_at: string | null;
  manual_parent_name?: string;
  manual_phone?: string;
  photo_url?: string;
  age_group?: string;
  payment_status?: string;
  profiles: {
    full_name: string;
    phone: string;
  };
}

interface Coach {
  id: string;
  email: string;
  full_name: string;
}

interface Game {
  id: string;
  date: string;
  time: string;
  opponent: string;
  location: string;
  team_group: string;
}

export default function AdminDashboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('All Groups');
  const [filterCoach, setFilterCoach] = useState('All Coaches');
  const [filterPayment, setFilterPayment] = useState('All');
  const [activeTab, setActiveTab] = useState<'players' | 'schedule'>('players');
  const navigate = useNavigate();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  // New Coach Form State
  const [newCoach, setNewCoach] = useState({
    fullName: '',
    email: ''
  });

  // New Game Form State
  const [newGame, setNewGame] = useState({
    date: '',
    time: '',
    opponent: '',
    location: '',
    teamGroup: 'All'
  });

  // New Player Form State
  const [newPlayer, setNewPlayer] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    gender: 'Male', // Default gender
    parentName: '',
    phone: '',
    waiverSigned: true, 
    photoUrl: '',
    ageGroup: 'U6'
  });

  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    try {
      fetchData();
    } catch (e: any) {
      setRenderError(e.message);
    }
  }, []);

  const calculateAgeGroup = (dob: string) => {
    if (!dob) return 'U6';
    const birthYear = new Date(dob).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - birthYear;
    
    if (age <= 6) return 'U6';
    if (age <= 8) return 'U8';
    if (age <= 10) return 'U10';
    if (age <= 12) return 'U12';
    if (age <= 14) return 'U14';
    if (age <= 16) return 'U16';
    return 'Open';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Coaches
      try {
        const { data: coachesData, error: coachesError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .or('role.eq.coach,role.eq.admin');
          
        if (coachesData) {
          setCoaches(coachesData.map((c: any) => ({
            id: c.id,
            full_name: c.full_name || 'Unknown Coach',
            email: '' 
          })));
        }
      } catch (coachErr) {
        console.error('Error fetching coaches:', coachErr);
        setCoaches([]);
      }

      // 2. Fetch Players
      const { data, error } = await supabase
        .from('registrations')
        .select('*, profiles:parent_id(full_name, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 3. Fetch Games
      try {
        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select('*')
          .order('date', { ascending: true });
        
        if (gamesData) {
          setGames(gamesData);
        }
      } catch (gameErr) {
        console.error('Error fetching games:', gameErr);
      }

      if (data) {
        const formattedData = data.map((p: any) => {
          try {
            let profileObj = { full_name: 'N/A', phone: 'N/A' };
            if (p.profiles) {
              if (Array.isArray(p.profiles)) {
                if (p.profiles.length > 0) profileObj = p.profiles[0];
              } else if (typeof p.profiles === 'object') {
                profileObj = p.profiles;
              }
            }
            return {
              ...p,
              profiles: {
                full_name: profileObj?.full_name || 'N/A',
                phone: profileObj?.phone || 'N/A'
              }
            };
          } catch (mapErr) {
            return p;
          }
        });
        setPlayers(formattedData);
      }
    } catch (err: any) {
      console.error('Unexpected error in fetchData:', err);
      setRenderError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    setCoachLoading(true);

    try {
      // 1. Create a placeholder profile for the coach
      // Note: In a real app, you would create an auth user first. 
      // Here we are just creating a profile row so they appear in lists.
      // We generate a random UUID for the ID since we don't have an auth user yet.
      const fakeId = crypto.randomUUID();
      
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: fakeId,
          full_name: newCoach.fullName,
          role: 'user', // Default to user, "Make Coach" button promotes them
          // Store email in a metadata field or just ignore it for now if schema doesn't support it
          // Assuming we might add an email column later or just use it for display
        });

      if (error) throw error;

      alert('Coach added successfully! Use the "Make Coach" button to grant dashboard access.');
      setNewCoach({ fullName: '', email: '' });
      setIsCoachModalOpen(false);
      fetchData(); // Refresh list
    } catch (err: any) {
      console.error('Error adding coach:', err);
      alert('Failed to add coach: ' + err.message);
    } finally {
      setCoachLoading(false);
    }
  };

  const handleMakeCoach = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'coach' })
        .eq('id', userId);

      if (error) throw error;

      alert('User promoted to Coach!');
      fetchData(); // Refresh list
    } catch (err: any) {
      console.error('Error promoting user:', err);
      alert('Failed to promote user: ' + err.message);
    }
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setGameLoading(true);

    try {
      if (editingGame) {
        // UPDATE EXISTING GAME
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
        alert('Game updated successfully!');
      } else {
        // INSERT NEW GAME
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
        alert('Game scheduled successfully!');
      }

      setNewGame({ date: '', time: '', opponent: '', location: '', teamGroup: 'All' });
      setEditingGame(null);
      setIsGameModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving game:', err);
      alert('Failed to save game: ' + err.message);
    } finally {
      setGameLoading(false);
    }
  };

  const handleEditGameClick = (game: Game) => {
    setEditingGame(game);
    setNewGame({
      date: game.date,
      time: game.time,
      opponent: game.opponent,
      location: game.location,
      teamGroup: game.team_group || 'All'
    });
    setIsGameModalOpen(true);
  };

  const handleDeleteGame = async (id: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;
    
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setGames(games.filter(g => g.id !== id));
    } catch (err: any) {
      alert('Failed to delete game');
    }
  };

  const handleEditClick = (player: Player) => {
    setEditingPlayer(player);
    setNewPlayer({
      firstName: player.first_name,
      lastName: player.last_name,
      dob: player.dob,
      gender: player.gender,
      parentName: player.profiles?.full_name !== 'N/A' ? player.profiles.full_name : (player.manual_parent_name || ''),
      phone: player.profiles?.phone !== 'N/A' ? player.profiles.phone : (player.manual_phone || ''),
      waiverSigned: !!player.waiver_signed_at,
      photoUrl: player.photo_url || '',
      ageGroup: player.age_group || calculateAgeGroup(player.dob)
    });
    setIsEditModalOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setPlayerLoading(true);

    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          first_name: newPlayer.firstName,
          last_name: newPlayer.lastName,
          dob: newPlayer.dob,
          gender: newPlayer.gender,
          manual_parent_name: newPlayer.parentName,
          manual_phone: newPlayer.phone,
          photo_url: newPlayer.photoUrl,
          age_group: newPlayer.ageGroup
        })
        .eq('id', editingPlayer.id);

      if (error) throw error;

      alert('Player details updated successfully!');
      setIsEditModalOpen(false);
      setEditingPlayer(null);
      setNewPlayer({ firstName: '', lastName: '', dob: '', gender: 'Male', parentName: '', phone: '', waiverSigned: true, photoUrl: '', ageGroup: 'U6' });
      fetchData();
    } catch (err: any) {
      console.error('Error updating player:', err);
      alert('Failed to update player: ' + err.message);
    } finally {
      setPlayerLoading(false);
    }
  };

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlayerLoading(true);

    console.log('Registering player with data:', newPlayer); // Debug log

    try {
      // 1. Insert into registrations
      const { data, error } = await supabase
        .from('registrations')
        .insert({
          first_name: newPlayer.firstName,
          last_name: newPlayer.lastName,
          dob: newPlayer.dob,
          gender: newPlayer.gender || 'Male',
          status: 'active',
          waiver_signed_at: newPlayer.waiverSigned ? new Date().toISOString() : null,
          manual_parent_name: newPlayer.parentName, 
          manual_phone: newPlayer.phone,
          photo_url: newPlayer.photoUrl,
          parent_id: null,
          age_group: newPlayer.ageGroup
        })
        .select()
        .single();

      if (error) throw error;
      
      alert('Player registered manually!');
      
      if (newPlayer.proceedToPayment && data) {
        // Redirect to payment page with new registration ID
        navigate(`/payment?registration_id=${data.id}`);
        return; // Stop execution here so we don't just close the modal
      }

      setNewPlayer({ firstName: '', lastName: '', dob: '', gender: 'Male', parentName: '', phone: '', waiverSigned: true, photoUrl: '', proceedToPayment: true, ageGroup: 'U6' });
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error registering player:', err);
      alert('Failed to register: ' + err.message);
    } finally {
      setPlayerLoading(false);
    }
  };

  const handleAdminPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const publicUrl = await uploadPhoto(file, 'players');
    if (publicUrl) {
      setNewPlayer(prev => ({ ...prev, photoUrl: publicUrl }));
    } else {
      alert('Failed to upload photo');
    }
  };

  const handleAssignCoach = async (playerId: string, coachId: string) => {
    try {
      const { error } = await supabase
        .from('registrations')
        .update({ coach_id: coachId || null })
        .eq('id', playerId);

      if (error) throw error;

      setPlayers(players.map(p => 
        p.id === playerId ? { ...p, coach_id: coachId } : p
      ));
    } catch (error) {
      alert('Failed to assign coach');
    }
  };

  const handleUpdatePaymentStatus = async (playerId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: status })
        .eq('id', playerId);

      if (error) throw error;

      setPlayers(players.map(p => 
        p.id === playerId ? { ...p, payment_status: status } : p
      ));
      
      // Simple toast simulation
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce';
      toast.innerText = 'Payment status updated!';
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 2000);

    } catch (error) {
      alert('Failed to update payment status');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('registrations')
        .update({ status: 'active' })
        .eq('id', id);

      if (error) throw error;
      setPlayers(players.map(p => p.id === id ? { ...p, status: 'active' } : p));
    } catch (error) {
      alert('Failed to approve player');
    }
  };

  const handleExportCSV = () => {
    const headers = ['First Name', 'Last Name', 'DOB', 'Status', 'Parent', 'Phone'];
    const csvContent = [
      headers.join(','),
      ...players.map(p => [
        p.first_name,
        p.last_name,
        p.dob,
        p.status,
        p.profiles?.full_name !== 'N/A' ? p.profiles.full_name : (p.manual_parent_name || ''),
        p.profiles?.phone !== 'N/A' ? p.profiles.phone : (p.manual_phone || '')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'bamika_roster.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const safePlayers = Array.isArray(players) ? players : [];
  const filteredPlayers = safePlayers.filter(p => {
    const matchesSearch = (p.first_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.last_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGroup = filterGroup === 'All Groups' || 
                         (p.age_group === filterGroup) ||
                         (!p.age_group && calculateAgeGroup(p.dob) === filterGroup);

    const matchesCoach = filterCoach === 'All Coaches' || 
                         (filterCoach === 'Unassigned' ? !p.coach_id : p.coach_id === filterCoach);

    const matchesPayment = filterPayment === 'All' ||
                           (filterPayment === 'Paid' ? p.payment_status === 'paid' : (p.payment_status !== 'paid' || !p.payment_status));

    return matchesSearch && matchesGroup && matchesCoach && matchesPayment;
  });

  if (renderError) return <div className="p-4 text-red-500">{renderError}</div>;
  if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        
        {activeTab === 'players' && (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsCoachModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-bold hover:bg-blue-700 transition-colors"
            >
              + Add Coach
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md font-bold hover:bg-green-700 transition-colors"
            >
              + Register Player
            </button>
            <button 
              onClick={handleExportCSV}
              className="bg-primary text-white px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors"
            >
              Download CSV
            </button>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setEditingGame(null);
                setNewGame({ date: '', time: '', opponent: '', location: '', teamGroup: 'All' });
                setIsGameModalOpen(true);
              }}
              className="bg-primary text-white px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              + Schedule New Game
            </button>
          </div>
        )}
      </div>

      {/* TABS */}
      <div className="flex border-b border-gray-200">
        <button
          className={`px-6 py-3 font-bold text-sm ${activeTab === 'players' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('players')}
        >
          Players & Coaches
        </button>
        <button
          className={`px-6 py-3 font-bold text-sm ${activeTab === 'schedule' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('schedule')}
        >
          Game Schedule
        </button>
      </div>

      {/* PLAYERS & COACHES TAB */}
      {activeTab === 'players' && (
        <div className="space-y-6">
          {/* COACHES SECTION */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Coaches & Staff</h2>
            {coaches.length === 0 ? (
              <p className="text-gray-500">No coaches found.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coaches.map((coach) => (
                  <div key={coach.id} className="flex flex-col p-4 border rounded-lg hover:shadow-md transition-shadow gap-3">
                    <div className="flex items-center">
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 mr-4">
                        {coach.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{coach.full_name}</div>
                        <div className="text-sm text-gray-500">{coach.email || 'No email'}</div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleMakeCoach(coach.id)}
                      className="w-full py-1 text-xs font-bold bg-gray-100 hover:bg-green-100 text-gray-700 hover:text-green-700 rounded transition-colors border border-gray-200 hover:border-green-200"
                    >
                      Make Coach (Grant Access)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* PLAYER LIST */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="mb-6 flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="Search players..."
                className="w-full md:w-1/3 border rounded-md p-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="w-full md:w-1/4 border rounded-md p-2"
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
              >
                <option value="All Groups">All Groups</option>
                <option value="U6">U6</option>
                <option value="U8">U8</option>
                <option value="U10">U10</option>
                <option value="U12">U12</option>
                <option value="U14">U14</option>
                <option value="U16">U16</option>
                <option value="Open">Open</option>
              </select>
              <select
                className="w-full md:w-1/4 border rounded-md p-2"
                value={filterCoach}
                onChange={(e) => setFilterCoach(e.target.value)}
              >
                <option value="All Coaches">All Coaches</option>
                <option value="Unassigned">Unassigned (No Coach)</option>
                {coaches.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
              <select
                className="w-full md:w-1/4 border rounded-md p-2"
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
              >
                <option value="All">All Payments</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Player</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Group</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">DOB</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Parent</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Coach</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPlayers.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-4 text-gray-500">No players found.</td></tr>
                  ) : (
                    filteredPlayers.map((player) => (
                      <tr key={player.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 mr-4">
                              {player.photo_url ? (
                                <img className="h-10 w-10 rounded-full object-cover border" src={player.photo_url} alt="" />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                                  {player.first_name[0]}{player.last_name[0]}
                                </div>
                              )}
                            </div>
                            <div className="font-bold text-gray-900">{player.first_name} {player.last_name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-bold uppercase rounded-full bg-blue-100 text-blue-800">
                            {player.age_group || calculateAgeGroup(player.dob)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(player.dob).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {player.profiles?.full_name !== 'N/A' ? player.profiles.full_name : (player.manual_parent_name || 'N/A')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {player.profiles?.phone !== 'N/A' ? player.profiles.phone : (player.manual_phone || 'N/A')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-bold uppercase rounded-full ${
                            player.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {player.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <select
                            className={`border rounded p-1 text-xs font-bold uppercase ${
                              player.payment_status === 'paid' ? 'text-green-700 bg-green-50 border-green-200' : 'text-orange-700 bg-orange-50 border-orange-200'
                            }`}
                            value={player.payment_status || 'pending'}
                            onChange={(e) => handleUpdatePaymentStatus(player.id, e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <select
                            className="border rounded p-1 text-sm max-w-[150px]"
                            value={player.coach_id || ''}
                            onChange={(e) => handleAssignCoach(player.id, e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {coaches.map(c => (
                              <option key={c.id} value={c.id}>{c.full_name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(player)}
                            className="text-gray-600 hover:text-blue-600 p-1 rounded-full hover:bg-gray-100"
                            title="Edit Player"
                          >
                            <Pencil size={18} />
                          </button>
                          {player.status !== 'active' && (
                            <button
                              onClick={() => handleApprove(player.id)}
                              className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded"
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GAME SCHEDULE TAB */}
      {activeTab === 'schedule' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Upcoming Games</h2>
          {games.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p>No games scheduled yet.</p>
              <button 
                onClick={() => setIsGameModalOpen(true)}
                className="mt-2 text-primary font-bold hover:underline"
              >
                Schedule the first game
              </button>
            </div>
          ) : (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {game.opponent}
                      </td>
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
                          title="Edit Game"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteGame(game.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                          title="Delete Game"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADD COACH MODAL */}
      {isCoachModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-bold text-xl text-gray-900">Add New Coach</h3>
              <button 
                onClick={() => setIsCoachModalOpen(false)}
                className="text-gray-500 hover:text-black"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddCoach} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Full Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={newCoach.fullName}
                  onChange={e => setNewCoach({...newCoach, fullName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Email (Optional)</label>
                <input
                  type="email"
                  className="w-full border rounded-lg p-2"
                  value={newCoach.email}
                  onChange={e => setNewCoach({...newCoach, email: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsCoachModalOpen(false)}
                  className="px-5 py-2 text-gray-700 font-bold hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={coachLoading}
                  className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {coachLoading ? 'Adding...' : 'Add Coach'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD GAME MODAL */}
      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="font-bold text-xl text-gray-900">
                {editingGame ? 'Edit Game' : 'Schedule New Game'}
              </h3>
              <button 
                onClick={() => {
                  setIsGameModalOpen(false);
                  setEditingGame(null);
                  setNewGame({ date: '', time: '', opponent: '', location: '', teamGroup: 'All' });
                }}
                className="text-gray-500 hover:text-black"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddGame} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg p-2"
                  value={newGame.date}
                  onChange={e => setNewGame({...newGame, date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Time</label>
                <input
                  type="time"
                  className="w-full border rounded-lg p-2"
                  value={newGame.time}
                  onChange={e => setNewGame({...newGame, time: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Opponent</label>
                <input
                  type="text"
                  placeholder="e.g. Vienna United"
                  className="w-full border rounded-lg p-2"
                  value={newGame.opponent}
                  onChange={e => setNewGame({...newGame, opponent: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Home Field or Address"
                  className="w-full border rounded-lg p-2"
                  value={newGame.location}
                  onChange={e => setNewGame({...newGame, location: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Team Group</label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={newGame.teamGroup}
                  onChange={e => setNewGame({...newGame, teamGroup: e.target.value})}
                >
                  <option value="All">All Teams</option>
                  <option value="U6">U6</option>
                  <option value="U8">U8</option>
                  <option value="U10">U10</option>
                  <option value="U12">U12</option>
                  <option value="U14">U14</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsGameModalOpen(false);
                    setEditingGame(null);
                    setNewGame({ date: '', time: '', opponent: '', location: '', teamGroup: 'All' });
                  }}
                  className="px-5 py-2 text-gray-700 font-bold hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={gameLoading}
                  className="bg-primary text-white px-8 py-2 rounded-lg font-bold hover:bg-red-700 disabled:opacity-50"
                >
                  {gameLoading ? 'Saving...' : (editingGame ? 'Save Changes' : 'Schedule Game')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold text-xl text-green-800">Manual Player Registration</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-black"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleManualRegister} className="p-6 grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">First Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.firstName}
                  onChange={e => setNewPlayer({...newPlayer, firstName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Last Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.lastName}
                  onChange={e => setNewPlayer({...newPlayer, lastName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.dob}
                  onChange={e => {
                    const newDob = e.target.value;
                    const smartGroup = calculateAgeGroup(newDob);
                    setNewPlayer({...newPlayer, dob: newDob, ageGroup: smartGroup});
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Age Group</label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.ageGroup}
                  onChange={e => setNewPlayer({...newPlayer, ageGroup: e.target.value})}
                >
                  <option value="U6">U6</option>
                  <option value="U8">U8</option>
                  <option value="U10">U10</option>
                  <option value="U12">U12</option>
                  <option value="U14">U14</option>
                  <option value="U16">U16</option>
                  <option value="Open">Open</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Gender</label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.gender}
                  onChange={e => setNewPlayer({...newPlayer, gender: e.target.value})}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Parent Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.parentName}
                  onChange={e => setNewPlayer({...newPlayer, parentName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Phone</label>
                <input
                  type="tel"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.phone}
                  onChange={e => setNewPlayer({...newPlayer, phone: e.target.value})}
                  required
                />
              </div>
              
              <div className="col-span-full space-y-2">
                <label className="text-sm font-bold text-gray-700">Player Photo</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <input type="file" accept="image/*" onChange={handleAdminPhotoUpload} />
                  {newPlayer.photoUrl && (
                    <img src={newPlayer.photoUrl} alt="Preview" className="h-16 w-16 rounded-full object-cover border-2 border-green-500" />
                  )}
                </div>
              </div>

              <div className="col-span-full pt-4 border-t flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 text-gray-700 font-bold hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={playerLoading}
                  className="bg-green-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
                >
                  {playerLoading ? 'Registering...' : 'Register Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PLAYER MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
              <h3 className="font-bold text-xl text-blue-800">Edit Player Details</h3>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingPlayer(null);
                  setNewPlayer({ firstName: '', lastName: '', dob: '', gender: 'Male', parentName: '', phone: '', waiverSigned: true, photoUrl: '' });
                }}
                className="text-gray-500 hover:text-black"
              >
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleEditSave} className="p-6 grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">First Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.firstName}
                  onChange={e => setNewPlayer({...newPlayer, firstName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Last Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.lastName}
                  onChange={e => setNewPlayer({...newPlayer, lastName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.dob}
                  onChange={e => {
                    const newDob = e.target.value;
                    const smartGroup = calculateAgeGroup(newDob);
                    setNewPlayer({...newPlayer, dob: newDob, ageGroup: smartGroup});
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Age Group</label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.ageGroup}
                  onChange={e => setNewPlayer({...newPlayer, ageGroup: e.target.value})}
                >
                  <option value="U6">U6</option>
                  <option value="U8">U8</option>
                  <option value="U10">U10</option>
                  <option value="U12">U12</option>
                  <option value="U14">U14</option>
                  <option value="U16">U16</option>
                  <option value="Open">Open</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Gender</label>
                <select
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.gender}
                  onChange={e => setNewPlayer({...newPlayer, gender: e.target.value})}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Parent Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.parentName}
                  onChange={e => setNewPlayer({...newPlayer, parentName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Phone</label>
                <input
                  type="tel"
                  className="w-full border rounded-lg p-2"
                  value={newPlayer.phone}
                  onChange={e => setNewPlayer({...newPlayer, phone: e.target.value})}
                  required
                />
              </div>
              
              <div className="col-span-full space-y-2">
                <label className="text-sm font-bold text-gray-700">Player Photo</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <input type="file" accept="image/*" onChange={handleAdminPhotoUpload} />
                  {newPlayer.photoUrl && (
                    <img src={newPlayer.photoUrl} alt="Preview" className="h-16 w-16 rounded-full object-cover border-2 border-green-500" />
                  )}
                </div>
              </div>

              <div className="col-span-full pt-4 border-t flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingPlayer(null);
                    setNewPlayer({ firstName: '', lastName: '', dob: '', gender: 'Male', parentName: '', phone: '', waiverSigned: true, photoUrl: '' });
                  }}
                  className="px-5 py-2 text-gray-700 font-bold hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={playerLoading}
                  className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {playerLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
