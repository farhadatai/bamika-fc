import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Users, Video, Calendar, X } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('parents');
  const [data, setData] = useState({ parents: [], roster: [], coaches: [], games: [], drills: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const { data: p } = await supabase.from('profiles').select('*').eq('role', 'user');
      const { data: c } = await supabase.from('coaches').select('*, profiles(photo_url)');
      const { data: pl } = await supabase.from('players').select('*');
      const { data: g } = await supabase.from('games').select('*');
      const { data: d } = await supabase.from('drills').select('*');
      setData({ parents: p || [], coaches: c || [], roster: pl || [], games: g || [], drills: d || [] });
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) return <div className="p-20 text-center font-bold uppercase italic">Syncing Bamika...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-black uppercase italic">Admin <span className="text-[#EF4444]">Dashboard</span></h1>
      
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        {['parents', 'roster', 'coaches', 'schedule', 'drills'].map((t) => (
          <button key={t} className={`px-6 py-4 font-black text-[10px] uppercase tracking-widest ${activeTab === t ? 'bg-[#EF4444] text-white' : 'text-gray-400 hover:bg-gray-50'}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        {activeTab === 'parents' && data.parents.map((u: any) => (
          <div key={u.id} className="p-4 border-b flex justify-between font-bold">{u.full_name} <Shield className="text-gray-200 hover:text-blue-500 cursor-pointer" size={18} /></div>
        ))}
        {activeTab === 'roster' && data.roster.map((p: any) => (
          <div key={p.id} className="p-4 border-b flex justify-between font-bold">{p.full_name} <span className="text-[#EF4444] uppercase text-xs">{p.team_assigned}</span></div>
        ))}
        {activeTab === 'coaches' && data.coaches.map((c: any) => (
          <div key={c.id} className="p-4 border-b flex items-center gap-4 font-bold">
             <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 border">
               {c.profiles?.photo_url ? <img src={c.profiles.photo_url} className="h-full w-full object-cover" /> : <Users className="m-auto text-gray-200" />}
             </div>
             {c.full_name}
          </div>
        ))}
        {activeTab === 'schedule' && data.games.map((g: any) => (
          <div key={g.id} className="p-4 border-b font-bold uppercase">{g.opponent} — {g.date}</div>
        ))}
        {activeTab === 'drills' && data.drills.map((d: any) => (
          <div key={d.id} className="p-4 border-b font-bold">{d.title}</div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;