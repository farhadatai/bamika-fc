import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  LogIn,
  Menu,
  X,
  Facebook,
  Instagram,
  MapPin,
  Clock,
  Play,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// UTILS
const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};


interface Game {
  id: string
  opponent: string
  date: string
  time: string
  location: string
}

interface Coach {
  name: string
  role: string
  bio: string
  image: string
}

interface Drill {
  id: string;
  title: string;
  video_url: string;
  thumbnail_url: string;
  duration: number;
  difficulty: string;
  description: string;
}

interface TrainingSession {
  day: string;
  time: string;
  ageGroup: string;
  location: string;
}

const trainingSchedule: TrainingSession[] = [
  { day: 'Monday & Wednesday', time: '6:00 PM - 7:30 PM', ageGroup: 'U8-U10', location: 'Elk Grove Park' },
  { day: 'Tuesday & Thursday', time: '6:00 PM - 7:30 PM', ageGroup: 'U12-U14', location: 'Bartholomew Sports Park' },
  { day: 'Friday', time: '7:00 PM - 8:30 PM', ageGroup: 'U16+', location: 'Hal Bartholomew Sports Park' },
];


const coachesData: Coach[] = [
  {
    name: 'Farhad Atai',
    role: 'Coach',
    image:
      'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/FarhadA.png',
    bio: 'Farhad brings extensive experience and a passion for player development. Dedicated to fostering both technical skills and sportsmanship, he works tirelessly to ensure every athlete reaches their full potential on and off the field.',
  },
  {
    name: 'Gharzay Ahmadzai',
    role: 'Coach',
    image:
      'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Gharzay.png',
    bio: 'Gharzay specializes in tactical training and physical conditioning. With a deep understanding of the game’s strategic elements, he mentors players to build game intelligence, resilience, and a competitive winning mentality.',
  },
  {
    name: 'Qais Atai',
    role: 'Coach',
    image:
      'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Qais.png',
    bio: 'Qais focuses on technical ball mastery and creative play. His energetic coaching style inspires young players to express themselves on the field while mastering the essential fundamentals of the game.',
  },
  {
    name: 'Atiqullah Hamidi',
    role: 'Coach',
    image:
      'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Atiqullah.png',
    bio: 'Atiqullah brings a wealth of knowledge in player discipline and team strategy. He is committed to developing well-rounded athletes who understand the importance of hard work, respect, and tactical awareness.',
  },
  {
    name: 'Ahmadullah Azizi',
    role: 'Coach',
    image:
      'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Ahmadullah.png',
    bio: 'Ahmadullah is dedicated to fostering a supportive and challenging environment. He emphasizes the development of core soccer skills while encouraging players to push their limits and achieve personal growth.',
  },
  {
    name: 'Abobaker Sameer',
    role: 'Coach',
    image:
      'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Abobaker.jpg',
    bio: 'Abobaker combines his passion for the sport with a focus on agility and speed training. He works with players to enhance their physical capabilities and reaction times, essential for the modern game.',
  },
  {
    name: 'Seema Sadat',
    role: 'Coach',
    image:
      'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/coach-photos/ChatGPT%20Image%20Feb%2014,%202026,%2011_58_58%20AM.png',
    bio: 'Seema is a dedicated coach who focuses on developing player confidence and technical skills. She brings passion and expertise to help young athletes reach their full potential.',
  },

]

const CoachCard = ({ coach }: { coach: Coach }) => {
  const [expanded, setExpanded] = useState(false)
  const isLongBio = coach.bio.length > 100

  return (
    <div className="bg-black border border-gray-800 rounded-2xl p-6 text-center hover:border-[#EF4444] hover:scale-105 transition-all duration-300 group flex flex-col items-center h-full shadow-lg hover:shadow-red-900/20">
      <div className="relative w-32 h-32 mb-4">
        <div className="absolute inset-0 bg-[#EF4444] rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
        <img
          src={coach.image}
          alt={coach.name}
          className="relative w-full h-full object-cover rounded-full border-4 border-gray-800 group-hover:border-[#EF4444] transition-colors shadow-2xl"
        />
      </div>

      <h3 className="text-xl font-bold text-white mb-1">{coach.name}</h3>
      <p className="text-[#EF4444] font-bold uppercase text-xs tracking-wider mb-4">
        {coach.role}
      </p>

      <div className="text-gray-400 leading-relaxed text-sm">
        <p className={expanded ? '' : 'line-clamp-3'}>{coach.bio}</p>
        {isLongBio && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[#EF4444] font-bold mt-2 hover:text-red-400 transition-colors text-xs uppercase tracking-wide"
          >
            {expanded ? 'Show Less' : 'Read More'}
          </button>
        )}
      </div>
    </div>
  )
}

