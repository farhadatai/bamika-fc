import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Users, Calendar, X, Plus, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('parents');
  const [data, setData] = useState({ parents: [], roster: [], coaches: [], games: [], drills: [] });
  const [loading, setLoading] = useState(true);

  // Modal State for Scheduling
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [newGame, setNewGame] = useState({ date: '', opponent: '', location: 'Home' });

  const fetchData = async () => {
    setLoading(true);
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'user');
    const { data: c } = await supabase.from('coaches').select('*, profiles(photo_url)');
    const { data: pl } = await supabase.from('players').select('*');
    const { data: g } = await supabase.from('games').select('*').order('date', { ascending: true });
    const { data: d } = await supabase.from('drills').select('*');
    
    setData({ parents: p || [], coaches: c || [], roster: pl || [], games: g || [], drills: d || [] });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('games').insert([newGame]);
    if (!error) {
      setIsGameModalOpen(false);
      fetchData();
    }
  };

  if (loading) return <div className="p-20 text-center font-black uppercase italic">Syncing Bamika...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 font-sans">
      <h1 className="text-3xl font-black uppercase italic">Admin <span className="text-[#EF4444]">Dashboard</span></h1>
      
      {/* TABS */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        {['parents', 'roster', 'coaches', 'schedule', 'drills'].map((t) => (
          <button key={t} className={`px-6 py-4 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === t ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-50'}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
        {activeTab === 'parents' && data.parents.map((u: any) => (
          <div key={u.id} className="p-4 border-b flex justify-between font-bold text-gray-700">{u.full_name} <Shield size={18} className="text-gray-200 hover:text-blue-500 cursor-pointer" /></div>
        ))}

        {activeTab === 'roster' && data.roster.map((p: any) => (
          <div key={p.id} className="p-4 border-b flex justify-between font-bold text-gray-700">{p.full_name} <span className="text-[#EF4444] text-[10px] font-black uppercase">{p.team_assigned || 'UNASSIGNED'}</span></div>
        ))}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <button onClick={() => setIsGameModalOpen(true)} className="bg-[#EF4444] text-white px-6 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all">+ Schedule Match</button>
            {data.games.map((g: any) => (
              <div key={g.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                <div>
                  <div className="font-black uppercase italic text-gray-900">{g.opponent}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">{g.date} • {g.location}</div>
                </div>
                <button onClick={async () => { if(confirm('Delete match?')) { await supabase.from('games').delete().eq('id', g.id); fetchData(); }}}><Trash2 size={18} className="text-gray-300 hover:text-red-500" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SCHEDULE MODAL */}
      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-black uppercase italic tracking-tighter">New Match</h3>
              <X className="cursor-pointer text-gray-400" onClick={() => setIsGameModalOpen(false)} />
            </div>
            <form onSubmit={handleAddGame} className="p-8 space-y-4">
              <input type="date" required className="w-full border p-4 rounded-xl font-bold focus:border-[#EF4444] outline-none" onChange={e => setNewGame({...newGame, date: e.target.value})} />
              <input type="text" placeholder="Opponent Name" required className="w-full border p-4 rounded-xl font-bold focus:border-[#EF4444] outline-none" onChange={e => setNewGame({...newGame, opponent: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all">Schedule Match</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}