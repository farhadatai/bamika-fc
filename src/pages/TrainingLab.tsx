import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Play, X } from 'lucide-react';

export default function TrainingLab() {
  const [drills, setDrills] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

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
    <div className="min-h-screen bg-black p-6 md:p-10 text-white">
      <div className="mb-12">
        <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter">
          TRAINING <span className="text-[#EF4444]">LAB</span>
        </h1>
        <p className="text-gray-500 uppercase tracking-widest text-xs font-bold mt-2">
          Master the fundamentals. Chase greatness.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-10">
        {['All', 'Dribbling', 'Passing', 'Shooting', 'Tactical'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase italic tracking-widest transition-all ${
              filter === cat
                ? 'bg-[#EF4444] text-white shadow-lg shadow-red-500/20'
                : 'bg-neutral-900 text-gray-500 border border-gray-800 hover:border-gray-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? <p>Loading drills...</p> : drills.map((drill) => (
          <div key={drill.id} className="bg-neutral-900 rounded-3xl overflow-hidden border border-gray-800 group hover:border-[#EF4444] transition-all">
            <div className="relative aspect-video bg-black overflow-hidden">
              <img src={drill.thumbnail_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-[#EF4444] rounded-full flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform">
                  <Play size={20} fill="white" />
                </div>
              </div>
              <span className="absolute bottom-4 left-4 bg-black/80 text-[9px] font-black uppercase text-white px-3 py-1 rounded-md border border-white/10">
                {drill.duration} MIN
              </span>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-black uppercase italic text-white leading-tight">
                  {drill.title}
                </h3>
                <span className="text-[9px] font-black text-[#EF4444] uppercase tracking-tighter">
                  {drill.difficulty}
                </span>
              </div>
              <p className="text-gray-500 text-sm line-clamp-2 mb-6">
                {drill.description}
              </p>
              <button 
                 onClick={() => setActiveVideo(drill.video_url)} 
                 className="w-full py-3 bg-[#EF4444] text-white rounded-xl text-[10px] font-black uppercase italic hover:bg-red-700 transition-all shadow-lg shadow-red-500/20" 
               > 
                 Start Training 
               </button> 
             </div> 
           </div> 
         ))} 
       </div> 

       {activeVideo && ( 
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-10"> 
          <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800"> 
            
            {/* Close Button */} 
            <button 
              onClick={() => setActiveVideo(null)} 
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-[#EF4444] text-white p-2 rounded-full transition-all" 
            > 
              <X size={24} /> 
            </button> 
      
            {/* Embedded YouTube Player */} 
            <iframe 
              className="w-full h-full" 
              src={`https://www.youtube.com/embed/${getYoutubeId(activeVideo)}?autoplay=1&rel=0&modestbranding=1`} 
              title="Training Drill" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen 
            ></iframe> 
          </div> 
          
          {/* Background click to close */} 
          <div className="absolute inset-0 -z-10" onClick={() => setActiveVideo(null)}></div> 
        </div> 
      )}
    </div>
  );
}
