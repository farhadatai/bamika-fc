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
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // Modal States
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [newDrill, setNewDrill] = useState({ title: '', category: 'Dribbling', youtube_url: '', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Parents
      const { data: pData } = await supabase.from('profiles').select('*').eq('role', 'user');
      if (pData) setUsers(pData);

      // 2. Fetch Coaches (JOINED WITH PROFILES FOR PHOTO)
      const { data: cData } = await supabase.from('coaches').select('id, full_name, profiles!inner(photo_url)');
      if (cData) setCoaches(cData);

      // 3. Fetch Players
      const { data: plData } = await supabase.from('players').select('*, profiles:parent_id(full_name)');
      if (plData) setRosterPlayers(plData);

      // 4. Fetch Games & Drills
      const { data: gData } = await supabase.from('games').select('*');
      const { data: dData } = await supabase.from('drills').select('*');
      if (gData) setGames(gData);
      if (dData) setDrills(dData);
    } finally {
      setLoading(false);
    }
  };

  const handleMakeCoach = async (user: any) => {
    if (!confirm(`Promote ${user.full_name} to Coach?`)) return;
    try {
      await supabase.from('profiles').update({ role: 'coach' }).eq('id', user.id);
      await supabase.from('coaches').insert([{ id: user.id, full_name: user.full_name }]);
      alert("Promotion successful!");
      fetchData();
    } catch (err) {
      alert("Error promoting user");
    }
  };

  if (loading) return <div className="p-20 text-center font-black uppercase italic">Updating Bamika Admin...</div>;

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

      {/* PARENTS TAB WITH PROMOTION BUTTON */}
      {activeTab === 'parents' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
              <tr><th className="px-6 py-4">Parent</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold">{u.full_name}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => handleMakeCoach(u)} className="text-gray-400 hover:text-blue-600" title="Make Coach">
                      <Shield size={18} />
                    </button>
                    <button className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* COACHES TAB WITH WORKING PHOTOS */}
      {activeTab === 'coaches' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
              <tr><th className="px-6 py-4">Coach</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coaches.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                      {c.profiles?.photo_url ? (
                        <img src={c.profiles.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400 font-bold">{c.full_name[0]}</div>
                      )}
                    </div>
                    <span className="font-bold">{c.full_name}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DRILLS TAB (KEEPING THIS AS IS SINCE IT WORKS) */}
      {activeTab === 'drills' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
           <div className="flex justify-between mb-6">
             <h2 className="font-black uppercase">Training Lab</h2>
             <button onClick={() => setIsDrillModalOpen(true)} className="bg-[#EF4444] text-white px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest">+ New Video</button>
           </div>
           <div className="grid gap-4">
             {drills.map(d => (
               <div key={d.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                 <span className="font-bold">{d.title}</span>
                 <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('drills').delete().eq('id', d.id); fetchData(); }}} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
               </div>
             ))}
           </div>
        </div>
      )}

      {/* DRILL MODAL */}
      {isDrillModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-8">
            <h3 className="font-black uppercase mb-6 text-xl">New Lab Video</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await supabase.from('drills').insert([newDrill]);
              setIsDrillModalOpen(false);
              fetchData();
            }} className="space-y-4">
              <input type="text" placeholder="Title" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewDrill({...newDrill, title: e.target.value})} />
              <input type="text" placeholder="YouTube URL" required className="w-full border p-4 rounded-xl font-bold" onChange={e => setNewDrill({...newDrill, youtube_url: e.target.value})} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase tracking-widest">Publish</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}