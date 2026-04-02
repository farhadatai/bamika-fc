import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Pencil, Trash2, Calendar, Shield, Users, Video, Plus } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'parents' | 'roster' | 'coaches' | 'schedule' | 'drills'>('parents');
  const [users, setUsers] = useState<any[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [drills, setDrills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [newDrill, setNewDrill] = useState({ title: '', youtube_url: '', category: 'Dribbling', description: '' });
  const [newGame, setNewGame] = useState({ date: '', opponent: '', location: '', time: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'user');
    const { data: c } = await supabase.from('coaches').select('*, profiles(photo_url)');
    const { data: pl } = await supabase.from('players').select('*');
    const { data: g } = await supabase.from('games').select('*');
    const { data: d } = await supabase.from('drills').select('*');
    setUsers(p || []); setCoaches(c || []); setRosterPlayers(pl || []); setGames(g || []); setDrills(d || []);
    setLoading(false);
  };

  if (loading) return <div className="p-20 text-center font-black uppercase italic">Resetting Admin Dashboard...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 font-sans">
      <h1 className="text-3xl font-black text-gray-900 uppercase italic">Admin <span className="text-[#EF4444]">Dashboard</span></h1>

      {/* TAB NAV */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        {['parents', 'roster', 'coaches', 'schedule', 'drills'].map((t) => (
          <button key={t} className={`px-6 py-4 font-black text-[10px] uppercase tracking-widest ${activeTab === t ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-50'}`} onClick={() => setActiveTab(t as any)}>{t}</button>
        ))}
      </div>

      {/* CONTENT AREA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {activeTab === 'parents' && (
          <table className="w-full text-left">
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold">{u.full_name}</td>
                  <td className="px-6 py-4 text-right"><Shield className="inline text-gray-200 hover:text-blue-500 cursor-pointer" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'roster' && (
          <div className="grid gap-4">
            {rosterPlayers.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 border-b">
                <span className="font-bold">{p.full_name}</span>
                <span className="text-xs font-black text-[#EF4444] uppercase">{p.team_assigned || 'Unassigned'}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'coaches' && (
          <div className="grid gap-4">
            {coaches.map(c => (
              <div key={c.id} className="flex items-center gap-4 p-4 border-b">
                <div className="h-10 w-10 rounded-full bg-gray-100 overflow-hidden border">
                  {c.profiles?.photo_url ? <img src={c.profiles.photo_url} className="h-full w-full object-cover" /> : <Users className="m-auto text-gray-200" />}
                </div>
                <span className="font-bold">{c.full_name}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div>
            <button onClick={() => setIsGameModalOpen(true)} className="mb-4 bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ Schedule</button>
            {games.map(g => <div key={g.id} className="p-4 border-b font-bold">{g.opponent} - {g.date}</div>)}
          </div>
        )}

        {activeTab === 'drills' && (
          <div>
            <button onClick={() => setIsDrillModalOpen(true)} className="mb-4 bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ New Drill</button>
            {drills.map(d => <div key={d.id} className="p-4 border-b font-bold">{d.title}</div>)}
          </div>
        )}
      </div>

      {/* MODALS (Simplified for Build Success) */}
      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-8">
            <div className="flex justify-between mb-4"><h3 className="font-black uppercase">Schedule</h3><X className="cursor-pointer" onClick={() => setIsGameModalOpen(false)} /></div>
            <form onSubmit={async (e) => { e.preventDefault(); await supabase.from('games').insert([newGame]); setIsGameModalOpen(false); fetchData(); }} className="space-y-4">
              <input type="text" placeholder="Opponent" className="w-full border p-4 rounded-xl" onChange={e => setNewGame({...newGame, opponent: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase">Save</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}