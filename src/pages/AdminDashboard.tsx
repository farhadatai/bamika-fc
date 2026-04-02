import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Pencil, Trash2, Calendar, Shield, Users, Video, Plus } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('parents');
  const [data, setData] = useState({ parents: [], roster: [], coaches: [], games: [], drills: [] });
  const [loading, setLoading] = useState(true);

  // Modal and Form States
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [newDrill, setNewDrill] = useState({ title: '', youtube_url: '', category: 'Dribbling', description: '' });
  const [newGame, setNewGame] = useState({ date: '', opponent: '', location: '', time: '' });

  const fetchData = async () => {
    setLoading(true);
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'user');
    const { data: c } = await supabase.from('coaches').select('*, profiles(photo_url)');
    const { data: pl } = await supabase.from('players').select('*');
    const { data: g } = await supabase.from('games').select('*');
    const { data: d } = await supabase.from('drills').select('*');
    
    setData({ 
      parents: p || [], 
      coaches: c || [], 
      roster: pl || [], 
      games: g || [], 
      drills: d || [] 
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="p-20 text-center font-bold uppercase italic">Syncing Bamika...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-black uppercase italic">Admin <span className="text-[#EF4444]">Dashboard</span></h1>
      
      {/* NAVIGATION TABS */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        {['parents', 'roster', 'coaches', 'schedule', 'drills'].map((t) => (
          <button 
            key={t} 
            className={`px-6 py-4 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === t ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-50'}`} 
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        {activeTab === 'parents' && data.parents.map((u: any) => (
          <div key={u.id} className="p-4 border-b flex justify-between font-bold">
            {u.full_name} 
            <Shield className="text-gray-200 hover:text-blue-500 cursor-pointer" size={18} />
          </div>
        ))}

        {activeTab === 'roster' && data.roster.map((p: any) => (
          <div key={p.id} className="p-4 border-b flex justify-between font-bold">
            {p.full_name} 
            <span className="text-[#EF4444] uppercase text-xs font-black">{p.team_assigned || 'Unassigned'}</span>
          </div>
        ))}

        {activeTab === 'coaches' && data.coaches.map((c: any) => (
          <div key={c.id} className="p-4 border-b flex items-center gap-4 font-bold">
             <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 border">
               {c.profiles?.photo_url ? <img src={c.profiles.photo_url} className="h-full w-full object-cover" /> : <Users className="m-auto text-gray-200" />}
             </div>
             {c.full_name}
          </div>
        ))}

        {activeTab === 'schedule' && (
          <div>
            <button onClick={() => setIsGameModalOpen(true)} className="mb-4 bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ Schedule Match</button>
            {data.games.map((g: any) => (
              <div key={g.id} className="p-4 border-b flex justify-between items-center font-bold uppercase">
                {g.opponent} — {g.date}
                <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('games').delete().eq('id', g.id); fetchData(); }}}><Trash2 size={16} className="text-gray-300 hover:text-red-500"/></button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'drills' && (
          <div>
            <button onClick={() => setIsDrillModalOpen(true)} className="mb-4 bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ New Drill</button>
            {data.drills.map((d: any) => (
              <div key={d.id} className="p-4 border-b flex justify-between items-center font-bold">
                {d.title}
                <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('drills').delete().eq('id', d.id); fetchData(); }}}><Trash2 size={16} className="text-gray-300 hover:text-red-500"/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD GAME MODAL */}
      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <div className="flex justify-between mb-6"><h3 className="font-black uppercase italic">New Match</h3><X className="cursor-pointer" onClick={() => setIsGameModalOpen(false)} /></div>
            <form onSubmit={async (e) => { e.preventDefault(); await supabase.from('games').insert([newGame]); setIsGameModalOpen(false); fetchData(); }} className="space-y-4">
              <input type="date" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewGame({...newGame, date: e.target.value})} />
              <input type="text" placeholder="Opponent" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewGame({...newGame, opponent: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase tracking-widest">Schedule</button>
            </form>
          </div>
        </div>
      )}

      {/* ADD DRILL MODAL */}
      {isDrillModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <div className="flex justify-between mb-6"><h3 className="font-black uppercase italic">New Drill</h3><X className="cursor-pointer" onClick={() => setIsDrillModalOpen(false)} /></div>
            <form onSubmit={async (e) => { e.preventDefault(); await supabase.from('drills').insert([newDrill]); setIsDrillModalOpen(false); fetchData(); }} className="space-y-4">
              <input type="text" placeholder="Title" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewDrill({...newDrill, title: e.target.value})} />
              <input type="text" placeholder="YouTube Link" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewDrill({...newDrill, youtube_url: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase tracking-widest">Publish</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;