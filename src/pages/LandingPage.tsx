import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  X,
  Facebook,
  Instagram,
  MapPin,
  Clock,
  Play,
  Megaphone,
  CheckCircle,
  Trophy,
  Users,
  Target,
  ShieldCheck,
  CalendarDays,
  Dumbbell,
  Star,
  HandHeart,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getYoutubeId, getYoutubeThumbnail } from '../lib/utils'

interface Game {
  id: string
  opponent: string
  date: string
  time: string
  location: string
}

interface Event {
  id: string
  title: string
  date: string
  time: string
  location: string
  description?: string
}

interface Announcement {
  id: string
  title: string
  body: string
  audience: string
  priority: string
  is_pinned: boolean
  expires_at?: string
  created_at: string
}

interface Spotlight {
  id: string
  type: 'player' | 'sponsor'
  title: string
  subtitle?: string
  body: string
  image_url?: string
  link_url?: string
  is_published: boolean
  created_at: string
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
  video_url?: string;
  youtube_url?: string;
  thumbnail_url?: string;
  duration: number;
  difficulty: string;
  description: string;
}

const programCards = [
  {
    title: 'Junior Academy',
    ages: 'U6 - U10',
    image: '/Junior Academy.jpg',
    badge: 'Foundation',
    description:
      'Fun, fundamentals, and love for the game. Players build coordination, confidence, ball mastery, and first-team habits.',
  },
  {
    title: 'Competitive',
    ages: 'U12 - U16',
    image: '/Competitive.jpg',
    badge: 'Popular',
    description:
      'Tactical training, league preparation, and tournament habits for players ready to compete with discipline and purpose.',
  },
  {
    title: 'Elite Performance',
    ages: 'Advanced',
    image: '/Elite Performance.jpg',
    badge: 'High intensity',
    description:
      'Advanced coaching for top-tier talent with speed, strength, decision-making, and match-performance development.',
  },
];

