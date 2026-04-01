import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Pencil, Trash2, Calendar, Clock, MapPin, Users, UserPlus, Shield, ChevronDown, ChevronUp, Video, PlayCircle } from 'lucide-react';

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
  coach_id?: string;
  payment_status?: string;
  registration_id?: string;
  created_at?: string;
  profiles?: {
    full_name: string;
    email: string;
    phone: string;
  };
}

interface Coach {
  id: string;
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

interface Drill {
  id: string;
  title: string;
  description: string;
  category: string;
  youtube_url: string;
  created_at?: string;
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
  const [users, setUsers] = useState<User[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'parents' | 'roster' | 'coaches' | 'schedule' | 'drills'>('parents');
  
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Modals
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isEditPlayerModalOpen, setIsEditPlayerModalOpen] = useState(false);
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [isEditCoachModalOpen, setIsEditCoachModalOpen] = useState(false);
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);

  // Form States
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [coachForm, setCoachForm] = useState({ full_name: '', photo_file: null as File | null });
  const [isUploadingCoachPhoto, setIsUploadingCoachPhoto] = useState(false);
  
  const [gameLoading, setGameLoading] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [newGame, setNewGame] = useState({ date: '', time: '', opponent: '', location: '', teamGroup: 'All' });

  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [newDrill, setNewDrill] = useState({ title: '', category: 'Dribbling', youtube_url: '', description: '' });

