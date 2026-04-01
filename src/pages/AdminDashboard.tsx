import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  X, Pencil, Trash2, Calendar, Clock, MapPin, Users, 
  UserPlus, Shield, ChevronDown, ChevronUp, Video, PlayCircle, Plus 
} from 'lucide-react';

// --- INTERFACES ---
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
  // --- STATE ---
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
  const [newGame, setNewGame] = useState({ date: '', time: '', opponent: '', location: '', teamGroup: 'All' });
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [newDrill, setNewDrill] = useState({ title: '', category: 'Dribbling', youtube_url: '', description: '' });
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [playerForm, setPlayerForm] = useState({ position: '', team_assigned: '', jersey_number: '', payment_status: 'pending', photo_file: null as File | null });
  const [editingPlayer, setEditingPlayer] = useState<RosterPlayer | null>(null);
  
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedParentName, setSelectedParentName] = useState<string>('');
  const [newChild, setNewChild] = useState({ fullName: '', dob: '', gender: 'Male' });
  
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pData } = await supabase.from('profiles').select('*').eq('role', 'user').order('created_at', { ascending: false });
      if (pData) setUsers(pData);

      const { data: plData } = await supabase.from('players').select('*, profiles:parent_id!left(full_name, email, phone)');
      if (plData) setRosterPlayers(plData);

      const { data: cData } = await supabase.from('coaches').select('id, full_name, profiles:id(photo_url)');
      if (cData) setCoaches(cData.map((c: any) => ({ id: c.id, full_name: c.full_name, photo_url: c.profiles?.photo_url })));

      const { data: gData } = await supabase.from('games').select('*').order('date', { ascending: true });
      if (gData) setGames(gData);

      const { data: dData } = await supabase.from('drills').select('*').order('created_at', { ascending: false });
      if (dData) setDrills(dData);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleUploadDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = editingDrill 
      ? await supabase.from('drills').update(newDrill).eq('id', editingDrill.id)
      : await supabase.from('drills').insert([newDrill]);
    
    if (!error) {
      setToast({ message: 'Drill Saved!', type: 'success' });
      setIsDrillModalOpen(false);
      fetchData();
    }
  };

  const handleDeleteDrill = async (id: string) => {
    if (confirm('Delete drill?')) {
      await supabase.from('drills').delete().eq('id', id);
      fetchData();
    }
  };
  
  const handleEditDrillClick = (drill: Drill) => {
    setEditingDrill(drill);
    setNewDrill(drill);
    setIsDrillModalOpen(true);
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = editingGame
      ? await supabase.from('games').update({ date: newGame.date, time: newGame.time, opponent: newGame.opponent, location: newGame.location, team_group: newGame.teamGroup }).eq('id', editingGame.id)
      : await supabase.from('games').insert({ date: newGame.date, time: newGame.time, opponent: newGame.opponent, location: newGame.location, team_group: newGame.teamGroup });
    
    if (!error) {
      setIsGameModalOpen(false);
      fetchData();
    }
  };
  
  const handleDeleteGame = async (id: string) => {
    if(confirm('Delete?')) {
      await supabase.from('games').delete().eq('id', id); 
      fetchData();
    }
  };

  const handleEditGameClick = (game: Game) => {
    setEditingGame(game);
    setNewGame(game);
    setIsGameModalOpen(true);
  };
  
  const handleAssignCoach = async (playerId: string, coachId: string) => {
    await supabase.from('players').update({ coach_id: coachId === 'unassigned' ? null : coachId }).eq('id', playerId);
    fetchData();
  };

  const calculateAge = (dob?: string) => dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 'N/A';

  if (loading) return <div className="p-20 text-center font-black uppercase tracking-widest animate-pulse">Loading Bamika Admin...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic">Admin <span className="text-[#EF4444]">Dashboard</span></h1>

      {/* TABS */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        {['parents', 'roster', 'coaches', 'schedule', 'drills'].map((tab) => (
          <button
            key={tab}
            className={`px-6 py-4 font-black text-[10px] uppercase tracking-widest transition-all border-r border-gray-100 ${activeTab === tab ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-50'}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab === 'drills' ? 'Manage Drills' : tab}
          </button>
        ))}
      </div>

      {/* PARENTS TAB */}
      {activeTab === 'parents' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Parent Name</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-900">{user.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => { setSelectedParentId(user.id); setIsAddPlayerModalOpen(true); }} className="bg-green-500 text-white px-3 py-1 rounded text-[10px] font-black uppercase">+ Player</button>
                    <button onClick={() => { const n = new Set(expandedParents); n.has(user.id) ? n.delete(user.id) : n.add(user.id); setExpandedParents(n); }} className="bg-gray-100 text-gray-600 px-3 py-1 rounded text-[10px] font-black uppercase tracking-tighter">Children ({rosterPlayers.filter(p => p.parent_id === user.id).length})</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ROSTER TAB */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Player</th>
                <th className="px-6 py-4">Age</th>
                <th className="px-6 py-4">Coach</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rosterPlayers.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-900 flex items-center gap-3">
                    <img src={p.photo_url || ''} className="w-8 h-8 rounded-full object-cover bg-gray-100" />
                    {p.full_name}
                  </td>
                  <td className="px-6 py-4 text-sm">{calculateAge(p.date_of_birth)}</td>
                  <td className="px-6 py-4 text-sm">
                    <select value={p.coach_id || 'unassigned'} onChange={(e) => handleAssignCoach(p.id, e.target.value)} className="border p-1 rounded">
                      <option value="unassigned">Unassigned</option>
                      {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { setEditingPlayer(p); setIsEditPlayerModalOpen(true); }} className="text-gray-400 hover:text-blue-600"><Pencil size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* COACHES TAB */}
      {activeTab === 'coaches' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Coach Name</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coaches.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-gray-900">{c.full_name}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { setEditingCoach(c); setIsEditCoachModalOpen(true); }} className="text-gray-400 hover:text-blue-600"><Pencil size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-black uppercase text-gray-900">League Matches</h2>
            <button onClick={() => setIsGameModalOpen(true)} className="bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ Schedule</button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Opponent</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {games.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{new Date(g.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-bold">{g.opponent}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEditGameClick(g)} className="text-gray-400 hover:text-blue-600 mr-2"><Pencil size={18}/></button>
                    <button onClick={() => handleDeleteGame(g.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DRILLS TAB */}
      {activeTab === 'drills' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-black uppercase text-gray-900">Training Lab Drills</h2>
            <button onClick={() => { setEditingDrill(null); setNewDrill({title:'', category:'Dribbling', youtube_url:'', description:''}); setIsDrillModalOpen(true); }} className="bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ New Video</button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drills.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold">{d.title}</td>
                  <td className="px-6 py-4"><span className="text-[10px] font-black uppercase bg-red-50 text-[#EF4444] px-2 py-1 rounded">{d.category}</span></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEditDrillClick(d)} className="text-gray-400 hover:text-blue-600 mr-2"><Pencil size={18}/></button>
                    <button onClick={() => handleDeleteDrill(d.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DRILL MODAL (POPUP) */}
      {isDrillModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-black uppercase text-gray-900">{editingDrill ? 'Edit' : 'New'} Lab Video</h3>
              <button onClick={() => setIsDrillModalOpen(false)}><X/></button>
            </div>
            <form onSubmit={handleUploadDrill} className="p-6 space-y-4">
              <input type="text" placeholder="Drill Title" required className="w-full border p-4 rounded-xl font-bold outline-none focus:border-[#EF4444]" value={newDrill.title} onChange={e => setNewDrill({...newDrill, title: e.target.value})} />
              <input type="text" placeholder="YouTube Link" required className="w-full border p-4 rounded-xl font-bold outline-none focus:border-[#EF4444]" value={newDrill.youtube_url} onChange={e => setNewDrill({...newDrill, youtube_url: e.target.value})} />
              <select className="w-full border p-4 rounded-xl font-bold" value={newDrill.category} onChange={e => setNewDrill({...newDrill, category: e.target.value})}>
                <option>Dribbling</option><option>Shooting</option><option>Passing</option><option>Fitness</option>
              </select>
              <textarea placeholder="Coaching Points" required className="w-full border p-4 rounded-xl font-bold h-32" value={newDrill.description} onChange={e => setNewDrill({...newDrill, description: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-red-500/20">Publish to Lab</button>
            </form>
          </div>
        </div>
      )}

      {/* GAME MODAL */}
      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b flex justify-between"><h3 className="font-black uppercase">Schedule Match</h3><button onClick={() => setIsGameModalOpen(false)}><X/></button></div>
            <form onSubmit={handleAddGame} className="p-6 space-y-4">
              <input type="date" required className="w-full border p-4 rounded-xl" value={newGame.date} onChange={e => setNewGame({...newGame, date: e.target.value})} />
              <input type="time" required className="w-full border p-4 rounded-xl" value={newGame.time} onChange={e => setNewGame({...newGame, time: e.target.value})} />
              <input type="text" placeholder="Opponent" required className="w-full border p-4 rounded-xl" value={newGame.opponent} onChange={e => setNewGame({...newGame, opponent: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase">Save Game</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