const clubSlideshowPhotos = [
  { image: '/slideshow/web/bamika-slide-01.jpg', fit: 'contain', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-02.jpg', fit: 'cover', position: 'center 30%' },
  { image: '/slideshow/web/bamika-slide-03.jpg', fit: 'cover', position: 'center 28%' },
  { image: '/slideshow/web/bamika-slide-04.jpg', fit: 'contain', position: 'center 24%' },
  { image: '/slideshow/web/bamika-slide-05.jpg', fit: 'cover', position: 'center 28%' },
  { image: '/slideshow/web/bamika-slide-06.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-07.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-08.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-09.jpg', fit: 'cover', position: 'center 28%' },
  { image: '/slideshow/web/bamika-slide-10.jpg', fit: 'cover', position: 'center 28%' },
  { image: '/slideshow/web/bamika-slide-11.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-12.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-13.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-14.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-15.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-16.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-17.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-18.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-19.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-20.jpg', fit: 'cover', position: 'center 26%' },
  { image: '/slideshow/web/bamika-slide-21.jpg', fit: 'cover', position: 'center 24%' },
  { image: '/slideshow/web/bamika-slide-22.jpg', fit: 'cover', position: 'center 24%' },
  { image: '/slideshow/web/bamika-slide-23.jpg', fit: 'contain', position: 'center 24%' },
];

const heroSlideCopy = [
  {
    label: 'Bamika FC',
    title: 'Our Players. Our Club.',
    description:
      'Real Bamika FC players, coaches, and families are the heartbeat of the club on training days and match days.',
  },
  {
    label: 'Match day energy',
    title: 'Compete Together.',
    description:
      'Every match is a chance to show discipline, courage, teamwork, and the Bamika FC standard.',
  },
  {
    label: 'Player development',
    title: 'Grow Every Session.',
    description:
      'Players build confidence through repetition, coaching feedback, and training habits that carry into games.',
  },
  {
    label: 'Team culture',
    title: 'Play For The Badge.',
    description:
      'Bamika FC is built on effort, respect, family support, and pride in representing the club.',
  },
];

const heroSlides = clubSlideshowPhotos.map((photo, index) => ({
  ...photo,
  ...heroSlideCopy[index % heroSlideCopy.length],
}));

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
    bio: 'Gharzay specializes in tactical training and physical conditioning. With a deep understanding of the game, he mentors players to build game intelligence, resilience, and a competitive winning mentality.',
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
    <div className="bg-black border border-gray-800 rounded-2xl p-6 text-center hover:border-[#EF4444] hover:-translate-y-1 transition-all duration-300 group flex flex-col items-center h-full shadow-lg hover:shadow-red-900/20">
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

const getDrillVideoUrl = (drill: Drill) => drill.video_url || drill.youtube_url || '';

const DrillCard = ({ drill, onPlay }: { drill: Drill, onPlay: (url: string) => void }) => {
  const drillVideoUrl = getDrillVideoUrl(drill);
  const thumbnail = drill.thumbnail_url || getYoutubeThumbnail(drillVideoUrl);

  return (
  <div className="bg-neutral-950 rounded-2xl overflow-hidden border border-gray-800 group hover:border-[#EF4444] transition-all hover:-translate-y-1">
    <div className="relative aspect-video bg-black overflow-hidden cursor-pointer" onClick={() => onPlay(drillVideoUrl)}>
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
         onClick={() => onPlay(drillVideoUrl)} 
         className="w-full py-3 bg-[#EF4444] text-white rounded-xl text-[10px] font-black uppercase italic hover:bg-red-700 transition-all shadow-lg shadow-red-500/20" 
       > 
         Watch Drill
      </button> 
     </div> 
   </div>
  );
}

const VideoModal = ({ videoUrl, onClose }: { videoUrl: string | null; onClose: () => void }) => {
  if (!videoUrl) return null;
  const videoId = getYoutubeId(videoUrl);
  if (!videoId) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 md:p-10" onClick={onClose}>
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800" onClick={(event) => event.stopPropagation()}>
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
  const [games, setGames] = useState<Game[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
  const [spotlights, setSpotlights] = useState<Spotlight[]>([])
  const [loadingSpotlights, setLoadingSpotlights] = useState(true)
  const [drills, setDrills] = useState<Drill[]>([])
  const [loadingDrills, setLoadingDrills] = useState(true)
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);

  useEffect(() => {
    fetchUpcomingGames()
    fetchUpcomingEvents()
    fetchAnnouncements()
    fetchSpotlights()
    fetchDrills()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, []);

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

  const fetchUpcomingEvents = async () => {
    setLoadingEvents(true)
    try {
      const today = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoadingEvents(false)
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

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .in('audience', ['public', 'everyone'])
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3)

      if (error) throw error
      setAnnouncements(data || [])
    } catch (error) {
      console.error('Error fetching announcements:', error)
    } finally {
      setLoadingAnnouncements(false)
    }
  }

  const fetchSpotlights = async () => {
    setLoadingSpotlights(true)
    try {
      const { data, error } = await supabase
        .from('recognition_items')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) throw error
      setSpotlights(data || [])
    } catch (error) {
      console.error('Error fetching spotlights:', error)
      setSpotlights([])
    } finally {
      setLoadingSpotlights(false)
    }
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen w-full bg-black font-sans text-gray-900">

      {/* HERO */}
      <section className="relative min-h-[calc(100vh-5rem)] w-full overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80")',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.92),rgba(0,0,0,0.72),rgba(0,0,0,0.2))]"></div>
          <div className="absolute inset-x-0 bottom-0 h-48 bg-[linear-gradient(0deg,#000,transparent)]"></div>
        </div>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-white">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 backdrop-blur">
              <Trophy size={15} className="text-[#D4AF37]" />
              Elk Grove youth soccer academy
            </div>

            <img src="/logo.png" alt="Bamika FC Logo" className="mb-7 h-20 w-auto sm:h-32" />

            <h1 className="heading-bamika max-w-4xl text-4xl leading-[0.95] sm:text-7xl lg:text-8xl">
              Build Skill. <span className="text-[#EF4444]">Play Brave.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-gray-200 sm:text-lg md:text-2xl md:leading-8">
              Bamika FC develops confident players through technical training, team discipline, coach communication, and a clear path from first touch to match day.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#EF4444] px-6 py-4 text-sm font-black uppercase text-white shadow-xl shadow-red-950/40 transition-all hover:-translate-y-0.5 hover:bg-red-700 sm:w-auto sm:px-8 sm:text-base"
              >
                Register Player <ArrowRight size={22} />
              </Link>

              <button
                onClick={() => scrollToSection('pricing')}
                className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-white/25 bg-black/40 px-6 py-4 text-sm font-black uppercase text-white backdrop-blur transition-all hover:border-white hover:bg-white hover:text-black sm:w-auto sm:px-8 sm:text-base"
              >
                View Promo
              </button>
            </div>

            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['U6-U16', 'Programs'],
                ['$50/mo', 'June promo'],
                ['$0', 'Registration'],
              ].map(([value, label]) => (
                <div key={label} className="border-l-2 border-[#EF4444] bg-black/45 p-4 backdrop-blur">
                  <div className="text-xl font-black text-white sm:text-2xl">{value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
                </div>
              ))}
            </div>

          </div>

          <div className="rounded-2xl border border-white/10 bg-black/75 p-5 text-white shadow-2xl shadow-black/40 backdrop-blur sm:p-6 lg:self-center">
            <div className="inline-flex rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
              Family hub
            </div>
            <h2 className="mt-5 text-3xl font-black uppercase italic leading-tight sm:text-4xl">
              Everything families need, right up front.
            </h2>
            <p className="mt-4 text-sm leading-7 text-gray-400">
              Register a player, check the promo price, view practice updates, and open the training lab from one clean place.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link to="/register" className="group rounded-xl border border-gray-800 bg-neutral-950 p-4 transition hover:border-[#EF4444]">
                <Target className="mb-3 text-[#EF4444]" size={22} />
                <div className="text-sm font-black uppercase text-white">Register</div>
                <p className="mt-1 text-xs text-gray-500">Start player signup</p>
              </Link>
              <button onClick={() => scrollToSection('pricing')} className="rounded-xl border border-gray-800 bg-neutral-950 p-4 text-left transition hover:border-[#D4AF37]">
                <ShieldCheck className="mb-3 text-[#D4AF37]" size={22} />
                <div className="text-sm font-black uppercase text-white">Pricing</div>
                <p className="mt-1 text-xs text-gray-500">$50 June promo</p>
              </button>
              <button onClick={() => scrollToSection('schedule')} className="rounded-xl border border-gray-800 bg-neutral-950 p-4 text-left transition hover:border-green-500">
                <CalendarDays className="mb-3 text-green-500" size={22} />
                <div className="text-sm font-black uppercase text-white">Schedule</div>
                <p className="mt-1 text-xs text-gray-500">Practice and matches</p>
              </button>
              <Link to="/training-lab" className="rounded-xl border border-gray-800 bg-neutral-950 p-4 transition hover:border-white">
                <Dumbbell className="mb-3 text-gray-300" size={22} />
                <div className="text-sm font-black uppercase text-white">Training</div>
                <p className="mt-1 text-xs text-gray-500">Drills and videos</p>
              </Link>
            </div>
            <Link
              to="/club"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-4 text-sm font-black uppercase text-white transition hover:border-[#EF4444] hover:bg-[#EF4444]"
            >
              Coaches, Photos & Club Info <ArrowRight size={18} />
            </Link>
          </div>

          <div className="hidden">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/70 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="relative h-[30rem] bg-black">
                {heroSlides.map((slide, index) => (
                  <div
                    key={slide.image}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                      index === activeHeroSlide ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <img
                      src={slide.image}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl"
                      style={{ objectPosition: slide.position }}
                    />
                    <img
                      src={slide.image}
                      alt={slide.label}
                      className={`relative z-10 h-full w-full ${slide.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
                      style={{ objectPosition: slide.position }}
                    />
                  </div>
                ))}
                <div className="absolute inset-0 z-20 bg-[linear-gradient(0deg,rgba(0,0,0,0.78),rgba(0,0,0,0.05)_55%,rgba(0,0,0,0.18))]"></div>
                <div className="absolute bottom-5 left-5 right-5 z-30">
                  <div className="mb-2 inline-flex rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    Bamika FC moments
                  </div>
                  <h2 className="text-3xl font-black uppercase italic text-white">{heroSlides[activeHeroSlide].title}</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-300">
                    {heroSlides[activeHeroSlide].description}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-4" aria-label="Training slideshow controls">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-[#EF4444] transition-all duration-500"
                        style={{ width: `${((activeHeroSlide + 1) / heroSlides.length) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveHeroSlide((current) => (current - 1 + heroSlides.length) % heroSlides.length)}
                        className="h-9 w-9 rounded-full border border-white/20 bg-black/55 text-sm font-black text-white hover:border-[#EF4444]"
                        aria-label="Show previous slide"
                      >
                        ‹
                      </button>
                      <span className="min-w-[3.5rem] text-center text-[10px] font-black uppercase tracking-widest text-gray-300">
                        {String(activeHeroSlide + 1).padStart(2, '0')} / {heroSlides.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveHeroSlide((current) => (current + 1) % heroSlides.length)}
                        className="h-9 w-9 rounded-full border border-white/20 bg-black/55 text-sm font-black text-white hover:border-[#EF4444]"
                        aria-label="Show next slide"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-800">
                <div className="p-5">
                  <Target className="mb-3 text-[#EF4444]" size={22} />
                  <div className="text-sm font-black uppercase text-white">Skills</div>
                  <p className="mt-1 text-xs text-gray-500">Ball mastery</p>
                </div>
                <div className="p-5">
                  <Users className="mb-3 text-[#D4AF37]" size={22} />
                  <div className="text-sm font-black uppercase text-white">Teams</div>
                  <p className="mt-1 text-xs text-gray-500">Coach led</p>
                </div>
                <div className="p-5">
                  <ShieldCheck className="mb-3 text-green-500" size={22} />
                  <div className="text-sm font-black uppercase text-white">Growth</div>
                  <p className="mt-1 text-xs text-gray-500">Player path</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANNOUNCEMENTS */}
      <section id="announcements" className="bg-neutral-950 py-16 w-full border-y border-gray-900">
        <div className="w-full px-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <Megaphone size={14} className="text-[#EF4444]" />
                  Club updates
                </div>
                <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight text-white">
                  Latest <span className="text-[#EF4444]">Announcements</span>
                </h2>
              </div>
            </div>

            {loadingAnnouncements ? (
              <div className="text-sm font-bold uppercase tracking-widest text-gray-500">Loading announcements...</div>
            ) : announcements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-black p-8 text-center text-gray-500">
                No homepage announcements right now.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {announcements.map((announcement) => (
                  <article key={announcement.id} className={`rounded-2xl border p-6 ${announcement.priority === 'important' ? 'border-[#EF4444]/70 bg-[#EF4444]/10' : 'border-gray-800 bg-black'}`}>
                    <div className="mb-4 flex flex-wrap gap-2">
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
                    <h3 className="text-xl font-black uppercase italic leading-tight text-white">{announcement.title}</h3>
                    <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm leading-6 text-gray-400">{announcement.body}</p>
                    <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-gray-600">
                      {new Date(announcement.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PLAYER & SPONSOR SPOTLIGHTS */}
      <section id="spotlights" className="bg-black py-16 w-full border-b border-gray-900">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <Star size={14} className="text-[#D4AF37]" />
                Recognition
              </div>
              <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tight text-white">
                Players & <span className="text-[#D4AF37]">Sponsors</span>
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-gray-500">
              Celebrating standout effort from our athletes and the businesses helping Bamika FC grow.
            </p>
          </div>

          {loadingSpotlights ? (
            <div className="text-sm font-bold uppercase tracking-widest text-gray-500">Loading spotlights...</div>
          ) : spotlights.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-800 bg-neutral-950 p-8 text-center text-gray-500">
              Player and sponsor spotlights will appear here soon.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {spotlights.map((spotlight) => (
                <article key={spotlight.id} className="group overflow-hidden rounded-2xl border border-gray-800 bg-neutral-950 transition-colors hover:border-[#D4AF37]/70">
                  <div className="relative aspect-[16/10] bg-black">
                    {spotlight.image_url ? (
                      <img src={spotlight.image_url} alt={spotlight.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        {spotlight.type === 'sponsor' ? (
                          <HandHeart className="text-[#D4AF37]" size={48} />
                        ) : (
                          <Star className="text-[#EF4444]" size={48} />
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.85),transparent_70%)]"></div>
                    <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white ${spotlight.type === 'sponsor' ? 'bg-[#D4AF37]' : 'bg-[#EF4444]'}`}>
                      {spotlight.type === 'sponsor' ? 'Sponsor' : 'Player'}
                    </span>
                  </div>
                  <div className="p-6">
                    {spotlight.subtitle && (
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">{spotlight.subtitle}</p>
                    )}
                    <h3 className="text-2xl font-black uppercase italic leading-tight text-white">{spotlight.title}</h3>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-gray-400">{spotlight.body}</p>
                    {spotlight.link_url && (
                      <a
                        href={spotlight.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#D4AF37] hover:text-white"
                      >
                        {spotlight.type === 'sponsor' ? 'Visit Sponsor' : 'Learn More'}
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* PLAYER PATH */}
      <section className="bg-black py-20 w-full">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <Dumbbell size={14} className="text-[#EF4444]" />
                Player development
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tight text-white md:text-5xl">
                A clear path from practice to <span className="text-[#EF4444]">game day</span>
              </h2>
              <p className="mt-5 text-base leading-8 text-gray-400">
                Families get organized communication, coaches get team tools, and players get structured training that carries into matches.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['01', 'Register', 'Create a parent account and add your athlete profile.'],
                ['02', 'Train', 'Join practices, follow coach notes, and use Training Lab tutorials.'],
                ['03', 'Compete', 'Get placed with a team and prepare for matches with confidence.'],
              ].map(([number, title, copy]) => (
                <div key={title} className="rounded-2xl border border-gray-800 bg-neutral-950 p-6 transition-colors hover:border-[#EF4444]/70">
                  <div className="text-4xl font-black italic text-[#EF4444]">{number}</div>
                  <h3 className="mt-5 text-xl font-black uppercase italic text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-500">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAMS */}
      <section id="programs" className="py-24 bg-neutral-950 w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Target size={14} className="text-[#EF4444]" />
              Programs
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Training for <span className="text-[#EF4444]">Every Level</span>
            </h2>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {programCards.map((program) => (
              <div key={program.title} className="group overflow-hidden rounded-2xl border border-gray-800 bg-black shadow-xl shadow-black/30 transition-all hover:-translate-y-2 hover:border-[#EF4444]/70">
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={program.image}
                    alt={program.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.8),transparent)]"></div>
                  <span className="absolute left-5 top-5 rounded-full bg-[#EF4444] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    {program.badge}
                  </span>
                  <div className="absolute bottom-5 left-5 right-5">
                    <p className="text-xs font-black uppercase tracking-widest text-[#D4AF37]">{program.ages}</p>
                    <h3 className="mt-1 text-3xl font-black uppercase italic text-white">{program.title}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm leading-7 text-gray-400">{program.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRAM DETAILS & PRICING */}
      <section id="pricing" className="py-20 bg-black w-full border-y border-gray-900">
        <div className="w-full px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <ShieldCheck size={14} className="text-green-500" />
                Simple pricing
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
                Program Details <span className="text-[#EF4444]">& Prices</span>
              </h2>
              <p className="mx-auto max-w-2xl text-gray-400">
                Clear soccer training costs for families joining Bamika FC.
              </p>
              <div className="h-1 w-24 bg-[#EF4444] mx-auto mt-5"></div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-6 md:p-8">
                <h3 className="text-2xl font-black uppercase italic text-white">What Players Receive</h3>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[
                    'Age-appropriate technical training',
                    'Team practices and match preparation',
                    'Coach communication with parents',
                    'Player development through the Training Lab',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-xl border border-gray-800 bg-black p-4">
                      <CheckCircle className="mt-0.5 shrink-0 text-[#EF4444]" size={18} />
                      <span className="text-sm font-bold text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 overflow-hidden rounded-2xl border border-gray-800">
                  <img src="/Elite Performance.jpg" alt="Bamika FC training session" className="h-60 w-full object-cover" />
                </div>
              </div>

              <div className="rounded-2xl border border-[#EF4444]/40 bg-neutral-950 p-6 shadow-2xl shadow-red-950/20 md:p-8">
                <h3 className="text-2xl font-black uppercase italic text-white">Family Cost</h3>
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Promo through June 30</div>
                    <p className="mt-2 text-sm font-bold text-white">
                      Registration fee waived and monthly club fee is $50/mo for families who sign up by June 30.
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-bold text-gray-300">Promo registration fee</span>
                    <span className="text-2xl font-black text-white">$0</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-bold text-gray-300">Promo monthly fee</span>
                    <span className="text-2xl font-black text-white">$50/mo</span>
                  </div>
                  <div className="border-b border-white/10 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-300">Full uniform package</span>
                      <span className="text-2xl font-black text-white">$100</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-400">
                      Includes game jersey, shorts, socks, and a practice jersey.
                    </p>
                  </div>
                  <p className="text-xs font-bold uppercase leading-5 tracking-widest text-gray-500">
                    Starting July 1: $99 registration fee plus the regular monthly club fee.
                  </p>
                  <Link
                    to="/register"
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-6 py-4 text-sm font-black uppercase text-white transition-all hover:-translate-y-0.5 hover:bg-red-700"
                  >
                    Register Player <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRAINING SCHEDULE */}
      <section id="schedule" className="py-24 bg-neutral-950 w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <CalendarDays size={14} className="text-[#EF4444]" />
              Live schedule
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Training <span className="text-[#EF4444]">Schedule</span>
            </h2>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>
          {loadingEvents ? (
            <div className="text-center text-gray-400">Loading practice schedule...</div>
          ) : events.length === 0 ? (
            <div className="text-center text-gray-500 italic">
              No upcoming practices scheduled at the moment.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {events.map((event) => (
                <div key={event.id} className="bg-black border border-gray-800 rounded-2xl p-6 hover:border-[#EF4444] transition-all duration-300 group flex flex-col h-full shadow-lg hover:shadow-red-900/20">
                  <span className="text-[#EF4444] font-bold uppercase text-xs tracking-wider mb-3">
                    {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#EF4444] transition-colors">{event.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm flex items-center gap-2">
                    <Clock size={14} className="text-[#EF4444]" />
                    {event.time
                      ? new Date(`1970-01-01T${event.time}`).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'TBA'}
                  </p>
                  <p className="text-gray-400 leading-relaxed text-sm mt-2 flex items-center gap-2">
                    <MapPin size={14} className="text-[#EF4444]" />
                    {event.location}
                  </p>
                  {event.description && (
                    <p className="mt-4 border-t border-gray-800 pt-4 text-sm text-gray-500">{event.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      
      {/* TRAINING LAB */}
      <section id="training-lab" className="py-24 bg-black w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Play size={14} className="text-[#EF4444]" />
              Video tutorials
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Training <span className="text-[#EF4444]">Lab</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Hone your skills with our curated collection of training drills and tutorials.</p>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto mt-4"></div>
          </div>
          {loadingDrills ? (
            <div className="text-center text-gray-400">Loading drills...</div>
          ) : drills.length === 0 ? (
            <div className="text-center text-gray-500 italic">
              Training videos are being updated. Check back soon for new drills.
            </div>
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
      <section id="coaches" className="hidden">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Users size={14} className="text-[#EF4444]" />
              Coaching staff
            </div>
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
      <section className="py-20 bg-black w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Trophy size={14} className="text-[#D4AF37]" />
              Match day
            </div>
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
      <footer id="contact" className="bg-neutral-950 text-white py-12 border-t border-gray-800 w-full">
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
              <p className="mt-2 text-sm font-bold text-gray-400">Elk Grove youth soccer training, teams, and player development.</p>
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
