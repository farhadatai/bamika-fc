import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Users, X, Trash2, Plus, Mail, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

// MODAL COMPONENTS
const OnboardModal = ({ onClose, onSubmit, newCoach, setNewCoach }) => (
  <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[150] p-4 backdrop-blur-md">
    <div className="bg-neutral-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
      <div className="p-8 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-neutral-900 z-10">
        <h2 className="text-2xl font-black uppercase italic text-white">Onboard New <span className="text-[#EF4444]">Coach</span></h2>
        <X className="text-gray-500 cursor-pointer hover:text-white" onClick={onClose} />
      </div>
      <form onSubmit={onSubmit} className="p-8 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Full Name</label>
            <input required className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={e => setNewCoach({...newCoach, full_name: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Email Address</label>
            <input required type="email" className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={e => setNewCoach({...newCoach, email: e.target.value})} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Primary Role</label>
            <select className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none appearance-none" onChange={e => setNewCoach({...newCoach, role: e.target.value})}>
              <option>Head Coach</option>
              <option>Assistant Coach</option>
              <option>Goalkeeper Coach</option>
              <option>Technical Director</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Photo URL</label>
            <input placeholder="https://..." className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={e => setNewCoach({...newCoach, photo_url: e.target.value})} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Professional Bio</label>
          <textarea rows={4} className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none resize-none" placeholder="Describe the coach's experience and philosophy..." onChange={e => setNewCoach({...newCoach, bio: e.target.value})} />
        </div>
        <button type="submit" className="w-full bg-[#EF4444] text-white py-5 rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20">
          Complete Onboarding
        </button>
      </form>
    </div>
  </div>
);

const DrillModal = ({ onClose, onSubmit, newDrill, setNewDrill }) => (
  <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[150] p-4 backdrop-blur-md">
    <div className="bg-neutral-900 border border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
      <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-neutral-950">
        <h2 className="text-2xl font-black uppercase italic text-white">Add Lab <span className="text-[#EF4444]">Content</span></h2>
        <X className="text-gray-500 cursor-pointer hover:text-white" onClick={onClose} />
      </div>
      <form onSubmit={onSubmit} className="p-8 space-y-6">
        <div>
          <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">YouTube Video URL</label>
          <input required placeholder="https://www.youtube.com/watch?v=..." className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none transition-all" onChange={(e) => setNewDrill({ ...newDrill, video_url: e.target.value })} />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Drill Title</label>
            <input required className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewDrill({ ...newDrill, title: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Category</label>
            <select className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none appearance-none" onChange={(e) => setNewDrill({ ...newDrill, category: e.target.value })}>
              <option>Dribbling</option>
              <option>Passing</option>
              <option>Shooting</option>
              <option>Tactical</option>
              <option>Physical</option>
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Difficulty</label>
            <select className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewDrill({ ...newDrill, difficulty: e.target.value })}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
              <option>Pro</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Duration (Minutes)</label>
            <input type="number" placeholder="e.g. 15" className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewDrill({ ...newDrill, duration: parseInt(e.target.value) })} />
          </div>
        </div>
        <button type="submit" className="w-full bg-[#EF4444] text-white py-5 rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-3">
          <Upload size={20} /> Publish to Lab
        </button>
      </form>
    </div>
  </div>
);

const EditParentModal = ({ parent, onClose }) => (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center">
        <div className="bg-neutral-900 p-8 rounded-2xl border border-gray-800">
            <h2 className="text-white font-black text-2xl">Editing {parent.full_name}</h2>
            <button onClick={onClose} className="text-white mt-4">Close</button>
        </div>
    </div>
);

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('parents');
  const [data, setData] = useState({
    parents: [],
    roster: [],
    coaches: [],
    games: [],
    drills: [],
  });
  const [loading, setLoading] = useState(true);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [newGame, setNewGame] = useState({
    date: '',
    opponent: '',
    location: 'Home',
  });
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [newCoach, setNewCoach] = useState({
    full_name: '',
    email: '',
    role: 'Coach',
    specialization: 'Technical',
    bio: '',
    photo_url: ''
  });
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [newDrill, setNewDrill] = useState({
    title: '',
    category: 'Dribbling',
    video_url: '',
    difficulty: 'Beginner',
    duration: 15,
    description: ''
  });
  const [editingParent, setEditingParent] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'user');
    const { data: c } = await supabase.from('coaches').select('*, profiles(photo_url)');
    const { data: pl } = await supabase.from('players').select('*');
    const { data: g } = await supabase.from('games').select('*').order('date', { ascending: true });
    const { data: d } = await supabase.from('drills').select('*');
    setData({
      parents: p || [],
      coaches: c || [],
      roster: pl || [],
      games: g || [],
      drills: d || [],
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('games').insert([newGame]);
    if (!error) {
      setNewGame({ date: '', opponent: '', location: 'Home' });
      setIsGameModalOpen(false);
      fetchData();
    }
  };

  const getYoutubeThumbnail = (url: string) => {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      const videoId = match[2];
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    return "https://via.placeholder.com/1280x720?text=No+Thumbnail";
  };

  const handleAddDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    const thumbnail_url = getYoutubeThumbnail(newDrill.video_url);
    const { error } = await supabase.from('drills').insert([{ ...newDrill, thumbnail_url }]);
    if (!error) {
      setIsDrillModalOpen(false);
      fetchData();
    }
  };

  const handleDeleteGame = async (id: string) => {
    const confirmed = window.confirm('Delete match?');
    if (!confirmed) return;
    await supabase.from('games').delete().eq('id', id);
    fetchData();
  };

  const handleAssignTeam = async (coachId: string, teamId: string) => {
    const { error } = await supabase
      .from('coaches')
      .update({ team_id: teamId })
      .eq('id', coachId);
    if (!error) {
      fetchData();
    } else {
      alert("Error updating assignment: " + error.message);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: profile, error: pError } = await supabase
      .from('profiles')
      .insert([{
        full_name: newCoach.full_name,
        email: newCoach.email,
        role: 'coach',
        photo_url: newCoach.photo_url
      }])
      .select()
      .single();
    if (pError) return alert(pError.message);
    const { error: cError } = await supabase
      .from('coaches')
      .insert([{
        id: profile.id,
        name: newCoach.full_name,
        role: newCoach.role,
        bio: newCoach.bio,
        is_published: true
      }]);
    if (!cError) {
      setIsOnboardModalOpen(false);
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-[#EF4444] font-black uppercase italic animate-pulse">
          Loading Data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase italic text-white tracking-tighter">
            ADMIN <span className="text-[#EF4444]">DASHBOARD</span>
          </h1>
          <p className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mt-1">
            Club Command Center • {data.parents.length} Members
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsOnboardModalOpen(true)} className="bg-[#EF4444] text-white px-6 py-3 rounded-xl font-black uppercase italic text-xs hover:bg-red-700 transition-all shadow-lg shadow-red-500/20">
            + Onboard Coach
          </button>
          <button onClick={() => setIsDrillModalOpen(true)} className="bg-neutral-800 text-white px-6 py-3 rounded-xl font-black uppercase italic text-xs hover:bg-neutral-700 transition-all border border-gray-700">
            + New Drill
          </button>
        </div>
      </div>

      {/* 2. TAB NAVIGATION */}
      <div className="flex gap-2 p-1 bg-neutral-900 rounded-2xl border border-gray-800 w-fit">
        {['parents', 'coaches', 'roster', 'games'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
              activeTab === tab ? 'bg-white text-black' : 'text-gray-500 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. MAIN CONTENT AREA */}
      <div className="min-h-[400px]">
        {activeTab === 'parents' && (
          <div className="grid gap-4">
            {data.parents.map((u: any) => (
              <div key={u.id} className="p-4 border-b flex justify-between font-bold text-gray-700 bg-white rounded-lg">
                <Link to={`/admin/parent/${u.id}`}>{u.full_name}</Link>
                <Shield size={18} className="text-gray-200 hover:text-blue-500 cursor-pointer" />
              </div>
            ))}
          </div>
        )}
        {activeTab === 'coaches' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.coaches.map((coach: any) => (
              <div key={coach.id} className="bg-neutral-900 border border-gray-800 rounded-2xl p-6 group hover:border-[#EF4444] transition-all flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative h-16 w-16">
                    <img src={coach.profiles?.photo_url || "https://via.placeholder.com/150"} className="h-full w-full object-cover rounded-full border-2 border-gray-800 group-hover:border-[#EF4444] transition-colors" />
                    {coach.is_published && (<div className="absolute -top-1 -right-1 bg-green-500 h-4 w-4 rounded-full border-2 border-neutral-900" title="Published to Site"></div>)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase italic text-white leading-tight">{coach.name || coach.profiles?.full_name}</h3>
                    <p className="text-[#EF4444] text-[10px] font-black uppercase tracking-widest">{coach.role || 'Coach'}</p>
                  </div>
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-500 mb-1 block">Assigned Team</label>
                    <select className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs text-white font-bold outline-none focus:border-[#EF4444]" value={coach.team_id || ''} onChange={(e) => handleAssignTeam(coach.id, e.target.value)}>
                      <option value="">Unassigned</option>
                      <option value="u10">U10 Junior Academy</option>
                      <option value="u12">U12 Competitive</option>
                      <option value="u14">U14 Competitive</option>
                      <option value="elite">Elite Performance</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-blue-500/10 text-blue-400 text-[9px] font-black px-2 py-1 rounded uppercase border border-blue-500/20">Technical</span>
                    <span className="bg-purple-500/10 text-purple-400 text-[9px] font-black px-2 py-1 rounded uppercase border border-purple-500/20">Tactical</span>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-800 flex justify-between items-center">
                  <button className="text-gray-500 hover:text-white transition-colors"><Mail size={18} /></button>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-neutral-800 text-white text-[10px] font-black uppercase rounded-lg hover:bg-neutral-700 transition-all">Edit Bio</button>
                    <button className="px-4 py-2 bg-neutral-800 text-white text-[10px] font-black uppercase rounded-lg hover:bg-neutral-700 transition-all">Schedule</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'roster' && (
          <div className="bg-white p-4 rounded-lg">
            {data.roster.map((p: any) => (
              <div key={p.id} className="p-4 border-b flex justify-between items-center font-bold text-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 overflow-hidden border border-gray-200">
                    {p.photo_url ? (<img src={p.photo_url} alt={p.full_name} className="w-full h-full object-cover" />) : (p.full_name.charAt(0))}
                  </div>
                  <span>{p.full_name}</span>
                </div>
                <span className="text-[#EF4444] text-[10px] font-black uppercase">{p.team_assigned || 'UNASSIGNED'}</span>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'games' && (
           <div className="space-y-4">
            <button onClick={() => setIsGameModalOpen(true)} className="bg-[#EF4444] text-white px-6 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all">
              + Schedule Match
            </button>
            {data.games.map((g: any) => (
              <div key={g.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                <div>
                  <div className="font-black uppercase italic text-gray-900">{g.opponent}</div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">{g.date} • {g.location}</div>
                </div>
                <button onClick={() => handleDeleteGame(g.id)}>
                  <Trash2 size={18} className="text-gray-300 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. CONSOLIDATED MODALS */}
      {isOnboardModalOpen && (
        <OnboardModal onClose={() => setIsOnboardModalOpen(false)} onSubmit={handleOnboardSubmit} newCoach={newCoach} setNewCoach={setNewCoach} />
      )}
      {isDrillModalOpen && (
        <DrillModal onClose={() => setIsDrillModalOpen(false)} onSubmit={handleAddDrill} newDrill={newDrill} setNewDrill={setNewDrill} />
      )}
      {editingParent && (
        <EditParentModal parent={editingParent} onClose={() => setEditingParent(null)} />
      )}

      {/* SCHEDULE GAME MODAL - Kept for now */}
      {isGameModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-black uppercase italic tracking-tighter">New Match</h3>
              <X className="cursor-pointer text-gray-400" onClick={() => setIsGameModalOpen(false)} />
            </div>
            <form onSubmit={handleAddGame} className="p-8 space-y-4">
              <input type="date" required value={newGame.date} className="w-full border p-4 rounded-xl font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewGame({ ...newGame, date: e.target.value })} />
              <input type="text" placeholder="Opponent Name" required value={newGame.opponent} className="w-full border p-4 rounded-xl font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewGame({ ...newGame, opponent: e.target.value })} />
              <input type="text" placeholder="Location" value={newGame.location} className="w-full border p-4 rounded-xl font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewGame({ ...newGame, location: e.target.value })} />
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-red-700 transition-all">
                Schedule Match
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}