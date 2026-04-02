import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface Drill {
  id: string;
  title: string;
  description: string;
  category: string;
  youtube_url: string;
}

// Helper to get YouTube video ID from URL
const getYouTubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export default function TrainingLab() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);

  useEffect(() => {
    const fetchDrills = async () => {
      try {
        const { data, error } = await supabase
          .from('drills')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDrills(data || []);
      } catch (error) {
        console.error('Error fetching drills:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDrills();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold text-center mb-12">Weekly Drills</h1>

        {loading ? (
          <p className="text-center">Loading drills...</p>
        ) : drills.length === 0 ? (
          <p className="text-center text-gray-500">No drills available yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {drills.map((drill) => {
              const videoId = getYouTubeId(drill.youtube_url);
              const thumbnailUrl = videoId
                ? `https://img.youtube.com/vi/${videoId}/0.jpg`
                : '/placeholder.jpg';

              return (
                <div
                  key={drill.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-300"
                  onClick={() => setSelectedDrill(drill)}
                >
                  <div className="relative">
                    <img
                      src={thumbnailUrl}
                      alt={drill.title}
                      className="w-full h-48 object-cover"
                    />
                    <span className="absolute top-2 right-2 bg-primary text-white text-xs font-bold px-2 py-1 rounded-full">
                      {drill.category}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-2">{drill.title}</h3>
                    <p className="text-gray-600 line-clamp-3">{drill.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedDrill && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl relative">
              <button
                onClick={() => setSelectedDrill(null)}
                className="absolute -top-3 -right-3 bg-white rounded-full p-1 text-gray-700 hover:text-black z-10"
              >
                <X size={28} />
              </button>

              <div className="aspect-w-16 aspect-h-9">
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeId(selectedDrill.youtube_url)}`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full rounded-t-xl"
                  title={selectedDrill.title}
                />
              </div>

              <div className="p-6">
                <h3 className="text-2xl font-bold mb-2">{selectedDrill.title}</h3>
                <p className="text-gray-700">{selectedDrill.description}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}