  const [editingPlayer, setEditingPlayer] = useState<RosterPlayer | null>(null);
  const [playerForm, setPlayerForm] = useState({ position: '', team_assigned: '', jersey_number: '', payment_status: 'pending', photo_file: null as File | null });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedParentName, setSelectedParentName] = useState<string>('');
  const [newChild, setNewChild] = useState({ fullName: '', dob: '', gender: 'Male' });

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profilesData } = await supabase.from('profiles').select('*').eq('role', 'user').order('created_at', { ascending: false });
      if (profilesData) setUsers(profilesData);

      const { data: playersData } = await supabase.from('players').select('*, profiles:parent_id!left(full_name, email, phone)');
      if (playersData) {
        const playersWithStatus = await Promise.all(playersData.map(async (player) => {
          const { data: reg } = await supabase.from('registrations').select('payment_status, id').eq('parent_id', player.parent_id).eq('first_name', player.full_name.split(' ')[0]).order('created_at', { ascending: false }).limit(1).single();
          return { ...player, payment_status: reg?.payment_status || 'pending', registration_id: reg?.id };
        }));
        setRosterPlayers(playersWithStatus);
      }

      const { data: coachesData } = await supabase.from('coaches').select('id, full_name, profiles:id(photo_url)').order('full_name', { ascending: true });
      if (coachesData) {
        setCoaches(coachesData.map((c: any) => ({ id: c.id, full_name: c.full_name, photo_url: c.profiles?.photo_url })));
      }

      const { data: gamesData } = await supabase.from('games').select('*').order('date', { ascending: true });
      if (gamesData) setGames(gamesData);

      const { data: drillsData } = await supabase.from('drills').select('*').order('created_at', { ascending: false });
      if (drillsData) setDrills(drillsData);

    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDrill) {
        const { error } = await supabase.from('drills').update(newDrill).eq('id', editingDrill.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('drills').insert([newDrill]);
        if (error) throw error;
      }
      setToast({ message: editingDrill ? 'Drill updated!' : 'Drill published!', type: 'success' });
      setIsDrillModalOpen(false);
      setEditingDrill(null);
      setNewDrill({ title: '', category: 'Dribbling', youtube_url: '', description: '' });
      fetchData();
    } catch (err: any) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
  };

  const handleDeleteDrill = async (id: string) => {
    if (!confirm('Delete this drill from the Training Lab?')) return;
    try {
      await supabase.from('drills').delete().eq('id', id);
      setDrills(drills.filter(d => d.id !== id));
      setToast({ message: 'Drill removed.', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to delete drill', type: 'error' });
    }
  };

  const handleEditDrillClick = (drill: Drill) => {
    setEditingDrill(drill);
    setNewDrill({
      title: drill.title,
      category: drill.category,
      youtube_url: drill.youtube_url,
      description: drill.description
    });
    setIsDrillModalOpen(true);
  };

  // Rest of your existing functions (handleAssignCoach, handleAddGame, etc.)
  const toggleParentExpansion = (parentId: string) => {
    const newExpanded = new Set(expandedParents);
    if (newExpanded.has(parentId)) newExpanded.delete(parentId);
    else newExpanded.add(parentId);
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
      const safeDob = newChild.dob ? new Date(`${newChild.dob}T12:00:00`).toISOString() : null;
      const { error } = await supabase.from('players').insert({
        parent_id: selectedParentId,
        full_name: newChild.fullName,
        date_of_birth: safeDob,
        gender: newChild.gender,
        position: 'TBD',
        team_assigned: 'Unassigned',
        jersey_number: '-'
      });
      if (error) throw error;
      setIsAddPlayerModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Error adding child: ' + err.message);
    }
  };

  const handleEditPlayerClick = (player: RosterPlayer) => {
    setEditingPlayer(player);
    setPlayerForm({
      position: player.position || '',
      team_assigned: player.team_assigned || '',
      jersey_number: player.jersey_number || '',
      payment_status: player.payment_status || 'pending',
      photo_file: null
    });
    setIsEditPlayerModalOpen(true);
  };

  const handleSavePlayerDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setIsUploadingPhoto(true);
    try {
      let photoUrl = editingPlayer.photo_url;
      if (playerForm.photo_file) {
        const file = playerForm.photo_file;
        const fileName = `${Date.now()}_${file.name}`;
        await supabase.storage.from('player-photos').upload(fileName, file);
        const { data } = supabase.storage.from('player-photos').getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }
      await supabase.from('players').update({ position: playerForm.position, team_assigned: playerForm.team_assigned, jersey_number: playerForm.jersey_number, photo_url: photoUrl }).eq('id', editingPlayer.id);
      await supabase.from('registrations').update({ payment_status: playerForm.payment_status }).eq('id', editingPlayer.registration_id);
      setIsEditPlayerModalOpen(false);
      fetchData();
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleAssignCoach = async (playerId: string, coachId: string) => {
    await supabase.from('players').update({ coach_id: coachId === 'unassigned' ? null : coachId }).eq('id', playerId);
    fetchData();
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setGameLoading(true);
    try {
      if (editingGame) {
        await supabase.from('games').update({ date: newGame.date, time: newGame.time, opponent: newGame.opponent, location: newGame.location, team_group: newGame.teamGroup }).eq('id', editingGame.id);
      } else {
        await supabase.from('games').insert({ date: newGame.date, time: newGame.time, opponent: newGame.opponent, location: newGame.location, team_group: newGame.teamGroup });
      }
      setIsGameModalOpen(false);
      fetchData();
    } finally {
      setGameLoading(false);
    }
  };

  const handleDeleteGame = async (id: string) => {
    if (!confirm('Delete game?')) return;
    await supabase.from('games').delete().eq('id', id);
    fetchData();
  };

  const handleEditGameClick = (game: Game) => {
    setEditingGame(game);
    setNewGame({ date: game.date, time: game.time, opponent: game.opponent, location: game.location, teamGroup: game.team_group });
    setIsGameModalOpen(true);
  };

  const handleMakeCoach = async (user: User) => {
    await supabase.from('profiles').update({ role: 'coach' }).eq('id', user.id);
    await supabase.from('coaches').insert({ id: user.id, full_name: user.full_name });
    fetchData();
  };

  const handleEditCoachClick = (coach: Coach) => {
    setEditingCoach(coach);
    setCoachForm({ full_name: coach.full_name, photo_file: null });
    setIsEditCoachModalOpen(true);
  };

  const handleSaveCoachDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoach) return;
    setIsUploadingCoachPhoto(true);
    try {
      let photoUrl = editingCoach.photo_url;
      if (coachForm.photo_file) {
        const file = coachForm.photo_file;
        const fileName = `coach_${Date.now()}`;
        await supabase.storage.from('coach-photos').upload(fileName, file);
        const { data } = supabase.storage.from('coach-photos').getPublicUrl(fileName);
        photoUrl = data.publicUrl;
      }
      await supabase.from('coaches').update({ full_name: coachForm.full_name }).eq('id', editingCoach.id);
      await supabase.from('profiles').update({ full_name: coachForm.full_name, photo_url: photoUrl }).eq('id', editingCoach.id);
      setIsEditCoachModalOpen(false);
      fetchData();
    } finally {
      setIsUploadingCoachPhoto(false);
    }
  };

  const handleRemoveCoach = async (coachId: string) => {
    await supabase.from('coaches').delete().eq('id', coachId);
    await supabase.from('profiles').update({ role: 'user' }).eq('id', coachId);
    fetchData();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Permanently delete user?')) return;
    await supabase.rpc('delete_user_account', { target_user_id: userId });
    fetchData();
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return 'N/A';
    const age = new Date().getFullYear() - new Date(dob).getFullYear();
    return age;
  };

  if (loading) return <div className="flex justify-center items-center h-screen font-bold">LOADING BAMIKA ADMIN...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Admin <span className="text-primary">Dashboard</span></h1>

      {/* TABS */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden mb-6">
        {['parents', 'roster', 'coaches', 'schedule', 'drills'].map((tab) => (
          <button
            key={tab}
            className={`px-6 py-3 font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab === 'drills' ? 'Manage Drills' : tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* DRILLS TAB */}
      {activeTab === 'drills' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-black text-gray-900 uppercase">Training Lab Manager</h2>
              <p className="text-sm text-gray-500">Post videos and coaching points for the public lab.</p>
            </div>
            <button 
              onClick={() => {
                setEditingDrill(null);
                setNewDrill({ title: '', category: 'Dribbling', youtube_url: '', description: '' });
                setIsDrillModalOpen(true);
              }}
              className="bg-primary text-white px-6 py-3 rounded-lg font-black uppercase text-xs tracking-widest hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
            >
              <Video size={16} /> + New Drill
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Drill Details</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drills.map((drill) => (
                  <tr key={drill.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-20 bg-black rounded flex items-center justify-center text-primary border border-white/5">
                          <PlayCircle size={24} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{drill.title}</div>
                          <div className="text-xs text-gray-400 truncate max-w-[200px]">{drill.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-[10px] font-black uppercase rounded bg-red-50 text-primary border border-red-100">
                        {drill.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => handleEditDrillClick(drill)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={18} /></button>
                      <button onClick={() => handleDeleteDrill(drill.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
                {drills.length === 0 && (
                  <tr><td colSpan={3} className="px-6 py-10 text-center text-gray-400 italic">The Training Lab is empty.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ... (Previous TABs Parents, Roster, Coaches, Schedule content remains exactly as you had it) ... */}
      {activeTab === 'parents' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          {/* Parents table code goes here */}
          <h2 className="text-xl font-black text-gray-900 uppercase mb-4">Academy Parents</h2>
          {/* ... existing user map logic ... */}
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
                        <td className="px-6 py-4 whitespace-nowrap font-bold">{user.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap space-x-2">
                          <button onClick={() => handleOpenAddPlayerModal(user)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">+ Player</button>
                          <button onClick={() => toggleParentExpansion(user.id)} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs font-bold">{isExpanded ? 'Hide' : 'Show'} Children ({parentPlayers.length})</button>
                          <button onClick={() => handleMakeCoach(user)} className="text-gray-400 hover:text-blue-600"><Shield size={16} /></button>
                          <button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={3} className="px-12 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              {parentPlayers.map(p => (
                                <div key={p.id} className="p-3 bg-white border rounded flex justify-between">
                                  <span>{p.full_name} ({p.team_assigned})</span>
                                  <button onClick={() => handleEditPlayerClick(p)} className="text-primary text-xs font-bold">Edit</button>
                                </div>
                              ))}
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

      {/* ... (Include Roster, Coaches, Schedule tabs following the same pattern) ... */}

      {/* DRILL MODAL */}
      {isDrillModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-white/20">
            <div className="flex justify-between items-center p-6 bg-gray-50 border-b">
              <h3 className="font-black text-xl text-gray-900 uppercase tracking-tighter">{editingDrill ? 'Edit Lab Drill' : 'Post New Lab Drill'}</h3>
              <button onClick={() => setIsDrillModalOpen(false)} className="text-gray-400 hover:text-black"><X size={24} /></button>
            </div>
            <form onSubmit={handleUploadDrill} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Video Title</label>
                <input type="text" placeholder="e.g. Master the Cruyff Turn" required className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold focus:border-primary outline-none" value={newDrill.title} onChange={e => setNewDrill({...newDrill, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">YouTube URL</label>
                <input type="text" placeholder="Paste link here..." required className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold focus:border-primary outline-none" value={newDrill.youtube_url} onChange={e => setNewDrill({...newDrill, youtube_url: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Focus Category</label>
                <select className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold focus:border-primary outline-none appearance-none" value={newDrill.category} onChange={e => setNewDrill({...newDrill, category: e.target.value})}>
                  {['Dribbling', 'Shooting', 'Passing', 'Fitness', 'Goal Keeping'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Coaching Points (Description)</label>
                <textarea placeholder="List the key steps for players to follow..." required className="w-full border-2 border-gray-100 rounded-xl p-4 font-bold h-32 focus:border-primary outline-none resize-none" value={newDrill.description} onChange={e => setNewDrill({...newDrill, description: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-primary text-white py-5 rounded-xl font-black uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-500/30 transition-all transform active:scale-[0.98]">
                {editingDrill ? 'Update Drill' : 'Publish to Lab'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Include existing Modals (AddPlayer, Game, EditPlayer, EditCoach) here... */}
      
      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-8 right-8 px-8 py-4 rounded-xl shadow-2xl text-white font-black uppercase text-xs tracking-widest z-[200] animate-in slide-in-from-right-10 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}