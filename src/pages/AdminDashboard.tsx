import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  X, Pencil, Trash2, Calendar, Clock, MapPin, Users, 
  UserPlus, Shield, ChevronDown, ChevronUp, Video, PlayCircle, Plus 
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'parents' | 'roster' | 'coaches' | 'schedule' | 'drills'>('parents');
  const [users, setUsers] = useState<any[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [drills, setDrills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isEditPlayerModalOpen, setIsEditPlayerModalOpen] = useState(false);
  
  // Form States
  const [newDrill, setNewDrill] = useState({ title: '', youtube_url: '', category: 'Dribbling', description: '' });
  const [newGame, setNewGame] = useState({ date: '', opponent: '', location: '', time: '' });
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [playerForm, setPlayerForm] = useState({ position: '', team_assigned: '', jersey_number: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: pData } = await supabase.from('profiles').select('*').eq('role', 'user');
    const { data: cData } = await supabase.from('coaches').select('*, profiles(photo_url)');
    const { data: plData } = await supabase.from('players').select('*');
    const { data: gData } = await supabase.from('games').select('*');
    const { data: dData } = await supabase.from('drills').select('*');
    
    setUsers(pData || []);
    setCoaches(cData || []);
    setRosterPlayers(plData || []);
    setGames(gData || []);
    setDrills(dData || []);
    setLoading(false);
  };

  // HANDLERS
  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('games').insert([newGame]);
    setIsGameModalOpen(false);
    fetchData();
  };

  const handleAddDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('drills').insert([newDrill]);
    setIsDrillModalOpen(false);
    fetchData();
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('players').update(playerForm).eq('id', editingPlayer.id);
    setIsEditPlayerModalOpen(false);
    fetchData();
  };

  if (loading) return <div className="p-20 text-center font-black uppercase italic">Loading Admin Suite...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <h1 className="text-3xl font-black text-gray-900 uppercase italic">Admin <span className="text-[#EF4444]">Dashboard</span></h1>

      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        {['parents', 'roster', 'coaches', 'schedule', 'drills'].map((tab) => (
          <button
            key={tab}
            className={`px-6 py-4 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-50'}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ROSTER TAB WITH PHOTOS */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
              <tr><th className="px-6 py-4">Player</th><th className="px-6 py-4">Team</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rosterPlayers.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden border">
                      {p.photo_url ? <img src={p.photo_url} className="h-full w-full object-cover" /> : <Users className="m-auto h-full text-gray-300" />}
                    </div>
                    <span className="font-bold">{p.full_name}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-[#EF4444] uppercase">{p.team_assigned || 'Unassigned'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => { setEditingPlayer(p); setPlayerForm({position: p.position, team_assigned: p.team_assigned, jersey_number: p.jersey_number}); setIsEditPlayerModalOpen(true); }} className="text-gray-400 hover:text-blue-600"><Pencil size={18}/></button>
                    <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('players').delete().eq('id', p.id); fetchData(); }}} className="text-gray-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SCHEDULE TAB WITH ADD BUTTON */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6">
           <div className="flex justify-between mb-6">
             <h2 className="font-black uppercase">Match Schedule</h2>
             <button onClick={() => setIsGameModalOpen(true)} className="bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ Schedule Match</button>
           </div>
           {games.map(g => (
             <div key={g.id} className="flex justify-between items-center p-4 border-b">
               <div><span className="font-bold">{g.opponent}</span> <span className="text-xs text-gray-400 ml-2">{g.date}</span></div>
               <button onClick={async () => { await supabase.from('games').delete().eq('id', g.id); fetchData(); }} className="text-red-400"><Trash2 size={18}/></button>
             </div>
           ))}
        </div>
      )}

      {/* DRILLS TAB WITH ADD BUTTON */}
      {activeTab === 'drills' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
           <div className="flex justify-between mb-6">
             <h2 className="font-black uppercase">Training Lab</h2>
             <button onClick={() => setIsDrillModalOpen(true)} className="bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ New Video</button>
           </div>
           {drills.map(d => (
             <div key={d.id} className="flex justify-between p-4 border-b">
               <span className="font-bold">{d.title}</span>
               <button onClick={async () => { await supabase.from('drills').delete().eq('id', d.id); fetchData(); }} className="text-red-400"><Trash2 size={18}/></button>
             </div>
           ))}
        </div>
      )}

      {/* PARENTS TAB */}
      {activeTab === 'parents' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
              <tr><th className="px-6 py-4">Parent Name</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold">{u.full_name}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Shield className="inline text-gray-200 hover:text-blue-500 cursor-pointer" onClick={() => {/* Promo Logic */}} />
                    <Trash2 className="inline text-gray-200 hover:text-red-500 cursor-pointer" onClick={() => {/* Delete Logic */}} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: ADD GAME */}
      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <div className="flex justify-between mb-6"><h3 className="font-black uppercase">Schedule Match</h3><X className="cursor-pointer" onClick={() => setIsGameModalOpen(false)} /></div>
            <form onSubmit={handleAddGame} className="space-y-4">
              <input type="date" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewGame({...newGame, date: e.target.value})} />
              <input type="text" placeholder="Opponent" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewGame({...newGame, opponent: e.target.value})} />
              <input type="text" placeholder="Location" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewGame({...newGame, location: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase">Save Game</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD DRILL */}
      {isDrillModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <div className="flex justify-between mb-6"><h3 className="font-black uppercase">New Drill</h3><X className="cursor-pointer" onClick={() => setIsDrillModalOpen(false)} /></div>
            <form onSubmit={handleAddDrill} className="space-y-4">
              <input type="text" placeholder="Title" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewDrill({...newDrill, title: e.target.value})} />
              <input type="text" placeholder="YouTube Link" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewDrill({...newDrill, youtube_url: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase">Publish</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PLAYER */}
      {isEditPlayerModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <div className="flex justify-between mb-6"><h3 className="font-black uppercase">Edit {editingPlayer?.full_name}</h3><X className="cursor-pointer" onClick={() => setIsEditPlayerModalOpen(false)} /></div>
            <form onSubmit={handleUpdatePlayer} className="space-y-4">
              <input type="text" placeholder="Position" className="w-full border p-4 rounded-xl font-bold" value={playerForm.position} onChange={e => setPlayerForm({...playerForm, position: e.target.value})} />
              <input type="text" placeholder="Jersey #" className="w-full border p-4 rounded-xl font-bold" value={playerForm.jersey_number} onChange={e => setPlayerForm({...playerForm, jersey_number: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase">Save Player</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}