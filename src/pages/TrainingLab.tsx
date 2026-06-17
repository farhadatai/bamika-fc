import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Dumbbell, Play, Target, X } from 'lucide-react';
import { getYoutubeId, getYoutubeThumbnail } from '../lib/utils';

interface Drill {
  id: string;
  title: string;
  video_url?: string;
  youtube_url?: string;
  thumbnail_url?: string;
  duration?: number;
  difficulty?: string;
  category?: string;
  description?: string;
}

const categories = ['All', 'Dribbling', 'Passing', 'Shooting', 'Tactical', 'Physical', 'Goalkeeping', 'Warmup'];

const getDrillVideoUrl = (drill: Drill) => drill.video_url || drill.youtube_url || '';
const getDrillThumbnail = (drill: Drill) => drill.thumbnail_url || getYoutubeThumbnail(getDrillVideoUrl(drill));

const VideoModal = ({ videoUrl, onClose }: { videoUrl: string | null; onClose: () => void }) => {
  if (!videoUrl) return null;

  const videoId = getYoutubeId(videoUrl);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md md:p-10" onClick={onClose}>
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-800 bg-black shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white transition-all hover:bg-[#EF4444]"
          aria-label="Close video"
        >
          <X size={24} />
        </button>

        {videoId ? (
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title="Training tutorial"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="flex aspect-video items-center justify-center px-6 text-center text-sm font-bold text-gray-400">
            This tutorial needs a valid YouTube link.
          </div>
        )}
      </div>
    </div>
  );
};

export default function TrainingLab() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [filter, setFilter] = useState('All');
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetchDrills = async () => {
      setLoading(true);
      let query = supabase.from('drills').select('*');
      if (filter !== 'All') {
        query = query.eq('category', filter);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching drills:', error);
      } else {
        setDrills(data || []);
      }
      setLoading(false);
    };
    fetchDrills();
  }, [filter]);

  return (
    <div className="min-h-screen w-full bg-black text-white">
      <section className="border-b border-gray-900 bg-neutral-950 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Dumbbell size={14} className="text-[#EF4444]" />
              Training
            </div>
            <h1 className="text-4xl font-black italic uppercase leading-tight tracking-tight sm:text-6xl">
              Training <span className="text-[#EF4444]">Lab</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-400 sm:text-lg">
              Drills, tutorials, and informational videos for players and families to review between practices.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Skills', 'Ball mastery'],
              ['Videos', 'Coach selected'],
              ['Growth', 'Practice habits'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-gray-800 bg-black p-4">
                <Target size={18} className="text-[#EF4444]" />
                <div className="mt-4 text-lg font-black uppercase italic text-white">{title}</div>
                <div className="mt-1 text-xs font-bold text-gray-500">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap gap-2 sm:gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-full px-4 py-2 text-[10px] font-black uppercase italic tracking-widest transition-all sm:px-5 ${
                  filter === cat
                    ? 'bg-[#EF4444] text-white shadow-lg shadow-red-500/20'
                    : 'border border-gray-800 bg-black text-gray-500 hover:border-gray-600 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {loading ? (
          <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Loading tutorials...</p>
        ) : drills.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-8 text-center md:col-span-2 lg:col-span-3">
            <h2 className="text-xl font-black uppercase italic text-white">No tutorials yet</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">
              New YouTube drills and player tutorials will appear here after they are added from the admin dashboard.
            </p>
          </div>
        ) : drills.map((drill) => {
          const drillVideoUrl = getDrillVideoUrl(drill);
          const thumbnail = getDrillThumbnail(drill);

          return (
            <div key={drill.id} className="group overflow-hidden rounded-2xl border border-gray-800 bg-neutral-950 transition-all hover:border-[#EF4444]">
              <button type="button" className="relative aspect-video w-full bg-black overflow-hidden text-left" onClick={() => setActiveVideo(drillVideoUrl)}>
                {thumbnail ? (
                  <img src={thumbnail} alt={drill.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-neutral-950 text-xs font-black uppercase tracking-widest text-gray-600">
                    YouTube Tutorial
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-[#EF4444] rounded-full flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                    <Play size={20} fill="white" />
                  </div>
                </div>
                <span className="absolute bottom-4 left-4 bg-black/80 text-[9px] font-black uppercase text-white px-3 py-1 rounded-md border border-white/10">
                  {drill.duration || 15} MIN
                </span>
                <span className="absolute top-4 left-4 bg-[#EF4444] text-[9px] font-black uppercase text-white px-3 py-1 rounded-md">
                  {drill.category || 'Training'}
                </span>
              </button>

              <div className="p-6">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <h3 className="text-xl font-black uppercase italic text-white leading-tight">
                    {drill.title}
                  </h3>
                  <span className="shrink-0 text-[9px] font-black text-[#EF4444] uppercase tracking-tighter">
                    {drill.difficulty || 'Beginner'}
                  </span>
                </div>
                <p className="text-gray-500 text-sm line-clamp-2 mb-6">
                  {drill.description || 'Training tutorial for Bamika FC players.'}
                </p>
                <button
                   onClick={() => setActiveVideo(drillVideoUrl)}
                   className="w-full py-3 bg-[#EF4444] text-white rounded-xl text-[10px] font-black uppercase italic hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                 >
                   Start Tutorial
                 </button>
              </div>
            </div>
          );
        })}
          </div>
        </div>
      </section>

       <VideoModal videoUrl={activeVideo} onClose={() => setActiveVideo(null)} />
    </div>
  );
}
