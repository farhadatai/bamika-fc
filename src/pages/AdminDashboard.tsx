import React, { useEffect, useState } from 'react'; 
import { supabase } from '../lib/supabase'; 
import { Shield, X, Trash2, Plus, Mail, Upload } from 'lucide-react'; 
import { Link, useNavigate } from 'react-router-dom'; 
import { useAuthStore } from '../store/auth';
import AdminHUD from '../components/AdminHUD'; 
import Announcements from '../components/Announcements'; // Ensure this exists

// --- SUB-COMPONENTS (Modals) --- 

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
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">First Name</label> 
            <input required className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={e => setNewCoach({...newCoach, first_name: e.target.value})} /> 
          </div> 
          <div> 
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Last Name</label> 
            <input required className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={e => setNewCoach({...newCoach, last_name: e.target.value})} /> 
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

// --- MAIN DASHBOARD --- 

export default function AdminDashboard() { 
  const navigate = useNavigate();
  const { userRole } = useAuthStore();
  const [activeTab, setActiveTab] = useState('parents');

  useEffect(() => {
    if (userRole && userRole !== 'admin') {
      navigate('/dashboard');
    }
  }, [userRole, navigate]);

  const [sortOrder, setSortOrder] = useState({ column: 'last_name', ascending: true });
  const [data, setData] = useState({ 
    parents: [], 
    coaches: [], 
    roster: [], 
    games: [], 
    drills: [], 
  }); 
  const [loading, setLoading] = useState(true); 

  // Modal Visibility 
  const [isGameModalOpen, setIsGameModalOpen] = useState(false); 
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false); 
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false); 

  // Form State 
  const [newGame, setNewGame] = useState({ date: '', opponent: '', location: 'Home' }); 
  const [newCoach, setNewCoach] = useState({ first_name: '', last_name: '', email: '', role: 'Coach', bio: '', photo_url: '' }); 
  const [newDrill, setNewDrill] = useState({ title: '', video_url: '', category: 'Dribbling', difficulty: 'Beginner', duration: 15 }); 

  const handleSort = (column: string) => {
    setSortOrder(prev => ({
      column,
      ascending: prev.column === column ? !prev.ascending : true,
    }));
  };

  const fetchData = async () => { 
    setLoading(true); 
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'user').order(sortOrder.column, { ascending: sortOrder.ascending }); 
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
  }, [sortOrder]); 

  const handleAddGame = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const { error } = await supabase.from('games').insert([newGame]); 
    if (!error) { 
      setNewGame({ date: '', opponent: '', location: 'Home' }); 
      setIsGameModalOpen(false); 
      fetchData(); 
    } 
  }; 

  const handleOnboardSubmit = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const { data: profile, error: pError } = await supabase.from('profiles').insert([{ 
      first_name: newCoach.first_name, 
      last_name: newCoach.last_name, 
      email: newCoach.email, 
      role: 'coach', 
      photo_url: newCoach.photo_url 
    }]).select().single(); 

    if (pError) return alert(pError.message); 

    const { error: cError } = await supabase.from('coaches').insert([{ 
      id: profile.id, 
      name: `${newCoach.first_name} ${newCoach.last_name}`, 
      role: newCoach.role, 
      bio: newCoach.bio, 
      is_published: true 
    }]); 

    if (!cError) { 
      setIsOnboardModalOpen(false); 
      fetchData(); 
    } 
  }; 

  const handleAddDrill = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    const { error } = await supabase.from('drills').insert([newDrill]); 
    if (!error) { 
      setIsDrillModalOpen(false); 
      fetchData(); 
    } 
  }; 

  const handleDeleteGame = async (id: string) => { 
    if (!window.confirm('Delete match?')) return; 
    await supabase.from('games').delete().eq('id', id); 
    fetchData(); 
  }; 

  const handleDeleteParent = async (id: string) => { 
    if (!window.confirm('Are you sure you want to delete this parent and all associated data?')) return; 
    await supabase.from('profiles').delete().eq('id', id); 
    fetchData(); 
  }; 

  const handleAssignTeam = async (coachId: string, teamId: string) => { 
    const { error } = await supabase.from('coaches').update({ team_id: teamId }).eq('id', coachId); 
    if (!error) fetchData(); 
  }; 

  if (loading) { 
    return ( 
      <div className="min-h-screen bg-black flex items-center justify-center"> 
        <div className="text-[#EF4444] font-black uppercase italic animate-pulse"> 
          Syncing Bamika... 
        </div> 
      </div> 
    ); 
  } 

  return ( 
    <div className="space-y-8 p-6 bg-black min-h-screen max-w-7xl mx-auto"> 
      <AdminHUD />

      {/* 2. TAB NAVIGATION */} 
      <div className="flex gap-2 p-1 bg-neutral-900 rounded-2xl border border-gray-800 w-fit"> 
        {['parents', 'coaches', 'roster', 'schedule', 'drills', 'announcements'].map((tab) => ( 
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
          <div className="bg-neutral-900 border border-gray-800 rounded-3xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-800 bg-neutral-800/50">
                  <th onClick={() => handleSort('last_name')} className="p-4 text-left text-xs font-bold uppercase text-gray-500 tracking-wider cursor-pointer hover:text-white">Last Name</th>
                  <th onClick={() => handleSort('first_name')} className="p-4 text-left text-xs font-bold uppercase text-gray-500 tracking-wider cursor-pointer hover:text-white">First Name</th>
                  <th onClick={() => handleSort('email')} className="p-4 text-left text-xs font-bold uppercase text-gray-500 tracking-wider cursor-pointer hover:text-white">Email Address</th>
                  <th className="p-4 text-left text-xs font-bold uppercase text-gray-500 tracking-wider">Phone Number</th>
                  <th className="p-4 text-right text-xs font-bold uppercase text-gray-500 tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.parents.map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-800 hover:bg-neutral-800 transition-colors">
                    <td className="p-4 text-white font-bold uppercase italic">{u.last_name}</td>
                    <td className="p-4 text-white font-bold">{u.first_name}</td>
                    <td className="p-4 text-gray-400">{u.email}</td>
                    <td className="p-4 text-gray-400">{u.phone}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <Link to={`/admin/parent/${u.id}`} className="text-white font-bold hover:text-[#EF4444] transition-colors">Edit</Link>
                        <button onClick={() => handleDeleteParent(u.id)} className="text-gray-600 hover:text-red-500">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )} 

        {activeTab === 'coaches' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.coaches.map((coach: any) => (
              <div key={coach.id} className="bg-neutral-900 border border-gray-800 rounded-2xl p-6 group flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                  <img src={coach.profiles?.photo_url || "https://via.placeholder.com/150"} className="h-16 w-16 object-cover rounded-full border-2 border-gray-800" />
                  <div>
                    <h3 className="text-lg font-black uppercase italic text-white">{coach.name}</h3>
                    <p className="text-[#EF4444] text-[10px] font-black uppercase">{coach.role}</p>
                  </div>
                </div>
                <select
                  className="w-full bg-black border border-gray-800 p-3 rounded-xl text-xs text-white font-bold outline-none focus:border-[#EF4444]"
                  value={coach.team_id || ''}
                  onChange={(e) => handleAssignTeam(coach.id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  <option value="u10">U10 Junior Academy</option>
                  <option value="u12">U12 Competitive</option>
                  <option value="elite">Elite Performance</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'roster' && (
          <div className="grid gap-2">
            {data.roster.map((p: any) => (
              <div key={p.id} className="p-4 bg-neutral-900 border border-gray-800 rounded-xl flex justify-between items-center">
                <span className="text-white font-bold">{p.first_name} {p.last_name}</span>
                <span className="text-[#EF4444] text-[10px] font-black uppercase">{p.team_assigned || 'UNASSIGNED'}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <button onClick={() => setIsGameModalOpen(true)} className="bg-[#EF4444] text-white px-6 py-3 rounded-lg font-black text-xs uppercase shadow-lg hover:bg-red-700">
              + Schedule Match
            </button>
            {data.games.map((g: any) => (
              <div key={g.id} className="p-4 bg-neutral-900 border border-gray-800 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-black uppercase italic text-white">{g.opponent}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">{g.date} • {g.location}</div>
                </div>
                <button onClick={() => handleDeleteGame(g.id)} className="text-gray-600 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'announcements' && <Announcements />}

        {activeTab === 'drills' && (
          <div className="grid gap-2">
            {data.drills.map((d: any) => (
              <div key={d.id} className="p-4 bg-neutral-900 border border-gray-800 rounded-xl flex justify-between items-center">
                <span className="text-white font-bold">{d.title}</span>
              </div>
            ))}
          </div>
        )}
      </div> 

      {/* 4. MODALS */} 
      {isOnboardModalOpen && ( 
        <OnboardModal 
          onClose={() => setIsOnboardModalOpen(false)} 
          onSubmit={handleOnboardSubmit} 
          newCoach={newCoach} 
          setNewCoach={setNewCoach} 
        /> 
      )} 
      
      {isDrillModalOpen && ( 
        <DrillModal 
          onClose={() => setIsDrillModalOpen(false)} 
          onSubmit={handleAddDrill} 
          newDrill={newDrill} 
          setNewDrill={setNewDrill} 
        /> 
      )} 

      {isGameModalOpen && ( 
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"> 
          <div className="bg-neutral-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl"> 
            <div className="p-6 border-b border-gray-800 flex justify-between items-center"> 
              <h3 className="text-white font-black uppercase italic">New Match</h3> 
              <X className="cursor-pointer text-gray-500" onClick={() => setIsGameModalOpen(false)} /> 
            </div> 
            <form onSubmit={handleAddGame} className="p-8 space-y-4"> 
              <input type="date" required value={newGame.date} className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewGame({ ...newGame, date: e.target.value })} /> 
              <input type="text" placeholder="Opponent Name" required value={newGame.opponent} className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewGame({ ...newGame, opponent: e.target.value })} /> 
              <input type="text" placeholder="Location" value={newGame.location} className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none" onChange={(e) => setNewGame({ ...newGame, location: e.target.value })} /> 
              <button type="submit" className="w-full bg-[#EF4444] text-white py-4 rounded-xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all"> 
                Schedule Match 
              </button> 
            </form> 
          </div> 
        </div> 
      )} 
    </div> 
  ); 
}