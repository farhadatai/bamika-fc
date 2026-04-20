import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { X, Plus, Trash2, Edit, Send } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author_id: string;
}

export default function Announcements() {
  const { user } = useAuthStore();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [editing, setEditing] = useState<Announcement | null>(null);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching announcements', error);
    else setAnnouncements(data as Announcement[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const announcementData = {
      ...newAnnouncement,
      author_id: user.id,
    };

    let error;
    if (editing) {
      const { error: updateError } = await supabase
        .from('announcements')
        .update(announcementData)
        .eq('id', editing.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('announcements')
        .insert([announcementData]);
      error = insertError;
    }

    if (!error) {
      setIsModalOpen(false);
      setNewAnnouncement({ title: '', content: '' });
      setEditing(null);
      fetchAnnouncements();
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (!error) {
        fetchAnnouncements();
      }
    }
  };

  const openEditModal = (announcement: Announcement) => {
    setEditing(announcement);
    setNewAnnouncement({ title: announcement.title, content: announcement.content });
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 bg-black min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-black uppercase italic text-white">
          Club <span className="text-[#EF4444]">Announcements</span>
        </h1>
        <button
          onClick={() => {
            setEditing(null);
            setNewAnnouncement({ title: '', content: '' });
            setIsModalOpen(true);
          }}
          className="bg-[#EF4444] text-white px-6 py-3 rounded-xl font-black uppercase italic text-xs hover:bg-red-700 transition-all flex items-center gap-2"
        >
          <Plus size={16} /> New Post
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400">Loading announcements...</div>
      ) : (
        <div className="space-y-6">
          {announcements.map((ann) => (
            <div key={ann.id} className="bg-neutral-900 border border-gray-800 rounded-2xl p-6 group">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-black uppercase italic text-white mb-2">{ann.title}</h2>
                  <p className="text-gray-400 text-sm mb-4">{ann.content}</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(ann)} className="p-2 text-gray-500 hover:text-white">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(ann.id)} className="p-2 text-gray-500 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">
                Posted on {new Date(ann.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[150] p-4 backdrop-blur-md">
          <div className="bg-neutral-900 border border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl">
            <div className="p-8 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-2xl font-black uppercase italic text-white">
                {editing ? 'Edit' : 'Create'} <span className="text-[#EF4444]">Announcement</span>
              </h2>
              <X className="text-gray-500 cursor-pointer hover:text-white" onClick={() => setIsModalOpen(false)} />
            </div>
            <form onSubmit={handleModalSubmit} className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Title</label>
                <input
                  required
                  className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-500 mb-2 block">Content</label>
                <textarea
                  required
                  rows={5}
                  className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white font-bold focus:border-[#EF4444] outline-none resize-none"
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#EF4444] text-white py-5 rounded-2xl font-black uppercase italic tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-3"
              >
                <Send size={18} /> {editing ? 'Save Changes' : 'Publish Post'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
