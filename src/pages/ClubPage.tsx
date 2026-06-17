import { useEffect, useState } from 'react'
import { Camera, ShieldCheck, Trophy, Users } from 'lucide-react'

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

  return (
    <div className="min-h-screen w-full bg-black text-white">
      <section className="relative min-h-[34rem] overflow-hidden border-b border-gray-900">
        {slides.map((item, index) => (
          <img
            key={item.image}
            src={item.image}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${item.fit === 'contain' ? 'object-cover' : 'object-cover'} ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
            style={{ objectPosition: item.position }}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.82)_45%,rgba(0,0,0,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.9)_0%,transparent_38%)]" />
        <div className="relative z-10 mx-auto flex min-h-[34rem] max-w-7xl items-end px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-200 backdrop-blur">
              <ShieldCheck size={14} className="text-[#D4AF37]" />
              About us
            </div>
            <h1 className="mt-5 text-5xl font-black uppercase italic leading-[0.95] sm:text-7xl">
              About <span className="text-[#EF4444]">Bamika FC</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-200">
              A community youth soccer club built to help players grow as athletes, leaders, teammates, and confident young people.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {['Community', 'Development', 'Respect', 'Leadership'].map((value) => (
                <span key={value} className="rounded-full border border-white/15 bg-black/55 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 backdrop-blur">
                  {value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-900 bg-black px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-4xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <ShieldCheck size={14} className="text-[#D4AF37]" />
              Our story
            </div>
            <h2 className="text-4xl font-black uppercase italic leading-tight sm:text-6xl">
              Positive. Structured. <span className="text-[#EF4444]">Community Driven.</span>
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-2xl border border-gray-800 bg-neutral-950 p-5 sm:p-8">
              <p className="text-lg leading-8 text-gray-300">
                Bamika FC was founded in 2022 with a vision of creating a positive, structured, and supportive environment for youth through soccer. What began as a small community-based program quickly grew into a passionate and diverse club serving families throughout the Sacramento and Elk Grove area.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <p className="rounded-xl border border-gray-800 bg-black p-5 text-sm leading-7 text-gray-400">
                  Bamika FC was created to give young players an opportunity to develop not only as athletes, but also as confident, respectful, and disciplined individuals.
                </p>
                <p className="rounded-xl border border-gray-800 bg-black p-5 text-sm leading-7 text-gray-400">
                  Our club welcomes players from all backgrounds and focuses on teamwork, leadership, personal growth, and strong community connection.
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-gray-800 bg-neutral-950">
              <img
                src="/slideshow/web/bamika-slide-13.jpg"
                alt="Bamika FC players and coaches"
                className="h-64 w-full object-cover sm:h-80"
              />
              <div className="p-5 sm:p-6">
                <h3 className="text-2xl font-black uppercase italic text-white">Built by community</h3>
                <p className="mt-3 text-sm leading-7 text-gray-400">
                  Since its founding, Bamika FC has organized successful tournaments and community events with clubs from across Northern California. Our coaches are dedicated volunteers who help guide and mentor the next generation.
                </p>
              </div>
            </article>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5 sm:p-7">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                <Trophy size={14} />
                US Club Soccer
              </div>
              <p className="text-base leading-8 text-gray-200">
                Today, Bamika FC is proudly affiliated with US Club Soccer, providing players with access to official player registration, sanctioned tournaments, coaching education pathways, and a more professional development environment under the U.S. Soccer system.
              </p>
            </article>

            <article className="rounded-2xl border border-gray-800 bg-neutral-950 p-5 sm:p-7">
              <h3 className="text-2xl font-black uppercase italic text-white sm:text-3xl">
                Our Goal
              </h3>
              <p className="mt-4 text-base leading-8 text-gray-400">
                Our goal is to create a strong pathway for youth players to grow both on and off the field. We aim to provide affordable, high-quality soccer development while building a safe, family-oriented, and community-driven club culture.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  'Structured training and competition',
                  'Licensed coaching education pathways',
                  'Opportunities for youth throughout the community',
                  'Discipline, teamwork, respect, and leadership',
                  'A long-term foundation for competitive youth soccer',
                ].map((goal) => (
                  <div key={goal} className="flex gap-3 rounded-xl border border-gray-800 bg-black p-4">
                    <ShieldCheck className="mt-0.5 shrink-0 text-[#D4AF37]" size={18} />
                    <p className="text-sm font-bold leading-6 text-gray-300">{goal}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <p className="mt-6 rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-5 text-center text-base font-bold leading-8 text-gray-100">
            At Bamika FC, soccer is more than just a game. It is a way to inspire youth, unite families, and build a stronger community together.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
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

      <section className="border-t border-gray-900 bg-neutral-950 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
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

    </div>
  )
}
