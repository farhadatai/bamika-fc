import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Facebook,
  Instagram,
  MapPin,
  Clock,
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

export default function LandingPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true)
  const [spotlights, setSpotlights] = useState<Spotlight[]>([])
  const [loadingSpotlights, setLoadingSpotlights] = useState(true)
  const [sponsorForm, setSponsorForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    message: '',
  })
  const [sponsorStatus, setSponsorStatus] = useState('')
  const [submittingSponsor, setSubmittingSponsor] = useState(false)

  useEffect(() => {
    fetchUpcomingGames()
    fetchUpcomingEvents()
    fetchAnnouncements()
    fetchSpotlights()
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

  const handleSponsorFormChange = (field: string, value: string) => {
    setSponsorForm((current) => ({ ...current, [field]: value }))
  }

  const handleSponsorRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittingSponsor(true)
    setSponsorStatus('')

    try {
      const { error } = await supabase.from('sponsor_requests').insert({
        business_name: sponsorForm.businessName,
        contact_name: sponsorForm.contactName,
        email: sponsorForm.email,
        phone: sponsorForm.phone,
        message: sponsorForm.message,
      })

      if (error) throw error

      setSponsorStatus('Thank you. We received your request and will email you with sponsor information.')
      setSponsorForm({
        businessName: '',
        contactName: '',
        email: '',
        phone: '',
        message: '',
      })
    } catch (error) {
      console.error('Error saving sponsor request:', error)
      setSponsorStatus('Sponsor request form needs the latest database update. Please contact Bamika FC directly for now.')
    } finally {
      setSubmittingSponsor(false)
    }
  }

  const sponsorSpotlights = spotlights.filter((spotlight) => spotlight.type === 'sponsor')
  const playerSpotlights = spotlights.filter((spotlight) => spotlight.type !== 'sponsor')

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

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-4xl text-white">
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
                ['Weekly', 'Training'],
                ['Teams', 'Match path'],
              ].map(([value, label]) => (
                <div key={label} className="border-l-2 border-[#EF4444] bg-black/45 p-4 backdrop-blur">
                  <div className="text-xl font-black text-white sm:text-2xl">{value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
                </div>
              ))}
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

      {/* SPONSORS & PLAYER OF THE MONTH */}
      <section id="sponsors" className="bg-black py-20 w-full border-b border-gray-900">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Star size={14} className="text-[#EF4444]" />
              Recognition
            </div>
            <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tight text-white">
              Sponsors <span className="text-[#D4AF37]">&</span> Player of the Month
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-500">
              Sponsors and player recognition stay separate, but families can see both in one organized section.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-2xl border border-[#D4AF37]/35 bg-neutral-950 p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Club partners</div>
                    <h3 className="mt-1 text-3xl font-black uppercase italic text-white">Proud Sponsors</h3>
                  </div>
                  <HandHeart className="text-[#D4AF37]" size={26} />
                </div>

                {loadingSpotlights ? (
                  <div className="text-sm font-bold uppercase tracking-widest text-gray-500">Loading sponsors...</div>
                ) : sponsorSpotlights.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-800 bg-black p-8 text-center text-gray-500">
                    Sponsor promotions will appear here soon.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {sponsorSpotlights.slice(0, 2).map((sponsor) => (
                      <article key={sponsor.id} className="overflow-hidden rounded-xl border border-[#D4AF37]/30 bg-black">
                        <div className="grid gap-0 sm:grid-cols-[0.9fr_1.1fr]">
                          <div className="relative flex min-h-[220px] items-center justify-center bg-neutral-950 p-4">
                            {sponsor.image_url ? (
                              <img src={sponsor.image_url} alt={sponsor.title} className="max-h-64 w-full object-contain" />
                            ) : (
                              <HandHeart className="text-[#D4AF37]" size={52} />
                            )}
                            <span className="absolute left-4 top-4 rounded-full bg-[#D4AF37] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-black">
                              Sponsor
                            </span>
                          </div>
                          <div className="p-5">
                            {sponsor.subtitle && <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">{sponsor.subtitle}</p>}
                            <h4 className="mt-2 text-2xl font-black uppercase italic leading-tight text-white">{sponsor.title}</h4>
                            <p className="mt-3 line-clamp-6 text-sm leading-7 text-gray-400">{sponsor.body}</p>
                            {sponsor.link_url && (
                              <a href={sponsor.link_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-3 text-xs font-black uppercase tracking-widest text-black transition hover:bg-white">
                                Visit Sponsor <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSponsorRequest} className="rounded-2xl border border-gray-800 bg-neutral-950 p-5 md:p-6">
                <div className="mb-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Become a sponsor</div>
                  <h3 className="mt-1 text-2xl font-black uppercase italic text-white">Request Sponsor Info</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Send us your business contact and we will email sponsorship information.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required value={sponsorForm.businessName} onChange={(event) => handleSponsorFormChange('businessName', event.target.value)} placeholder="Business name" className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" />
                  <input required value={sponsorForm.contactName} onChange={(event) => handleSponsorFormChange('contactName', event.target.value)} placeholder="Contact name" className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" />
                  <input required type="email" value={sponsorForm.email} onChange={(event) => handleSponsorFormChange('email', event.target.value)} placeholder="Email address" className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" />
                  <input value={sponsorForm.phone} onChange={(event) => handleSponsorFormChange('phone', event.target.value)} placeholder="Phone number" className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" />
                </div>
                <textarea value={sponsorForm.message} onChange={(event) => handleSponsorFormChange('message', event.target.value)} placeholder="Tell us what kind of sponsorship you are interested in." rows={4} className="mt-3 w-full rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" />
                {sponsorStatus && (
                  <div className="mt-3 rounded-xl border border-gray-800 bg-black p-3 text-sm font-bold text-gray-300">
                    {sponsorStatus}
                  </div>
                )}
                <button disabled={submittingSponsor} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-4 text-sm font-black uppercase text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60">
                  {submittingSponsor ? 'Sending Request...' : 'Send Sponsor Request'} <ArrowRight size={18} />
                </button>
              </form>
            </div>

            <div id="spotlights" className="rounded-2xl border border-[#EF4444]/35 bg-neutral-950 p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#EF4444]">Player recognition</div>
                  <h3 className="mt-1 text-3xl font-black uppercase italic text-white">Player of the Month</h3>
                </div>
                <Star className="text-[#EF4444]" size={26} />
              </div>

              {loadingSpotlights ? (
                <div className="text-sm font-bold uppercase tracking-widest text-gray-500">Loading player recognition...</div>
              ) : playerSpotlights.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-800 bg-black p-8 text-center text-gray-500">
                  Player of the month will appear here soon.
                </div>
              ) : (
                <div className="grid gap-5">
                  {playerSpotlights.slice(0, 2).map((spotlight) => (
                    <article key={spotlight.id} className="overflow-hidden rounded-xl border border-gray-800 bg-black">
                      <div className="relative aspect-[16/11] bg-neutral-950">
                        {spotlight.image_url ? (
                          <img src={spotlight.image_url} alt={spotlight.title} className="h-full w-full object-cover object-center" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Star className="text-[#EF4444]" size={52} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.82),transparent_65%)]"></div>
                        <span className="absolute left-4 top-4 rounded-full bg-[#EF4444] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                          Player
                        </span>
                        <div className="absolute bottom-5 left-5 right-5">
                          {spotlight.subtitle && <p className="text-[10px] font-black uppercase tracking-widest text-[#EF4444]">{spotlight.subtitle}</p>}
                          <h4 className="mt-1 text-3xl font-black uppercase italic leading-tight text-white">{spotlight.title}</h4>
                        </div>
                      </div>
                      <div className="p-5">
                        <p className="text-sm leading-7 text-gray-400">{spotlight.body}</p>
                        {spotlight.link_url && (
                          <a href={spotlight.link_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#EF4444] hover:text-white">
                            Learn More <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CLUB APPROACH */}
      <section className="bg-black py-20 w-full">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <Dumbbell size={14} className="text-[#EF4444]" />
                Club approach
              </div>
              <h2 className="text-4xl font-black uppercase italic tracking-tight text-white md:text-5xl">
                Built around the full <span className="text-[#EF4444]">family experience</span>
              </h2>
              <p className="mt-5 text-base leading-8 text-gray-400">
                The homepage now keeps public information simple while the parent, coach, and admin dashboards handle the deeper team details.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['01', 'Communication', 'Parents can find updates, schedules, and next steps without digging.'],
                ['02', 'Development', 'Players get consistent training, drills, and coach feedback.'],
                ['03', 'Organization', 'Coaches and admins manage teams behind the scenes in dedicated dashboards.'],
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
                    'Player development with consistent coach support',
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
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Family support pricing</div>
                    <p className="mt-2 text-sm font-bold text-white">
                      Registration fee waived and monthly club fee reduced to $25/mo to keep soccer affordable for families.
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-bold text-gray-300">Registration fee</span>
                    <span className="text-2xl font-black text-white">$0</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-bold text-gray-300">Monthly club fee</span>
                    <span className="text-2xl font-black text-white">$25/mo</span>
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
                    Families who already paid $50 will receive a $25 credit toward their next monthly payment.
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

      {/* SCHEDULE */}
      <section id="schedule" className="py-24 bg-neutral-950 w-full">
        <div className="w-full px-6">
          <div className="text-center mb-16">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <CalendarDays size={14} className="text-[#EF4444]" />
              Live schedule
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Practices & <span className="text-[#EF4444]">Matches</span>
            </h2>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-gray-500">
              One place for families to check upcoming practice times, locations, and match days.
            </p>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>

          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-800 bg-black p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#EF4444]">Practice</div>
                  <h3 className="mt-1 text-2xl font-black uppercase italic text-white">Training Times</h3>
                </div>
                <Dumbbell className="text-[#EF4444]" size={24} />
              </div>
              {loadingEvents ? (
                <div className="text-sm text-gray-500">Loading practice schedule...</div>
              ) : events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">
                  No upcoming practices scheduled at the moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 4).map((event) => (
                    <article key={event.id} className="rounded-xl border border-gray-800 bg-neutral-950 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#EF4444]">
                            {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <h4 className="mt-1 text-base font-black uppercase text-white">{event.title}</h4>
                          {event.description && <p className="mt-2 text-sm leading-6 text-gray-500">{event.description}</p>}
                        </div>
                        <div className="shrink-0 text-sm text-gray-400 sm:text-right">
                          <p className="flex items-center gap-2 sm:justify-end">
                            <Clock size={14} className="text-[#EF4444]" />
                            {event.time
                              ? new Date(`1970-01-01T${event.time}`).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : 'TBA'}
                          </p>
                          <p className="mt-2 flex items-center gap-2 sm:justify-end">
                            <MapPin size={14} className="text-[#EF4444]" />
                            {event.location}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-800 bg-black p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Match day</div>
                  <h3 className="mt-1 text-2xl font-black uppercase italic text-white">Upcoming Games</h3>
                </div>
                <Trophy className="text-[#D4AF37]" size={24} />
              </div>
              {loadingGames ? (
                <div className="text-sm text-gray-500">Loading upcoming matches...</div>
              ) : games.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">
                  No upcoming matches scheduled at the moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {games.slice(0, 4).map((game) => (
                    <article key={game.id} className="rounded-xl border border-gray-800 bg-neutral-950 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                            {new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <h4 className="mt-1 text-base font-black uppercase text-white">vs. {game.opponent}</h4>
                        </div>
                        <div className="shrink-0 text-sm text-gray-400 sm:text-right">
                          <p className="flex items-center gap-2 sm:justify-end">
                            <Clock size={14} className="text-[#D4AF37]" />
                            {game.time
                              ? new Date(`1970-01-01T${game.time}`).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })
                              : 'TBA'}
                          </p>
                          <p className="mt-2 flex items-center gap-2 sm:justify-end">
                            <MapPin size={14} className="text-[#D4AF37]" />
                            {game.location}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
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
      
    </div>
  )
}