const DrillCard = ({ drill, onPlay }: { drill: Drill, onPlay: (url: string) => void }) => (
  <div className="bg-neutral-900 rounded-3xl overflow-hidden border border-gray-800 group hover:border-[#EF4444] transition-all">
    <div className="relative aspect-video bg-black overflow-hidden cursor-pointer" onClick={() => onPlay(drill.video_url)}>
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
         onClick={() => onPlay(drill.video_url)} 
         className="w-full py-3 bg-[#EF4444] text-white rounded-xl text-[10px] font-black uppercase italic hover:bg-red-700 transition-all shadow-lg shadow-red-500/20" 
       > 
         Watch Drill
       </button> 
     </div> 
   </div> 
)

const VideoModal = ({ videoUrl, onClose }) => {
  if (!videoUrl) return null;
  const videoId = getYoutubeId(videoUrl);

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-10" onClick={onClose}>
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-[#EF4444] text-white p-2 rounded-full transition-all"
        > 
          <X size={24} /> 
        </button> 
        <iframe 
          className="w-full h-full" 
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`} 
          title="Training Drill" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen 
        ></iframe> 
      </div> 
    </div>
  );
};


export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [drills, setDrills] = useState<Drill[]>([])
  const [loadingDrills, setLoadingDrills] = useState(true)
  const [activeVideo, setActiveVideo] = useState<string | null>(null);


  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    fetchUpcomingGames()
    fetchDrills()
  }, [])

  const fetchUpcomingGames = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (error) throw error
      setGames(data || [])
    } catch (error) {
      console.error('Error fetching games:', error)
    } finally {
      setLoadingGames(false)
    }
  }

  const fetchDrills = async () => {
    setLoadingDrills(true);
    try {
      const { data, error } = await supabase.from('drills').select('*').order('created_at', { ascending: false }).limit(6);
      if (error) throw error;
      setDrills(data || []);
    } catch (error) {
      console.error('Error fetching drills:', error);
    } finally {
      setLoadingDrills(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
      setMobileMenuOpen(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-black font-sans text-gray-900">

      {/* HERO */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80")',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
        </div>

        <div className="relative z-10 w-full px-6 text-center text-white space-y-8 max-w-5xl mx-auto">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight uppercase leading-none drop-shadow-2xl">
            BAMIKA <span className="text-[#EF4444]">FC</span>
          </h1>

          <p className="text-xl md:text-3xl text-gray-200 font-medium max-w-3xl mx-auto">
            Elk Grove’s Premier Youth Soccer Academy.
          </p>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-center gap-6">
            <Link
              to="/register"
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-[#EF4444] hover:bg-red-700 text-white px-10 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-xl hover:shadow-red-900/40"
            >
              Register Player <ArrowRight size={24} />
            </Link>

            <Link
              to="/login"
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 border-2 border-white/80 hover:bg-white hover:text-black text-white px-10 py-4 rounded-full font-bold text-lg transition-all"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* PROGRAMS */}
      <section id="programs" className="py-24 bg-black w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Training for <span className="text-[#EF4444]">Every Level</span>
            </h2>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:-translate-y-2 transition-transform duration-300 group">
              <div className="h-48 overflow-hidden">
                <img
                  src="/Junior Academy.jpg"
                  alt="Junior Academy"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2 text-gray-900">Junior Academy</h3>
                <p className="text-[#EF4444] font-bold mb-4">U6 - U10</p>
                <p className="text-gray-600 leading-relaxed">
                  Fun, fundamentals, and love for the game. We focus on basic skills,
                  coordination, and building confidence in our youngest players.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:-translate-y-2 transition-transform duration-300 group relative">
              <div className="absolute top-4 right-4 z-10 bg-[#EF4444] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                POPULAR
              </div>
              <div className="h-48 overflow-hidden">
                <img
                  src="/Competitive.jpg"
                  alt="Competitive Team"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2 text-gray-900">Competitive</h3>
                <p className="text-[#EF4444] font-bold mb-4">U12 - U16</p>
                <p className="text-gray-600 leading-relaxed">
                  Tactical training, league play, and tournaments. Players develop game
                  intelligence, teamwork, and competitive spirit in a structured environment.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:-translate-y-2 transition-transform duration-300 group">
              <div className="h-48 overflow-hidden">
                <img
                  src="/Elite Performance.jpg"
                  alt="Elite Performance"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2 text-gray-900">Elite Performance</h3>
                <p className="text-[#EF4444] font-bold mb-4">Advanced</p>
                <p className="text-gray-600 leading-relaxed">
                  Advanced coaching for top-tier talent. Intensive training focused on
                  high-performance conditioning, strategy, and preparing for collegiate or
                  professional levels.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRAINING SCHEDULE */}
      <section id="schedule" className="py-24 bg-neutral-900 w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Training <span className="text-[#EF4444]">Schedule</span>
            </h2>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {trainingSchedule.map((session, index) => (
              <div key={index} className="bg-black border border-gray-800 rounded-2xl p-6 text-center hover:border-[#EF4444] hover:scale-105 transition-all duration-300 group flex flex-col items-center h-full shadow-lg hover:shadow-red-900/20">
                <h3 className="text-xl font-bold text-white mb-2">{session.ageGroup}</h3>
                <p className="text-[#EF4444] font-bold uppercase text-xs tracking-wider mb-4">{session.day}</p>
                <p className="text-gray-400 leading-relaxed text-sm">{session.time}</p>
                <p className="text-gray-400 leading-relaxed text-sm mt-2">{session.location}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* TRAINING LAB */}
      <section id="training-lab" className="py-24 bg-black w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Training <span className="text-[#EF4444]">Lab</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Hone your skills with our curated collection of training drills and tutorials.</p>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto mt-4"></div>
          </div>
          {loadingDrills ? (
            <div className="text-center text-gray-400">Loading drills...</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {drills.map((drill) => (
                <DrillCard key={drill.id} drill={drill} onPlay={setActiveVideo} />
              ))}
            </div>
          )}
           <div className="text-center mt-12">
            <Link
              to="/login"
              className="px-8 py-3 bg-transparent border-2 border-[#EF4444] hover:bg-[#EF4444] text-white font-black italic uppercase tracking-wider skew-x-[-12deg] transition-all transform hover:scale-105"
            >
              <span className="block skew-x-[12deg]">Access Full Lab</span>
            </Link>
          </div>
        </div>
      </section>

      {/* COACHES */}
      <section id="coaches" className="py-24 bg-neutral-900 w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Meet Our <span className="text-[#EF4444]">Coaches</span>
            </h2>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {coachesData.map((coach, index) => (
              <CoachCard key={index} coach={coach} />
            ))}
          </div>
        </div>
      </section>

      {/* MATCHES */}
      <section className="py-20 bg-neutral-900 w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white mb-4">
              UPCOMING <span className="text-[#EF4444]">MATCHES</span>
            </h2>
            <div className="w-24 h-2 bg-[#EF4444] mx-auto skew-x-[-12deg]"></div>
          </div>

          {loadingGames ? (
            <div className="text-center text-gray-400">Loading upcoming matches...</div>
          ) : games.length === 0 ? (
            <div className="text-center text-gray-500 italic">
              No upcoming matches scheduled at the moment.
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="bg-black border border-gray-800 p-6 rounded-xl hover:border-[#EF4444] transition-colors group"
                >
                  <div className="flex flex-col h-full">
                    <div className="mb-4">
                      <span className="text-[#EF4444] font-bold text-sm uppercase tracking-wider block mb-1">
                        {new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>

                      <span className="text-gray-400 text-sm flex items-center gap-2">
                        <Clock size={14} />
                        {game.time
                          ? new Date(`1970-01-01T${game.time}`).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'TBA'}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-4 group-hover:text-[#EF4444] transition-colors">
                      vs. {game.opponent}
                    </h3>

                    <div className="mt-auto pt-4 border-t border-gray-800 flex items-center text-gray-400 text-sm">
                      <MapPin size={16} className="mr-2 text-[#EF4444]" />
                      {game.location}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <button
              onClick={() => scrollToSection('contact')}
              className="px-8 py-3 bg-[#EF4444] hover:bg-red-600 text-white font-black italic uppercase tracking-wider skew-x-[-12deg] transition-all transform hover:scale-105 shadow-lg shadow-red-900/20"
            >
              <span className="block skew-x-[12deg]">View Full Schedule</span>
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="bg-black text-white py-12 border-t border-gray-800 w-full">
        <div className="w-full px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 max-w-7xl mx-auto">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                <img src="/logo.png" alt="Bamika FC" className="h-8 w-auto" />
                <span className="text-xl font-bold tracking-tighter uppercase">
                  Bamika <span className="text-[#EF4444]">FC</span>
                </span>
              </div>
              <p className="text-gray-500 text-sm">&copy; 2026 Bamika FC. All rights reserved.</p>
            </div>

            <div className="flex gap-6">
              <a href="#" className="text-gray-400 hover:text-[#EF4444] transition-colors">
                <Facebook size={24} />
                <span className="sr-only">Facebook</span>
              </a>
              <a href="#" className="text-gray-400 hover:text-[#EF4444] transition-colors">
                <Instagram size={24} />
                <span className="sr-only">Instagram</span>
              </a>
            </div>

            <div className="flex gap-6 text-sm font-medium text-gray-400">
              <Link to="/login" className="hover:text-white transition-colors">
                Login
              </Link>
              <a href="#" className="hover:text-white transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white transition-colors">
                Terms
              </a>
            </div>
          </div>
        </div>
      </footer>
      
      <VideoModal videoUrl={activeVideo} onClose={() => setActiveVideo(null)} />

    </div>
  )
}