import { useEffect, useState } from 'react'
import { ArrowRight, Camera, ShieldCheck, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Coach {
  name: string
  role: string
  bio: string
  image: string
}

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
]

const slideCopy = [
  ['Bamika FC moments', 'Our Players. Our Club.', 'Real Bamika FC players, coaches, and families are the heartbeat of the club.'],
  ['Match day energy', 'Compete Together.', 'Every match is a chance to show discipline, courage, teamwork, and the Bamika FC standard.'],
  ['Player development', 'Grow Every Session.', 'Players build confidence through repetition, coaching feedback, and training habits.'],
  ['Team culture', 'Play For The Badge.', 'Bamika FC is built on effort, respect, family support, and pride.'],
]

const slides = clubSlideshowPhotos.map((photo, index) => {
  const [label, title, description] = slideCopy[index % slideCopy.length]
  return { ...photo, label, title, description }
})

const coachesData: Coach[] = [
  {
    name: 'Farhad Atai',
    role: 'Coach',
    image: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/FarhadA.png',
    bio: 'Farhad brings extensive experience and a passion for player development, helping every athlete grow on and off the field.',
  },
  {
    name: 'Gharzay Ahmadzai',
    role: 'Coach',
    image: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Gharzay.png',
    bio: 'Gharzay specializes in tactical training and physical conditioning, building game intelligence and resilience.',
  },
  {
    name: 'Qais Atai',
    role: 'Coach',
    image: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Qais.png',
    bio: 'Qais focuses on technical ball mastery and creative play with an energetic, fundamentals-first style.',
  },
  {
    name: 'Atiqullah Hamidi',
    role: 'Coach',
    image: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Atiqullah.png',
    bio: 'Atiqullah develops discipline, tactical awareness, respect, and strong team habits.',
  },
  {
    name: 'Ahmadullah Azizi',
    role: 'Coach',
    image: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Ahmadullah.png',
    bio: 'Ahmadullah creates a supportive and challenging environment for skill development and personal growth.',
  },
  {
    name: 'Abobaker Sameer',
    role: 'Coach',
    image: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Abobaker.jpg',
    bio: 'Abobaker combines passion for soccer with agility, speed, and reaction training for the modern game.',
  },
  {
    name: 'Seema Sadat',
    role: 'Coach',
    image: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/coach-photos/ChatGPT%20Image%20Feb%2014,%202026,%2011_58_58%20AM.png',
    bio: 'Seema helps young athletes build confidence, technical skills, and belief in their own development.',
  },
]

const CoachCard = ({ coach }: { coach: Coach }) => (
  <article className="flex h-full flex-col items-center rounded-2xl border border-gray-800 bg-black p-5 text-center transition hover:border-[#EF4444] sm:p-6">
    <img src={coach.image} alt={coach.name} className="h-28 w-28 rounded-full border-4 border-gray-800 object-cover sm:h-32 sm:w-32" />
    <h3 className="mt-4 text-lg font-black uppercase italic text-white">{coach.name}</h3>
    <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#EF4444]">{coach.role}</div>
    <p className="mt-4 text-sm leading-6 text-gray-400">{coach.bio}</p>
  </article>
)

export default function ClubPage() {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % slides.length)
    }, 6000)

    return () => window.clearInterval(timer)
  }, [])

  const slide = slides[activeSlide]

  return (
    <div className="min-h-screen w-full bg-black text-white">
      <section className="border-b border-gray-900 bg-neutral-950 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <ShieldCheck size={14} className="text-[#D4AF37]" />
              Club information
            </div>
            <h1 className="mt-5 text-4xl font-black uppercase italic leading-tight sm:text-6xl">
              Bamika FC <span className="text-[#EF4444]">Culture</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-400 sm:text-lg">
              Meet the coaches, see club moments, and learn what families can expect from the Bamika FC player pathway.
            </p>
            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['U6-U16', 'Player pathway'],
                ['7', 'Coaches'],
                ['Family', 'Club culture'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="text-2xl font-black">{value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</div>
                </div>
              ))}
            </div>
            <Link to="/register" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-5 py-4 text-sm font-black uppercase text-white sm:w-auto">
              Register Player <ArrowRight size={18} />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-800 bg-black">
            <div className="relative aspect-[4/3] bg-black sm:aspect-video">
              {slides.map((item, index) => (
                <img
                  key={item.image}
                  src={item.image}
                  alt={item.label}
                  className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${item.fit === 'contain' ? 'object-contain' : 'object-cover'} ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
                  style={{ objectPosition: item.position }}
                />
              ))}
              <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.82),rgba(0,0,0,0.08)_55%,rgba(0,0,0,0.15))]" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="mb-2 inline-flex rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                  {slide.label}
                </div>
                <h2 className="text-2xl font-black uppercase italic sm:text-4xl">{slide.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">{slide.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-gray-800 p-4">
              <button onClick={() => setActiveSlide((current) => (current - 1 + slides.length) % slides.length)} className="h-11 w-11 rounded-full border border-gray-700 text-xl font-black hover:border-[#EF4444]">
                &lsaquo;
              </button>
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{String(activeSlide + 1).padStart(2, '0')} / {slides.length}</div>
              <button onClick={() => setActiveSlide((current) => (current + 1) % slides.length)} className="h-11 w-11 rounded-full border border-gray-700 text-xl font-black hover:border-[#EF4444]">
                &rsaquo;
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Users size={14} className="text-[#EF4444]" />
              Coaching staff
            </div>
            <h2 className="text-3xl font-black uppercase italic sm:text-5xl">Meet Our <span className="text-[#EF4444]">Coaches</span></h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {coachesData.map((coach) => <CoachCard key={coach.name} coach={coach} />)}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-900 bg-neutral-950 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <Camera size={14} className="text-[#D4AF37]" />
                Player photos
              </div>
              <h2 className="text-3xl font-black uppercase italic sm:text-5xl">Club <span className="text-[#EF4444]">Gallery</span></h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-gray-500">A quick look at Bamika FC practices, matches, and team moments.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {clubSlideshowPhotos.slice(0, 12).map((photo, index) => (
              <img
                key={photo.image}
                src={photo.image}
                alt={`Bamika FC player moment ${index + 1}`}
                className={`h-40 w-full rounded-xl border border-gray-800 bg-black ${photo.fit === 'contain' ? 'object-contain' : 'object-cover'} sm:h-52`}
                style={{ objectPosition: photo.position }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 text-center sm:px-6">
        <Trophy className="mx-auto text-[#D4AF37]" size={34} />
        <h2 className="mt-5 text-3xl font-black uppercase italic">Ready to Join?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-500">Create a parent account and start your player registration.</p>
        <Link to="/register" className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-6 py-4 text-sm font-black uppercase text-white">
          Register Player <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  )
}
