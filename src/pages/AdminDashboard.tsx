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

  // Modals
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isEditPlayerModalOpen, setIsEditPlayerModalOpen] = useState(false);
  
  // Forms
  const [newDrill, setNewDrill] = useState({ title: '', youtube_url: '', category: 'Dribbling', description: '' });
  const [newGame, setNewGame] = useState({ date: '', opponent: '', location: '', time: '' });
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [playerForm, setPlayerForm] = useState({ position: '', team_assigned: '', jersey_number: '', coach_id: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from('profiles').select('*').eq('role', 'user');
      const { data: c } = await supabase.from('coaches').select('*, profiles(photo_url)');
      const { data: pl } = await supabase.from('players').select('*');
      const { data: g } = await supabase.from('games').select('*');
      const { data: d } = await supabase.from('drills').select('*');
      
      setUsers(p || []);
      setCoaches(c || []);
      setRosterPlayers(pl || []);
      setGames(g || []);
      setDrills(d || []);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('players').update(playerForm).eq('id', editingPlayer.id);
    setIsEditPlayerModalOpen(false);
    fetchData();
  };

  if (loading) return <div className="p-20 text-center font-black uppercase italic tracking-tighter">Updating Bamika Command Center...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      <h1 className="text-3xl font-black text-gray-900 uppercase italic">Admin <span className="text-[#EF4444]">Dashboard</span></h1>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        {['parents', 'roster', 'coaches', 'schedule', 'drills'].map((t) => (
          <button 
            key={t} 
            className={`px-6 py-4 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === t ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-50'}`} 
            onClick={() => setActiveTab(t as any)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 1. PARENTS TAB */}
      {activeTab === 'parents' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr><th className="px-6 py-4">Parent Name</th><th className="px-6 py-4">Email</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold">{u.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={async () => { 
                      await supabase.from('profiles').update({role: 'coach'}).eq('id', u.id);
                      await supabase.from('coaches').insert([{id: u.id, full_name: u.full_name}]);
                      fetchData();
                    }} title="Promote to Coach"><Shield className="inline text-gray-300 hover:text-blue-500" size={18} /></button>
                    <button onClick={async () => { if(confirm('Delete user?')) { await supabase.from('profiles').delete().eq('id', u.id); fetchData(); }}}><Trash2 className="inline text-gray-300 hover:text-red-500" size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. ROSTER TAB */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr><th className="px-6 py-4">Player</th><th className="px-6 py-4">Team</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rosterPlayers.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden border">
                      {p.photo_url ? <img src={p.photo_url} className="h-full w-full object-cover" /> : <Users className="m-auto h-full text-gray-200" />}
                    </div>
                    <div>
                      <div className="font-bold">{p.full_name}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-black">{p.date_of_birth || 'No DOB'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-black text-[#EF4444] uppercase tracking-tighter">{p.team_assigned || 'Unassigned'}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => { setEditingPlayer(p); setPlayerForm({position: p.position || '', team_assigned: p.team_assigned || '', jersey_number: p.jersey_number || '', coach_id: p.coach_id || ''}); setIsEditPlayerModalOpen(true); }} className="text-gray-400 hover:text-blue-600"><Pencil size={18}/></button>
                    <button onClick={async () => { if(confirm('Delete Player?')) { await supabase.from('players').delete().eq('id', p.id); fetchData(); }}} className="text-gray-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. COACHES TAB */}
      {activeTab === 'coaches' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr><th className="px-6 py-4">Coach Profile</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coaches.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden border">
                      {c.profiles?.photo_url ? <img src={c.profiles.photo_url} className="h-full w-full object-cover" /> : <Users className="m-auto h-full text-gray-200" />}
                    </div>
                    <span className="font-bold">{c.full_name}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={async () => { if(confirm('Remove Coach?')) { await supabase.from('coaches').delete().eq('id', c.id); await supabase.from('profiles').update({role: 'user'}).eq('id', c.id); fetchData(); }}} className="text-gray-400 hover:text-red-600"><Trash2 size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. SCHEDULE TAB */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black uppercase italic text-sm tracking-widest">Upcoming Matches</h3>
            <button onClick={() => setIsGameModalOpen(true)} className="bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ Schedule</button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b">
              <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Opponent</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {games.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-xs font-bold text-gray-500 italic">{g.date}</td>
                  <td className="px-6 py-4 font-black uppercase">{g.opponent}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={async () => { if(confirm('Delete Game?')) { await supabase.from('games').delete().eq('id', g.id); fetchData(); }}}><Trash2 className="text-gray-300 hover:text-red-600" size={18}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. DRILLS TAB */}
      {activeTab === 'drills' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black uppercase italic text-sm tracking-widest">Training Lab Manager</h3>
            <button onClick={() => setIsDrillModalOpen(true)} className="bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ New Video</button>
          </div>
          <div className="p-6 space-y-4">
            {drills.map(d => (
              <div key={d.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="font-bold">{d.title}</span>
                <button onClick={async () => { if(confirm('Delete Drill?')) { await supabase.from('drills').delete().eq('id', d.id); fetchData(); }}}><Trash2 className="text-gray-300 hover:text-red-600" size={18}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALS SECTION */}
      {isEditPlayerModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 bg-gray-50 border-b flex justify-between"><h3 className="font-black uppercase italic">Edit {editingPlayer?.full_name}</h3><X className="cursor-pointer" onClick={() => setIsEditPlayerModalOpen(false)} /></div>
            <form onSubmit={handleUpdatePlayer} className="p-8 space-y-4">
              <input type="text" placeholder="Position" className="w-full border p-4 rounded-xl font-bold" value={playerForm.position} onChange={e => setPlayerForm({...playerForm, position: e.target.value})} />
              <input type="text" placeholder="Jersey #" className="w-full border p-4 rounded-xl font-bold" value={playerForm.jersey_number} onChange={e => setPlayerForm({...playerForm, jersey_number: e.target.value})} />
              <select className="w-full border p-4 rounded-xl font-bold" value={playerForm.coach_id} onChange={e => setPlayerForm({...playerForm, coach_id: e.target.value})}>
                <option value="">No Coach Assigned</option>
                {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase">Save Player</button>
            </form>
          </div>
        </div>
      )}

      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <div className="flex justify-between mb-6"><h3 className="font-black uppercase italic">New Match</h3><X className="cursor-pointer" onClick={() => setIsGameModalOpen(false)} /></div>
            <form onSubmit={async (e) => { e.preventDefault(); await supabase.from('games').insert([newGame]); setIsGameModalOpen(false); fetchData(); }} className="space-y-4">
              <input type="date" className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewGame({...newGame, date: e.target.value})} />
              <input type="text" placeholder="Opponent" className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewGame({...newGame, opponent: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase">Schedule Match</button>
            </form>
          </div>
        </div>
      )}

      {isDrillModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <div className="flex justify-between mb-6"><h3 className="font-black uppercase italic">New Drill Video</h3><X className="cursor-pointer" onClick={() => setIsDrillModalOpen(false)} /></div>
            <form onSubmit={async (e) => { e.preventDefault(); await supabase.from('drills').insert([newDrill]); setIsDrillModalOpen(false); fetchData(); }} className="space-y-4">
              <input type="text" placeholder="Video Title" className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewDrill({...newDrill, title: e.target.value})} />
              <input type="text" placeholder="YouTube Link" className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewDrill({...newDrill, youtube_url: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase">Publish Video</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}