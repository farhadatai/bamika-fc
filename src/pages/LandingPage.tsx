import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Facebook, Instagram, Shield, Award, Users, Star, Calendar, MapPin, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Game {
  id: string;
  opponent: string;
  date: string;
  time: string;
  location: string;
}

interface Coach {
  name: string;
  role: string;
  bio: string;
  image: string;
}

const coachesData: Coach[] = [
  {
    name: "Farhad Atai",
    role: "Head Coach",
    image: "https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/FarhadA.png",
    bio: "Farhad brings extensive experience and a passion for player development. Dedicated to fostering both technical skills and sportsmanship."
  },
  {
    name: "Gharzay Ahmadzai",
    role: "Tactical Coach",
    image: "https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Gharzay.png",
    bio: "Gharzay specializes in tactical training and physical conditioning, mentoring players to build game intelligence and resilience."
  },
  {
    name: "Qais Atai",
    role: "Technical Coach",
    image: "https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Qais.png",
    bio: "Qais focuses on technical ball mastery and creative play, inspiring young players to express themselves on the field."
  },
  {
    name: "Atiqullah Hamidi",
    role: "Defensive Specialist",
    image: "https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Atiqullah.png",
    bio: "Atiqullah is committed to developing well-rounded athletes who understand the importance of hard work and tactical awareness."
  },
  {
    name: "Seema Sadat",
    role: "Youth Coach",
    image: "https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/coach-photos/ChatGPT%20Image%20Feb%2014,%202026,%2011_58_58%20AM.png",
    bio: "Seema is a dedicated coach who focuses on developing player confidence and essential technical skills."
  }
];

const CoachCard = ({ coach }: { coach: Coach }) => {
  const [expanded, setExpanded] = useState(false);
  const isLongBio = coach.bio.length > 100;

  return (
    <div className="bg-black border border-gray-800 rounded-2xl p-6 text-center hover:border-[#EF4444] transition-all duration-300 group flex flex-col items-center h-full">
      <div className="relative w-32 h-32 mb-4">
        <div className="absolute inset-0 bg-[#EF4444] rounded-full blur opacity-10 group-hover:opacity-30 transition-opacity"></div>
        <img 
          src={coach.image} 
          alt={coach.name} 
          className="relative w-full h-full object-cover rounded-full border-4 border-gray-800 group-hover:border-[#EF4444] transition-colors"
        />
      </div>
      <h3 className="text-xl font-bold text-white mb-1">{coach.name}</h3>
      <p className="text-[#EF4444] font-bold uppercase text-[10px] tracking-widest mb-4">{coach.role}</p>
      <div className="text-gray-400 text-sm leading-relaxed">
        <p className={expanded ? '' : 'line-clamp-3'}>{coach.bio}</p>
        {isLongBio && (
          <button onClick={() => setExpanded(!expanded)} className="text-[#EF4444] font-bold mt-2 text-xs uppercase">
            {expanded ? 'Less' : 'More'}
          </button>
        )}
      </div>
    </div>
  );
};

export default function LandingPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  useEffect(() => {
    const fetchGames = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('games')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(3);
      setGames(data || []);
      setLoadingGames(false);
    };
    fetchGames();
  }, []);

  return (
    <div className="min-h-screen bg-black">
      
      {/* HERO SECTION */}
      <section className="relative min-h-[85vh] flex items-center justify-center pt-16">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80")' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 text-center text-white space-y-6">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-none italic">
            BAMIKA <span className="text-[#EF4444]">FC</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-200 font-medium max-w-2xl mx-auto italic uppercase tracking-widest">
            Elk Grove’s Premier Youth Soccer Academy
          </p>
          <div className="pt-8 flex flex-col md:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full md:w-auto bg-[#EF4444] text-white px-10 py-4 rounded-full font-black uppercase italic tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2">
              Register Now <ArrowRight size={20} />
            </Link>
            <Link to="/training-lab" className="w-full md:w-auto border-2 border-white text-white px-10 py-4 rounded-full font-black uppercase italic tracking-widest hover:bg-white hover:text-black transition-all">
              Training Lab
            </Link>
          </div>
        </div>
      </section>

      {/* MATCHES SECTION */}
      <section className="py-24 bg-black border-t border-gray-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white uppercase italic">Upcoming <span className="text-[#EF4444]">Matches</span></h2>
            <div className="h-1 w-20 bg-[#EF4444] mx-auto mt-4"></div>
          </div>

          {loadingGames ? (
            <div className="text-center text-gray-500 uppercase font-bold italic">Loading...</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {games.map((game) => (
                <div key={game.id} className="bg-neutral-900 border border-gray-800 p-8 rounded-2xl hover:border-[#EF4444] transition-all group">
                  <div className="text-[#EF4444] font-black uppercase text-xs mb-2 italic tracking-widest">{game.date}</div>
                  <h3 className="text-2xl font-black text-white uppercase mb-6 italic group-hover:text-red-500 transition-colors">vs {game.opponent}</h3>
                  <div className="flex items-center text-gray-400 text-xs font-bold uppercase gap-2">
                    <MapPin size={14} className="text-red-500" /> {game.location}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* COACHES SECTION */}
      <section className="py-24 bg-neutral-950">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white uppercase italic">The <span className="text-[#EF4444]">Staff</span></h2>
            <div className="h-1 w-20 bg-[#EF4444] mx-auto mt-4"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {coachesData.map((coach, index) => (
              <CoachCard key={index} coach={coach} />
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-gray-900 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          <span className="text-white font-black uppercase italic tracking-tighter">Bamika FC</span>
        </div>
        <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest">&copy; 2026 Bamika FC. All rights reserved.</p>
      </footer>
    </div>
  );
}