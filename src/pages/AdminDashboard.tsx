import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, X, Trash2, Plus, Mail, Upload, Play, ExternalLink, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { TEAM_OPTIONS, getYoutubeId, getYoutubeThumbnail } from '../lib/utils';

// --- SUB-COMPONENTS (Modals) ---

const getInitials = (firstName = '', lastName = '') => {
  const first = firstName?.trim()?.[0] || '';
  const last = lastName?.trim()?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'FC';
};

const splitFullName = (fullName = '') => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

const getParentDisplayName = (parent = {}) => {
  const splitName = splitFullName(parent.full_name || '');
  return {
    firstName: parent.first_name || splitName.firstName,
    lastName: parent.last_name || splitName.lastName,
  };
};

const getPlayerDisplayName = (player = {}) => {
  const splitName = splitFullName(player.full_name || player.name || '');
  const firstName = player.first_name || splitName.firstName;
  const lastName = player.last_name || splitName.lastName;
  return `${firstName || ''} ${lastName || ''}`.trim() || player.full_name || player.name || 'Unnamed Player';
};

const formatAge = (dateOfBirth) => {
  if (!dateOfBirth) return 'Age TBA';

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return 'Age TBA';

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return `${age} years old`;
};

const PlayerPhoto = ({ player, size = 'large' }) => {
  const [hasImageError, setHasImageError] = useState(false);
  const displayName = splitFullName(getPlayerDisplayName(player));
  const initials = getInitials(displayName.firstName, displayName.lastName);
  const sizeClass = size === 'small' ? 'h-10 w-10 text-xs' : 'h-20 w-20 text-xl';

  if (!player.photo_url || hasImageError) {
    return (
      <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-2xl border border-gray-800 bg-neutral-800 font-black text-[#EF4444]`}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={player.photo_url}
      alt={getPlayerDisplayName(player)}
      className={`${sizeClass} shrink-0 rounded-2xl border border-gray-800 object-cover`}
      onError={() => setHasImageError(true)}
    />
  );
};

const isMissingColumnError = (error, columnName) => {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return message.includes(columnName) && (message.includes('schema cache') || message.includes('column'));
};

const isMissingTableError = (error, tableName) => {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return message.includes(tableName) && (message.includes('schema cache') || message.includes('table'));
};

const isMissingDrillSchemaError = (error) => {
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return message.includes('drills') && (
    message.includes('schema cache')
    || message.includes('video_url')
    || message.includes('youtube_url')
    || message.includes('difficulty')
    || message.includes('duration')
    || message.includes('thumbnail_url')
    || message.includes('category')
  );
};

const POSITION_OPTIONS = ['TBD', 'Forward', 'Midfielder', 'Defender', 'Goalkeeper'];
const JERSEY_SIZE_OPTIONS = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'S', 'M', 'L', 'XL', '2XL'];
const getDrillVideoUrl = (drill) => drill?.video_url || drill?.youtube_url || '';

const getPaymentStatusClass = (status = '') => {
  const normalized = status.toLowerCase();
  if (normalized === 'waived') return 'text-green-400';
  if (normalized === 'paid') return 'text-green-300';
  if (normalized === 'paused') return 'text-blue-300';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'text-red-300';
  return 'text-yellow-300';
};

const OnboardModal = ({ onClose, onSubmit, newCoach, setNewCoach }) => (
  <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[150] p-4 backdrop-blur-md">
    <div className="bg-neutral-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
      <div className="p-5 border-b border-gray-800 flex justify-between items-start gap-4 sticky top-0 bg-neutral-900 z-10 sm:p-8">
        <div>
          <h2 className="text-2xl font-black uppercase italic text-white">Onboard New <span className="text-[#D4AF37]">Coach</span></h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-gray-500">An email invite will let the coach set their password.</p>
        </div>
        <X className="text-gray-500 cursor-pointer hover:text-white" onClick={onClose} />
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-6 sm:p-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">First Name</label>
            <input required className="input-primary" value={newCoach.first_name} onChange={e => setNewCoach({...newCoach, first_name: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Last Name</label>
            <input required className="input-primary" value={newCoach.last_name} onChange={e => setNewCoach({...newCoach, last_name: e.target.value})} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Email Address</label>
            <input required type="email" className="input-primary" value={newCoach.email} onChange={e => setNewCoach({...newCoach, email: e.target.value})} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Primary Role</label>
            <select className="input-primary appearance-none" value={newCoach.role} onChange={e => setNewCoach({...newCoach, role: e.target.value})}>
              <option>Head Coach</option>
              <option>Assistant Coach</option>
              <option>Goalkeeper Coach</option>
              <option>Technical Director</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Photo URL</label>
            <input placeholder="https://..." className="input-primary" value={newCoach.photo_url} onChange={e => setNewCoach({...newCoach, photo_url: e.target.value})} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Professional Bio</label>
          <textarea rows={4} className="input-primary resize-none" placeholder="Describe the coach's experience and philosophy..." value={newCoach.bio} onChange={e => setNewCoach({...newCoach, bio: e.target.value})} />
        </div>
        <button type="submit" className="btn-primary w-full">
          Send Coach Invite
        </button>
      </form>
    </div>
  </div>
);

const EditParentModal = ({ isOpen, onClose, parent, onSave }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (parent) {
      const displayName = getParentDisplayName(parent);
      setFormData({
        id: parent.id,
        first_name: displayName.firstName,
        last_name: displayName.lastName,
        email: parent.email || '',
        phone: parent.phone || '',
      });
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: ''
      });
    }
  }, [parent]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[150] p-4 backdrop-blur-md">
      <div className="bg-neutral-900 border border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-5 border-b border-gray-800 flex justify-between items-start gap-4 sticky top-0 bg-neutral-900 z-10 sm:p-8">
          <h2 className="text-2xl font-black uppercase italic text-white">Edit Parent</h2>
          <X className="text-gray-500 cursor-pointer hover:text-white" onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-6 sm:p-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">First Name</label>
              <input required name="first_name" value={formData?.first_name || ''} className="input-primary" onChange={handleInputChange} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Last Name</label>
              <input required name="last_name" value={formData?.last_name || ''} className="input-primary" onChange={handleInputChange} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Email Address</label>
              <input required type="email" name="email" value={formData?.email || ''} className="input-primary" onChange={handleInputChange} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Phone Number</label>
              <input name="phone" value={formData?.phone || ''} className="input-primary" onChange={handleInputChange} />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};

const DrillModal = ({ onClose, onSubmit, newDrill, setNewDrill }) => {
  const thumbnailPreview = newDrill.thumbnail_url || getYoutubeThumbnail(newDrill.video_url);

  return (
  <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[150] p-4 backdrop-blur-md">
    <div className="bg-neutral-900 border border-gray-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
      <div className="p-5 border-b border-gray-800 flex justify-between items-start gap-4 bg-neutral-950 sm:p-8">
        <div>
          <h2 className="text-2xl font-black uppercase italic text-white">Add YouTube <span className="text-[#EF4444]">Tutorial</span></h2>
          <p className="mt-1 text-sm text-gray-500">Paste a YouTube link and publish it to the Training Lab.</p>
        </div>
        <X className="text-gray-500 cursor-pointer hover:text-white" onClick={onClose} />
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-6 sm:p-8">
        <div>
           <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">YouTube Video URL</label>
           <input required value={newDrill.video_url} placeholder="https://www.youtube.com/watch?v=..." className="input-primary" onChange={(e) => setNewDrill({ ...newDrill, video_url: e.target.value, thumbnail_url: newDrill.thumbnail_url || getYoutubeThumbnail(e.target.value) })} />
         </div>
         <div className="grid md:grid-cols-2 gap-6">
           <div>
             <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Drill Title</label>
             <input required value={newDrill.title} placeholder="First touch passing pattern" className="input-primary" onChange={(e) => setNewDrill({ ...newDrill, title: e.target.value })} />
           </div>
           <div>
             <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Category</label>
             <select value={newDrill.category} className="input-primary appearance-none" onChange={(e) => setNewDrill({ ...newDrill, category: e.target.value })}>
               <option>Dribbling</option>
               <option>Passing</option>
               <option>Shooting</option>
               <option>Tactical</option>
               <option>Physical</option>
               <option>Goalkeeping</option>
               <option>Warmup</option>
             </select>
           </div>
         </div>
         <div className="grid md:grid-cols-2 gap-6">
           <div>
             <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Difficulty</label>
             <select value={newDrill.difficulty} className="input-primary" onChange={(e) => setNewDrill({ ...newDrill, difficulty: e.target.value })}>
               <option>Beginner</option>
               <option>Intermediate</option>
               <option>Advanced</option>
               <option>Pro</option>
             </select>
           </div>
           <div>
             <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Duration (Minutes)</label>
             <input type="number" min="1" value={newDrill.duration} placeholder="e.g. 15" className="input-primary" onChange={(e) => setNewDrill({ ...newDrill, duration: parseInt(e.target.value) || 1 })} />
           </div>
         </div>
         <div>
           <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Tutorial Description</label>
           <textarea rows={4} value={newDrill.description} className="input-primary resize-none" placeholder="What players should focus on, setup notes, coaching points..." onChange={(e) => setNewDrill({ ...newDrill, description: e.target.value })} />
         </div>
         <div>
           <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block tracking-widest">Thumbnail URL</label>
           <input value={newDrill.thumbnail_url} placeholder="Auto-filled from YouTube, or paste a custom thumbnail" className="input-primary" onChange={(e) => setNewDrill({ ...newDrill, thumbnail_url: e.target.value })} />
         </div>
         {thumbnailPreview && (
           <div className="overflow-hidden rounded-2xl border border-gray-800 bg-black">
             <img src={thumbnailPreview} alt="Tutorial thumbnail preview" className="aspect-video w-full object-cover opacity-80" />
           </div>
         )}
         <button type="submit" className="btn-primary w-full flex items-center justify-center gap-3">
           <Upload size={20} /> Publish to Lab
         </button>
      </form>
    </div>
  </div>
  );
};

const PracticeModal = ({ onClose, onSubmit, newPractice, setNewPractice }) => (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
    <div className="bg-neutral-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
      <div className="p-5 border-b border-gray-800 flex justify-between items-start gap-4 sm:p-6">
        <h3 className="text-white font-black uppercase italic">New Practice</h3>
        <X className="cursor-pointer text-gray-500 hover:text-white" onClick={onClose} />
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-4 sm:p-8">
        <input
          type="text"
          placeholder="Practice title, e.g. U10 Team Practice"
          required
          value={newPractice.title}
          className="input-primary"
          onChange={(e) => setNewPractice({ ...newPractice, title: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            required
            value={newPractice.date}
            className="input-primary"
            onChange={(e) => setNewPractice({ ...newPractice, date: e.target.value })}
          />
          <input
            type="time"
            required
            value={newPractice.time}
            className="input-primary"
            onChange={(e) => setNewPractice({ ...newPractice, time: e.target.value })}
          />
        </div>
        <input
          type="text"
          placeholder="Field / location"
          required
          value={newPractice.location}
          className="input-primary"
          onChange={(e) => setNewPractice({ ...newPractice, location: e.target.value })}
        />
        <textarea
          rows={3}
          placeholder="Notes, age group, field space, or equipment needed"
          value={newPractice.description}
          className="input-primary resize-none"
          onChange={(e) => setNewPractice({ ...newPractice, description: e.target.value })}
        />
        <button type="submit" className="btn-primary w-full">
          Publish Practice
        </button>
      </form>
    </div>
  </div>
);

const AnnouncementModal = ({ onClose, onSubmit, newAnnouncement, setNewAnnouncement }) => (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
    <div className="bg-neutral-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl">
      <div className="p-5 border-b border-gray-800 flex justify-between items-start gap-4 sm:p-6">
        <div>
          <h3 className="text-white font-black uppercase italic">New Announcement</h3>
          <p className="mt-1 text-sm text-gray-500">Publish club news for visitors, parents, or coaches.</p>
        </div>
        <X className="cursor-pointer text-gray-500 hover:text-white" onClick={onClose} />
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-5 sm:p-8">
        <input
          type="text"
          placeholder="Announcement title"
          required
          value={newAnnouncement.title}
          className="input-primary"
          onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
        />
        <textarea
          rows={5}
          placeholder="Write the update parents and players need to know..."
          required
          value={newAnnouncement.body}
          className="input-primary resize-none"
          onChange={(e) => setNewAnnouncement({ ...newAnnouncement, body: e.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <select
            value={newAnnouncement.audience}
            className="input-primary"
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, audience: e.target.value })}
          >
            <option value="everyone">Homepage + All Dashboards</option>
            <option value="public">Homepage Only</option>
            <option value="parents">Parent Dashboards Only</option>
            <option value="coaches">Coach Dashboards Only</option>
          </select>
          <select
            value={newAnnouncement.priority}
            className="input-primary"
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="important">Important</option>
          </select>
          <label className="space-y-2">
            <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Reference date</span>
            <input
              type="date"
              value={newAnnouncement.expires_at}
              className="input-primary"
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, expires_at: e.target.value })}
            />
          </label>
        </div>
        <label className="flex items-center gap-3 rounded-xl border border-gray-800 bg-black p-4 text-sm font-bold text-gray-300">
          <input
            type="checkbox"
            checked={newAnnouncement.is_pinned}
            onChange={(e) => setNewAnnouncement({ ...newAnnouncement, is_pinned: e.target.checked })}
          />
          Pin this announcement to the top
        </label>
        <button type="submit" className="btn-primary w-full">
          Publish Announcement
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
    events: [],
    drills: [],
    announcements: [],
  });
  const [loading, setLoading] = useState(true);

  // Modal Visibility
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);

  // Form State
  const [newGame, setNewGame] = useState({ date: '', time: '', opponent: '', location: 'Home' });
  const [newPractice, setNewPractice] = useState({ title: '', date: '', time: '', location: '', description: '' });
  const emptyCoach = { first_name: '', last_name: '', email: '', role: 'Head Coach', bio: '', photo_url: '' };
  const [newCoach, setNewCoach] = useState(emptyCoach);
  const emptyDrill = { title: '', video_url: '', thumbnail_url: '', category: 'Dribbling', difficulty: 'Beginner', duration: 15, description: '' };
  const [newDrill, setNewDrill] = useState(emptyDrill);
  const emptyAnnouncement = { title: '', body: '', audience: 'everyone', priority: 'normal', expires_at: '', is_pinned: false };
  const [newAnnouncement, setNewAnnouncement] = useState(emptyAnnouncement);
  const [databaseNotice, setDatabaseNotice] = useState('');

  const handleSort = (column) => {
    setSortOrder(prev => ({
      column,
      ascending: prev.column === column ? !prev.ascending : true,
    }));
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'user');
    const parents = (p || []).map((parent) => {
      const displayName = getParentDisplayName(parent);
      return {
        ...parent,
        first_name: parent.first_name || displayName.firstName,
        last_name: parent.last_name || displayName.lastName,
      };
    });

    if (parents) {
      parents.sort((a, b) => {
        let valA, valB;
        if (sortOrder.column === 'last_name') {
          valA = a.last_name || a.full_name || '';
          valB = b.last_name || b.full_name || '';
        } else {
          valA = a[sortOrder.column] || '';
          valB = b[sortOrder.column] || '';
        }

        const comparison = valA.localeCompare(valB);
        return sortOrder.ascending ? comparison : -comparison;
      });
    }

    const notices = [];
    const { data: c } = await supabase.from('coaches').select('*, profiles(photo_url)');
    let players = [];
    const { data: playersWithParents, error: playersWithParentsError } = await supabase
      .from('players')
      .select('*, profiles:parent_id(first_name, last_name, email, phone)');

    if (playersWithParentsError) {
      const { data: basicPlayers } = await supabase.from('players').select('*');
      players = basicPlayers || [];
    } else {
      players = playersWithParents || [];
    }

    const { data: g } = await supabase.from('games').select('*').order('date', { ascending: true });
    const { data: e } = await supabase.from('events').select('*').order('date', { ascending: true }).order('time', { ascending: true });
    const { data: d } = await supabase.from('drills').select('*');
    const { data: a, error: announcementsError } = await supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (announcementsError && isMissingTableError(announcementsError, 'announcements')) {
      notices.push('Announcements need the latest Supabase schema update.');
    }

    setData({
      parents,
      coaches: c || [],
      roster: players,
      games: g || [],
      events: e || [],
      drills: d || [],
      announcements: announcementsError ? [] : a || [],
    });
    setDatabaseNotice(notices.join(' '));
    setLoading(false);
  }, [sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddGame = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('games').insert([newGame]);
    if (!error) {
      setNewGame({ date: '', time: '', opponent: '', location: 'Home' });
      setIsGameModalOpen(false);
      fetchData();
    }
  };

  const handleAddPractice = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('events').insert([newPractice]);
    if (!error) {
      setNewPractice({ title: '', date: '', time: '', location: '', description: '' });
      setIsPracticeModalOpen(false);
      fetchData();
    } else {
      alert(error.message);
    }
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      alert('Please log in as an admin again before sending a coach invite.');
      return;
    }

    const response = await fetch('/api/auth/invite-coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newCoach),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert(result.error || 'Unable to send coach invite.');
      return;
    }

    setNewCoach(emptyCoach);
    setIsOnboardModalOpen(false);
    fetchData();
    alert(result.message || `Coach invite sent to ${newCoach.email}.`);
  };
  
  const handleAddDrill = async (e) => {
    e.preventDefault();
    const videoId = getYoutubeId(newDrill.video_url);
    if (!videoId) {
      alert('Please enter a valid YouTube video URL.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      alert('Please log in as an admin again before publishing a drill.');
      return;
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/drills?columns=title,youtube_url,thumbnail_url,duration,difficulty,category,description`, {
      method: 'POST',
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([{
        title: newDrill.title,
        youtube_url: newDrill.video_url,
        thumbnail_url: newDrill.thumbnail_url || getYoutubeThumbnail(newDrill.video_url),
        duration: Number(newDrill.duration) || 15,
        difficulty: newDrill.difficulty || 'Beginner',
        category: newDrill.category || 'Training',
        description: newDrill.description || '',
      }]),
    });

    if (response.ok) {
      setNewDrill(emptyDrill);
      setIsDrillModalOpen(false);
      fetchData();
    } else {
      const errorText = await response.text();
      let errorMessage = errorText || 'Unable to publish drill.';
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.message || parsed.error || parsed.hint || errorMessage;
      } catch {
        // Keep the raw response text when Supabase does not return JSON.
      }

      if (isMissingDrillSchemaError({ message: errorMessage })) {
        alert(`Supabase drills table is missing a column the site needs: ${errorMessage}. Run supabase/FIX_DRILLS_ONLY.sql in Supabase SQL Editor, then hard refresh this page.`);
        return;
      }
      alert(errorMessage);
    }
  };

  const handleDeleteDrill = async (id) => {
    if (!window.confirm('Delete tutorial?')) return;
    await supabase.from('drills').delete().eq('id', id);
    fetchData();
  };

  const handleDeleteGame = async (id) => {
    if (!window.confirm('Delete match?')) return;
    await supabase.from('games').delete().eq('id', id);
    fetchData();
  };

  const handleDeletePractice = async (id) => {
    if (!window.confirm('Delete practice?')) return;
    await supabase.from('events').delete().eq('id', id);
    fetchData();
  };

  const handleAssignCoachTeam = async (coachId, teamId) => {
    const normalizedTeam = teamId === 'Unassigned' ? null : teamId;
    const { error } = await supabase.from('coaches').update({ team_id: normalizedTeam }).eq('id', coachId);
    if (!error) {
      fetchData();
    } else {
      if (isMissingColumnError(error, 'team_id')) {
        setDatabaseNotice('Team assignments need the latest Supabase schema update.');
        return;
      }
      alert(error.message);
    }
  };

  const handleAssignPlayerTeam = async (playerId, teamId) => {
    const { error } = await supabase.from('players').update({ team_assigned: teamId }).eq('id', playerId);
    if (!error) {
      fetchData();
    } else {
      if (isMissingColumnError(error, 'team_assigned')) {
        alert('Player team assignment is not ready in Supabase yet. Please apply the latest database migrations so the players table has a team_assigned column.');
        return;
      }
      alert(error.message);
    }
  };

  const handleUpdatePlayer = async (playerId, updates) => {
    const { error } = await supabase.from('players').update(updates).eq('id', playerId);
    if (!error) {
      fetchData();
    } else {
      alert(error.message);
    }
  };

  const handlePausePlayer = async (player) => {
    const playerName = getPlayerDisplayName(player);
    if (!window.confirm(`Mark ${playerName} inactive and pause club billing status? If they have an active Stripe subscription, cancel or pause it in Stripe too.`)) return;

    const updates = {
      status: 'inactive',
      payment_status: 'paused',
      team_assigned: 'Unassigned',
    };

    const { error: playerError } = await supabase.from('players').update(updates).eq('id', player.id);
    if (playerError) {
      alert(playerError.message);
      return;
    }

    const splitName = splitFullName(playerName);
    await supabase
      .from('registrations')
      .update({ payment_status: 'paused', status: 'inactive' })
      .eq('parent_id', player.parent_id)
      .eq('first_name', splitName.firstName)
      .eq('last_name', splitName.lastName);

    fetchData();
  };

  const handleCancelPlayerBilling = async (player) => {
    const playerName = getPlayerDisplayName(player);
    if (!window.confirm(`Cancel Stripe billing for ${playerName} at the end of the current billing period and mark them inactive?`)) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      alert('Please log in as an admin again before cancelling billing.');
      return;
    }

    const response = await fetch('/api/cancel-player-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        playerId: player.id,
        cancelAtPeriodEnd: true,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert(result.error || 'Unable to cancel Stripe billing.');
      return;
    }

    alert(result.message || 'Billing cancellation submitted.');
    fetchData();
  };

  const handleReactivatePlayer = async (player) => {
    const playerName = getPlayerDisplayName(player);
    if (!window.confirm(`Reactivate ${playerName}? Billing may still need to be restarted in Stripe if it was cancelled.`)) return;

    const { error } = await supabase
      .from('players')
      .update({ status: 'active', payment_status: player.payment_status === 'waived' ? 'waived' : 'pending' })
      .eq('id', player.id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  const handleDeletePlayer = async (player) => {
    const playerName = getPlayerDisplayName(player);
    if (!window.confirm(`Delete ${playerName} from the roster? Use this only for duplicates or mistakes. For players leaving the club, use Mark inactive.`)) return;

    const { error } = await supabase.from('players').delete().eq('id', player.id);
    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  const handleWaivePlayerFees = async (player) => {
    if (!window.confirm(`Waive fees and mark ${getPlayerDisplayName(player)} as active?`)) return;

    const playerUpdate = {
      payment_status: 'waived',
      status: 'active',
    };

    const { error: playerError } = await supabase.from('players').update(playerUpdate).eq('id', player.id);
    if (playerError) {
      if (isMissingColumnError(playerError, 'payment_status') || isMissingColumnError(playerError, 'status')) {
        alert('Fee waiver needs the latest registration/payment migration applied in Supabase.');
        return;
      }
      alert(playerError.message);
      return;
    }

    const { error: registrationError } = await supabase
      .from('registrations')
      .update({ payment_status: 'waived', status: 'active' })
      .eq('player_id', player.id);

    if (registrationError && isMissingColumnError(registrationError, 'player_id')) {
      await supabase
        .from('registrations')
        .update({ payment_status: 'waived', status: 'active' })
        .eq('parent_id', player.parent_id)
        .eq('first_name', player.first_name)
        .eq('last_name', player.last_name);
    }

    fetchData();
  };

  const handleAssignParentAsCoach = async (parent) => {
    const parentName = `${parent.first_name || ''} ${parent.last_name || ''}`.trim() || parent.full_name || 'Coach';
    if (!window.confirm(`Make ${parentName} a coach account?`)) return;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'coach' })
      .eq('id', parent.id);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    const { error: coachError } = await supabase
      .from('coaches')
      .upsert([{
        id: parent.id,
        name: parentName,
        role: 'Coach',
        bio: 'Bamika FC coach and parent volunteer.',
        is_published: true,
      }], { onConflict: 'id' });

    if (coachError) {
      alert(coachError.message);
      return;
    }

    fetchData();
    setActiveTab('coaches');
  };

  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    const payload = {
      ...newAnnouncement,
      expires_at: newAnnouncement.expires_at || null,
    };

    const { error } = await supabase.from('announcements').insert([payload]);
    if (!error) {
      setNewAnnouncement(emptyAnnouncement);
      setIsAnnouncementModalOpen(false);
      fetchData();
    } else {
      if (isMissingTableError(error, 'announcements')) {
        setDatabaseNotice('Announcements need the latest Supabase schema update.');
        return;
      }
      alert(error.message);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Delete announcement?')) return;
    await supabase.from('announcements').delete().eq('id', id);
    fetchData();
  };

  const handleShowAnnouncementOnHomepage = async (id) => {
    const { error } = await supabase
      .from('announcements')
      .update({ audience: 'everyone' })
      .eq('id', id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchData();
  };

  const handleDeleteParent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this parent and all associated data?')) return;
    await supabase.from('profiles').delete().eq('id', id);
    fetchData();
  };

  const openEditModal = (parent) => {
    setSelectedParent(parent);
    setIsEditModalOpen(true);
  };

  const handleSaveParent = async (updatedParent) => {
    const payload = {
      ...updatedParent,
      full_name: `${updatedParent.first_name || ''} ${updatedParent.last_name || ''}`.trim(),
    };

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', updatedParent.id);

    if (!error) {
      setIsEditModalOpen(false);
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#EF4444] font-black uppercase italic animate-pulse">
            Syncing Bamika...
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Parents', value: data.parents.length },
    { label: 'Players', value: data.roster.length },
    { label: 'Coaches', value: data.coaches.length },
    { label: 'News', value: data.announcements.length },
  ];

  return (
    <div className="min-h-screen w-full bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-neutral-950/80 p-5 shadow-2xl shadow-black/30 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Shield size={14} className="text-[#EF4444]" />
              Club operations
            </div>
            <h1 className="text-3xl font-black uppercase italic leading-tight text-white sm:text-4xl">
              Admin <span className="text-[#D4AF37]">Dashboard</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Manage families, coaches, rosters, matches, and training content from one place.
            </p>
          </div>
          <button onClick={() => setIsOnboardModalOpen(true)} className="btn-primary inline-flex items-center justify-center gap-2 md:w-auto">
            <Plus size={18} />
            Onboard Coach
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-800 bg-neutral-900 p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{stat.label}</div>
              <div className="mt-2 text-3xl font-black text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {databaseNotice && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            <div className="font-black uppercase tracking-widest text-yellow-300">Database update needed</div>
            <p className="mt-1 text-yellow-100/90">
              {databaseNotice} Apply the latest SQL migrations in Supabase, then refresh this page.
            </p>
          </div>
        )}

        {/* 2. TAB NAVIGATION */}
        <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-neutral-900 p-1"> 
          <div className="flex min-w-max gap-2">
            {['parents', 'coaches', 'roster', 'schedule', 'drills', 'announcements'].map((tab) => ( 
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)} 
                className={`whitespace-nowrap rounded-xl px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all sm:px-7 ${ 
                  activeTab === tab ? 'bg-[#EF4444] text-white' : 'text-gray-500 hover:text-white' 
                }`} 
              > 
                {tab} 
              </button> 
            ))} 
          </div>
        </div> 

        {/* 3. MAIN CONTENT AREA */}
        <div className="min-h-[400px]"> 
          {activeTab === 'parents' && (
            <div className="overflow-hidden rounded-2xl border border-gray-800 bg-neutral-900">
              <div className="flex flex-col gap-2 border-b border-gray-800 bg-neutral-950 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase italic text-white">Parent Accounts</h2>
                  <p className="text-sm text-gray-500">Review family accounts and registration status.</p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {data.parents.length} total
                </span>
              </div>
              {data.parents.length === 0 ? (
                <div className="p-10 text-center text-gray-500">No parent accounts found yet.</div>
              ) : (
              <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left">
                <thead>
                  <tr className="bg-neutral-900 border-b border-gray-800">
                    <th onClick={() => handleSort('last_name')} className="p-4 text-left text-xs font-bold uppercase text-white tracking-wider cursor-pointer">Last Name</th>
                    <th onClick={() => handleSort('first_name')} className="p-4 text-left text-xs font-bold uppercase text-white tracking-wider cursor-pointer">First Name</th>
                    <th className="p-4 text-left text-xs font-bold uppercase text-white tracking-wider">Athletes</th>
                    <th onClick={() => handleSort('email')} className="p-4 text-left text-xs font-bold uppercase text-white tracking-wider cursor-pointer">Email Address</th>
                    <th className="p-4 text-left text-xs font-bold uppercase text-white tracking-wider">Phone Number</th>
                    <th className="p-4 text-left text-xs font-bold uppercase text-white tracking-wider">Status</th>
                    <th className="p-4 text-right text-xs font-bold uppercase text-white tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parents.map((u) => {
                    const familyPlayers = data.roster.filter((player) => player.parent_id === u.id || player.user_id === u.id);
                    const displayName = getParentDisplayName(u);

                    return (
                      <tr key={u.id} className="border-b border-neutral-800 hover:bg-neutral-700/50 transition-colors">
                        <td className="p-4 text-white font-bold uppercase italic">{displayName.lastName || '-'}</td>
                        <td className="p-4 text-white font-bold">{displayName.firstName || '-'}</td>
                        <td className="p-4">
                          {familyPlayers.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex -space-x-3">
                                {familyPlayers.slice(0, 3).map((player) => (
                                  <div key={player.id} className="rounded-2xl border-2 border-neutral-900 bg-neutral-900">
                                    <PlayerPhoto player={player} size="small" />
                                  </div>
                                ))}
                              </div>
                              <span className="text-xs font-bold text-gray-400">
                                {familyPlayers.length} player{familyPlayers.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-600">No athletes</span>
                          )}
                        </td>
                        <td className="p-4 text-gray-400">{u.email}</td>
                        <td className="p-4 text-gray-400">{u.phone}</td>
                        <td className="p-4">
                          {familyPlayers.length > 0 ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900 text-green-300">Active</span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-900 text-yellow-300">Pending</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-4">
                            <button onClick={() => openEditModal(u)} className="text-white font-bold hover:text-[#EF4444] transition-colors">Edit</button>
                            <button onClick={() => handleAssignParentAsCoach(u)} className="text-xs font-black uppercase text-[#D4AF37] hover:text-white transition-colors">Make Coach</button>
                            <button onClick={() => handleDeleteParent(u.id)} className="text-gray-600 hover:text-red-500">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              )}
            </div>
          )}

          {activeTab === 'coaches' && (
            <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase italic text-white">Coaching Staff</h2>
                  <p className="text-sm text-gray-500">Published coaches and team assignment status.</p>
                </div>
                <button onClick={() => setIsOnboardModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-xs font-black uppercase text-white hover:bg-red-700">
                  <Plus size={16} />
                  Add Coach
                </button>
              </div>
              {data.coaches.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No coaches have been added yet.</div>
              ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.coaches.map((coach) => (
                <div key={coach.id} className="bg-black border border-gray-800 rounded-xl p-4 group flex flex-col text-center items-center">
                  <img src={coach.profiles?.photo_url || "https://via.placeholder.com/150"} alt={coach.name} className="h-20 w-20 object-cover rounded-full border-2 border-gray-800 mb-4" />
                  <h3 className="text-md font-bold uppercase text-white">{coach.name}</h3>
                  <p className="text-[#D4AF37] text-[10px] font-bold uppercase mb-3">{coach.role}</p>
                  <label className="mb-2 text-[9px] font-black uppercase tracking-widest text-gray-600">Assigned Team</label>
                  <select
                    value={coach.team_id || 'Unassigned'}
                    onChange={(e) => handleAssignCoachTeam(coach.id, e.target.value)}
                    className="w-full rounded-lg border border-gray-800 bg-neutral-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#EF4444]"
                  >
                    {TEAM_OPTIONS.map((team) => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>
                  <span className={`mt-3 rounded-full px-2 py-1 text-xs font-bold ${coach.team_id ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {coach.team_id || 'Unassigned'}
                  </span>
                </div>
              ))}
              </div>
              )}
            </div>
          )}

          {activeTab === 'roster' && (
            <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase italic text-white">Player Roster</h2>
                  <p className="text-sm text-gray-500">All registered athletes with photos, age, teams, and parent contact.</p>
                </div>
                <span className="rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  {data.roster.length} players
                </span>
              </div>
              {data.roster.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No players have been registered yet.</div>
              ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.roster.map((p) => {
                const linkedParent =
                  p.profiles ||
                  data.parents.find((parent) => parent.id === p.parent_id || parent.id === p.user_id);
                const playerName = getPlayerDisplayName(p);
                const isInactive = ['inactive', 'cancelled', 'canceled'].includes((p.status || '').toLowerCase());
                const paymentStatus = p.payment_status || 'Pending';

                return (
                  <div key={p.id} className="bg-black border border-gray-800 rounded-2xl p-4 flex gap-4 transition-colors hover:border-[#EF4444]/70">
                    <PlayerPhoto player={p} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black uppercase italic text-white">
                            {playerName}
                          </h3>
                          <p className="text-xs font-bold uppercase text-gray-500">
                            {formatAge(p.date_of_birth || p.dob)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#EF4444]/10 px-2 py-1 text-[9px] font-black uppercase text-[#EF4444]">
                          {isInactive ? 'Inactive' : (p.team_assigned || 'Unassigned')}
                        </span>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-600">Team Assignment</label>
                        <select
                          value={p.team_assigned || 'Unassigned'}
                          onChange={(e) => handleAssignPlayerTeam(p.id, e.target.value)}
                          className="w-full rounded-lg border border-gray-800 bg-neutral-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#EF4444]"
                        >
                          {TEAM_OPTIONS.map((team) => (
                            <option key={team} value={team}>{team}</option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-lg border border-gray-800 bg-neutral-950 p-2">
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Position</div>
                          <select
                            value={p.position || 'TBD'}
                            onChange={(e) => handleUpdatePlayer(p.id, { position: e.target.value })}
                            className="mt-1 w-full rounded-md border border-gray-800 bg-black px-2 py-1 font-bold text-gray-300 outline-none focus:border-[#EF4444]"
                          >
                            {POSITION_OPTIONS.map((position) => (
                              <option key={position} value={position}>{position}</option>
                            ))}
                          </select>
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-neutral-950 p-2">
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Number</div>
                          <input
                            defaultValue={p.jersey_number || ''}
                            placeholder="-"
                            onBlur={(e) => handleUpdatePlayer(p.id, { jersey_number: e.target.value || '-' })}
                            className="mt-1 w-full rounded-md border border-gray-800 bg-black px-2 py-1 font-bold text-gray-300 outline-none focus:border-[#EF4444]"
                          />
                        </div>
                        <div className="rounded-lg border border-gray-800 bg-neutral-950 p-2">
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Size</div>
                          <select
                            value={p.jersey_size || 'YM'}
                            onChange={(e) => handleUpdatePlayer(p.id, { jersey_size: e.target.value })}
                            className="mt-1 w-full rounded-md border border-gray-800 bg-black px-2 py-1 font-bold text-gray-300 outline-none focus:border-[#EF4444]"
                          >
                            {JERSEY_SIZE_OPTIONS.map((size) => (
                              <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-gray-800 bg-neutral-950 p-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Fees</div>
                            <div className={`mt-1 text-xs font-black uppercase ${getPaymentStatusClass(paymentStatus)}`}>
                              {paymentStatus}
                            </div>
                            <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-gray-600">
                              Status: {p.status || 'pending'}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleWaivePlayerFees(p)}
                              className="rounded-md border border-gray-700 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-green-500 hover:text-green-400"
                            >
                              Waive
                            </button>
                            {isInactive ? (
                              <button
                                onClick={() => handleReactivatePlayer(p)}
                                className="rounded-md border border-gray-700 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-blue-500 hover:text-blue-300"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleCancelPlayerBilling(p)}
                                  className="rounded-md border border-gray-700 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-red-500 hover:text-red-300"
                                >
                                  Cancel billing
                                </button>
                                <button
                                  onClick={() => handlePausePlayer(p)}
                                  className="rounded-md border border-gray-700 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-yellow-500 hover:text-yellow-300"
                                >
                                  Inactive only
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-gray-800 bg-neutral-950 p-2">
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Uniform</div>
                        {p.uniform_purchased ? (
                          <>
                            <div className="mt-1 text-xs font-black uppercase text-green-300">Purchased</div>
                            <div className="mt-1 break-all text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                              Code: {p.uniform_confirmation_code || 'Pending confirmation'}
                            </div>
                          </>
                        ) : (
                          <div className="mt-1 text-xs font-bold text-gray-400">Not purchased at checkout</div>
                        )}
                      </div>

                      <div className="mt-3 border-t border-gray-800 pt-3">
                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">Parent</div>
                        <div className="mt-1 truncate text-sm font-bold text-gray-300">
                          {linkedParent?.first_name || linkedParent?.last_name
                            ? `${linkedParent?.first_name || ''} ${linkedParent?.last_name || ''}`.trim()
                            : linkedParent?.full_name || 'Parent not linked'}
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-500">
                          {linkedParent?.phone || 'No phone listed'}
                        </div>
                        <div className="mt-1 truncate text-xs text-gray-500">
                          {linkedParent?.email || 'No email listed'}
                        </div>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => handleDeletePlayer(p)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-500/20 px-2 py-1 text-[9px] font-black uppercase text-red-300 hover:border-red-500 hover:text-red-200"
                        >
                          <Trash2 size={12} />
                          Delete duplicate
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase italic text-white">Public Schedule</h2>
                  <p className="text-sm text-gray-500">Create practices and matches that show on the public homepage.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button onClick={() => setIsPracticeModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-black px-4 py-2 text-xs font-black uppercase text-white hover:border-[#EF4444]">
                    <Plus size={16} />
                    Add Practice
                  </button>
                  <button onClick={() => setIsGameModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-xs font-black uppercase text-white shadow-lg hover:bg-red-700">
                    <Plus size={16} />
                    Add Match
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-black uppercase italic text-white">Practices</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{data.events.length} listed</span>
                  </div>
                  {data.events.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">No practices are scheduled yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {data.events.map((event) => (
                        <div key={event.id} className="rounded-xl border border-gray-800 bg-neutral-950 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-black uppercase italic text-white">{event.title}</div>
                              <div className="mt-1 text-[10px] font-bold uppercase text-gray-500">{event.date} - {event.time} - {event.location}</div>
                              {event.description && <p className="mt-2 text-sm text-gray-500">{event.description}</p>}
                            </div>
                            <button onClick={() => handleDeletePractice(event.id)} className="text-gray-600 hover:text-red-500">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-black uppercase italic text-white">Matches</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{data.games.length} listed</span>
                  </div>
                  {data.games.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">No matches are scheduled yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {data.games.map((g) => (
                        <div key={g.id} className="p-4 bg-neutral-950 border border-gray-800 rounded-xl flex justify-between items-center gap-4">
                          <div>
                            <div className="font-black uppercase italic text-white">vs. {g.opponent}</div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase">{g.date} - {g.time} - {g.location}</div>
                          </div>
                          <button onClick={() => handleDeleteGame(g.id)} className="text-gray-600 hover:text-red-500">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'drills' && (
            <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase italic text-white">Training Lab</h2>
                  <p className="text-sm text-gray-500">Videos and drills available to players.</p>
                </div>
                <button onClick={() => setIsDrillModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-xs font-black uppercase text-white hover:bg-red-700">
                  <Upload size={16} />
                  Add Drill
                </button>
              </div>
              {data.drills.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No training drills have been published yet.</div>
              ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.drills.map((d) => {
                  const drillVideoUrl = getDrillVideoUrl(d);
                  const thumbnail = d.thumbnail_url || getYoutubeThumbnail(drillVideoUrl);
                  const videoId = getYoutubeId(drillVideoUrl);

                  return (
                    <div key={d.id} className="overflow-hidden rounded-2xl border border-gray-800 bg-black">
                      <div className="relative aspect-video bg-neutral-950">
                        {thumbnail ? (
                          <img src={thumbnail} alt={d.title} className="h-full w-full object-cover opacity-75" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-black uppercase text-gray-600">
                            No thumbnail
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EF4444] text-white shadow-xl">
                            <Play size={18} fill="white" />
                          </div>
                        </div>
                        <span className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/80 px-2 py-1 text-[9px] font-black uppercase text-white">
                          {d.category || 'Training'}
                        </span>
                      </div>
                      <div className="space-y-4 p-4">
                        <div>
                          <h3 className="line-clamp-2 text-base font-black uppercase italic text-white">{d.title}</h3>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            {d.difficulty || 'Beginner'} • {d.duration || 15} min
                          </p>
                        </div>
                        <p className="line-clamp-2 min-h-[40px] text-sm text-gray-500">
                          {d.description || 'Training tutorial for Bamika FC players.'}
                        </p>
                        <div className="flex items-center gap-2">
                          {videoId && (
                            <a
                              href={drillVideoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-800 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-[#EF4444] hover:text-white"
                            >
                              <ExternalLink size={14} />
                              Open Video
                            </a>
                          )}
                          <button onClick={() => handleDeleteDrill(d.id)} className="rounded-lg border border-gray-800 p-2 text-gray-500 hover:border-red-500 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-black uppercase italic text-white">Announcements</h2>
                  <p className="text-sm text-gray-500">Publish club updates to the homepage and member dashboards.</p>
                </div>
                <button onClick={() => setIsAnnouncementModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-xs font-black uppercase text-white hover:bg-red-700">
                  <Megaphone size={16} />
                  Add Announcement
                </button>
              </div>

              {data.announcements.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-800 bg-black p-8 text-center">
                  <Mail className="mx-auto mb-4 text-[#EF4444]" size={36} />
                  <h3 className="text-lg font-black uppercase italic text-white">No announcements yet</h3>
                  <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
                    Create updates for weather cancellations, tryouts, registration deadlines, or team news.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.announcements.map((announcement) => (
                    <div key={announcement.id} className={`rounded-2xl border p-5 ${announcement.priority === 'important' ? 'border-[#EF4444]/70 bg-[#EF4444]/10' : 'border-gray-800 bg-black'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="mb-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-gray-700 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                              {announcement.audience === 'everyone'
                                ? 'Homepage + dashboards'
                                : announcement.audience === 'public'
                                  ? 'Homepage only'
                                  : `${announcement.audience} only`}
                            </span>
                            {['public', 'everyone'].includes(announcement.audience) && (
                              <span className="rounded-full bg-green-500/15 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-green-300">
                                Homepage
                              </span>
                            )}
                            {announcement.is_pinned && (
                              <span className="rounded-full bg-[#D4AF37]/15 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">
                                Pinned
                              </span>
                            )}
                            {announcement.priority === 'important' && (
                              <span className="rounded-full bg-[#EF4444] px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">
                                Important
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-black uppercase italic text-white">{announcement.title}</h3>
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-400">{announcement.body}</p>
                          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-gray-600">
                            {new Date(announcement.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {announcement.expires_at ? ` - reference ${new Date(announcement.expires_at + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {!['public', 'everyone'].includes(announcement.audience) && (
                            <button
                              onClick={() => handleShowAnnouncementOnHomepage(announcement.id)}
                              className="rounded-lg border border-gray-800 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-green-500 hover:text-green-300"
                            >
                              Show on homepage
                            </button>
                          )}
                          <button onClick={() => handleDeleteAnnouncement(announcement.id)} className="rounded-lg border border-gray-800 p-2 text-gray-500 hover:border-red-500 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

        {isPracticeModalOpen && (
          <PracticeModal
            onClose={() => setIsPracticeModalOpen(false)}
            onSubmit={handleAddPractice}
            newPractice={newPractice}
            setNewPractice={setNewPractice}
          />
        )}

        {isAnnouncementModalOpen && (
          <AnnouncementModal
            onClose={() => setIsAnnouncementModalOpen(false)}
            onSubmit={handleAddAnnouncement}
            newAnnouncement={newAnnouncement}
            setNewAnnouncement={setNewAnnouncement}
          />
        )}

        {isEditModalOpen && (
          <EditParentModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            parent={selectedParent}
            onSave={handleSaveParent}
          />
        )}

        {isGameModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
            <div className="bg-neutral-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="p-5 border-b border-gray-800 flex justify-between items-start gap-4 sm:p-6">
                <h3 className="text-white font-black uppercase italic">New Match</h3>
                <X className="cursor-pointer text-gray-500" onClick={() => setIsGameModalOpen(false)} />
              </div>
              <form onSubmit={handleAddGame} className="p-5 space-y-4 sm:p-8">
                <input type="date" required value={newGame.date} className="input-primary" onChange={(e) => setNewGame({ ...newGame, date: e.target.value })} />
                <input type="time" required value={newGame.time} className="input-primary" onChange={(e) => setNewGame({ ...newGame, time: e.target.value })} />
                <input type="text" placeholder="Opponent Name" required value={newGame.opponent} className="input-primary" onChange={(e) => setNewGame({ ...newGame, opponent: e.target.value })} />
                <input type="text" placeholder="Location" value={newGame.location} className="input-primary" onChange={(e) => setNewGame({ ...newGame, location: e.target.value })} />
                <button type="submit" className="btn-primary w-full">
                  Schedule Match
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
