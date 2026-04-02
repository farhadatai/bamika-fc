import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  X, Pencil, Trash2, Calendar, Clock, MapPin, Users, 
  UserPlus, Shield, ChevronDown, ChevronUp, Video, PlayCircle, Plus 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'parents' | 'roster' | 'coaches' | 'schedule' | 'drills'>('parents');
  const [users, setUsers] = useState<any[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [games, setGames] = useState<any[]>([]);
  const [drills, setDrills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Parents
      const { data: pData } = await supabase.from('profiles').select('*').eq('role', 'user');
      if (pData) setUsers(pData);

      // 2. Coaches (Try with and without !inner to ensure it doesn't fail if photo is missing)
      const { data: cData } = await supabase.from('coaches').select('id, full_name, profiles(photo_url)');
      if (cData) setCoaches(cData);

      // 3. Roster (Players) - Fetching all columns to be safe
      const { data: plData } = await supabase.from('players').select('*');
      if (plData) setRosterPlayers(plData);

      // 4. Games - Fetching all columns
      const { data: gData } = await supabase.from('games').select('*');
      if (gData) setGames(gData);

      // 5. Drills
      const { data: dData } = await supabase.from('drills').select('*');
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
    } catch (err) { alert("Error promoting"); }
  };

  if (loading) return <div className="p-20 text-center font-black uppercase italic">Refreshing Bamika Data...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-gray-900 uppercase italic">Admin <span className="text-[#EF4444]">Dashboard</span></h1>
        {/* Link back to public home if needed */}
        <Link to="/" className="text-xs font-bold text-gray-400 hover:text-black">Back to Website</Link>
      </div>

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

      {/* TAB: PARENTS */}
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
                    <button onClick={() => handleMakeCoach(u)} className="text-gray-400 hover:text-blue-600"><Shield size={18} /></button>
                    <button className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: ROSTER (REPAIRED) */}
      {activeTab === 'roster' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4">Player</th>
                <th className="px-6 py-4">Team</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rosterPlayers.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold">{p.full_name || p.name}</td>
                  <td className="px-6 py-4 text-xs font-black uppercase text-[#EF4444]">{p.team_assigned || 'Unassigned'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('players').delete().eq('id', p.id); fetchData(); }}} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {rosterPlayers.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-gray-400">No players found in database.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: COACHES */}
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
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 border">{c.profiles?.photo_url ? <img src={c.profiles.photo_url} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold text-gray-300">?</div>}</div>
                    <span className="font-bold">{c.full_name}</span>
                  </td>
                  <td className="px-6 py-4 text-right"><button className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: SCHEDULE (REPAIRED) */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
              <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Opponent</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {games.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{g.date}</td>
                  <td className="px-6 py-4 font-bold">{g.opponent}</td>
                  <td className="px-6 py-4 text-right">
                     <button onClick={async () => { if(confirm('Delete?')) { await supabase.from('games').delete().eq('id', g.id); fetchData(); }}} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {games.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-gray-400">No games scheduled.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: DRILLS */}
      {activeTab === 'drills' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
           <h2 className="font-black uppercase mb-4">Drills Lab</h2>
           {drills.map(d => (
             <div key={d.id} className="flex justify-between p-3 border-b">{d.title} <button onClick={async () => { await supabase.from('drills').delete().eq('id', d.id); fetchData(); }} className="text-red-400"><Trash2 size={16}/></button></div>
           ))}
        </div>
      )}
    </div>
  );
}