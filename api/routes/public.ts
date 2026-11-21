/**
 * Public, read-only data for the website (no login).
 *
 * GET /api/public/coaches - the coaching staff shown on the About page. It is
 * the same list as the admin "Coaching Staff" tab (the coaches table), so
 * onboarding a coach adds them to the website and deleting one removes them.
 * Only names, roles, teams, photos and bios are returned - never contact info.
 */
import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

// Photos and bios that were on the website before it was linked to onboarding.
// Used only when a current coach has not uploaded a photo or written a bio yet,
// so existing coaches keep their pictures. Coaches no longer on staff are not
// shown, whatever is in this list.
const LEGACY_COACH_MEDIA: Record<string, { photo: string, bio: string }> = {
  'farhad atai': {
    photo: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/FarhadA.png',
    bio: 'Farhad brings extensive experience and a passion for player development, helping every athlete grow on and off the field.',
  },
  'gharzay ahmadzai': {
    photo: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Gharzay.png',
    bio: 'Gharzay specializes in tactical training and physical conditioning, building game intelligence and resilience.',
  },
  'qais atai': {
    photo: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Qais.png',
    bio: 'Qais focuses on technical ball mastery and creative play with an energetic, fundamentals-first style.',
  },
  'atiqullah hamidi': {
    photo: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Atiqullah.png',
    bio: 'Atiqullah develops discipline, tactical awareness, respect, and strong team habits.',
  },
  'ahmadullah azizi': {
    photo: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Ahmadullah.png',
    bio: 'Ahmadullah creates a supportive and challenging environment for skill development and personal growth.',
  },
  'abobaker sameer': {
    photo: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/Coach_photos/Abobaker.jpg',
    bio: 'Abobaker combines passion for soccer with agility, speed, and reaction training for the modern game.',
  },
  'seema sadat': {
    photo: 'https://cuopewflwcbzwpiezqkf.supabase.co/storage/v1/object/public/coach-photos/ChatGPT%20Image%20Feb%2014,%202026,%2011_58_58%20AM.png',
    bio: 'Seema helps young athletes build confidence, technical skills, and belief in their own development.',
  },
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()

// Match "Farhad Atai" and also "Farhad M. Atai" (first + last word).
const legacyMediaFor = (name: string) => {
  const key = normalize(name)
  if (LEGACY_COACH_MEDIA[key]) return LEGACY_COACH_MEDIA[key]
  const words = key.split(' ')
  if (words.length >= 2) {
    const short = `${words[0]} ${words[words.length - 1]}`
    if (LEGACY_COACH_MEDIA[short]) return LEGACY_COACH_MEDIA[short]
  }
  return null
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

// Placeholder bio text the onboarding flows write automatically; not worth showing.
const GENERIC_BIOS = new Set(['', 'bamika fc coach and parent volunteer.'])

interface CoachRow {
  id: string
  full_name?: string | null
  name?: string | null
  specialty?: string | null
  role?: string | null
  bio?: string | null
  photo_url?: string | null
  team_id?: string | null
  is_published?: boolean | null
  profiles?: { first_name?: string | null, last_name?: string | null, photo_url?: string | null, role?: string | null } | null
}

router.get('/coaches', async (_req: Request, res: Response): Promise<void> => {
  try {
    // select('*') on purpose: the live coaches table has drifted from the migrations
    // (some columns exist only on newer rows), so read whatever is there.
    const { data, error } = await supabase
      .from('coaches')
      .select('*, profiles(first_name, last_name, photo_url, role)')
    if (error) throw new Error(error.message)

    const coaches = ((data || []) as CoachRow[])
      .filter((row) => row.is_published !== false)
      // A coach whose account was switched back to a parent is no longer staff.
      .filter((row) => !row.profiles?.role || row.profiles.role === 'coach' || row.profiles.role === 'admin')
      .map((row) => {
        const profileName = `${text(row.profiles?.first_name)} ${text(row.profiles?.last_name)}`.trim()
        const name = text(row.full_name) || text(row.name) || profileName
        const legacy = name ? legacyMediaFor(name) : null
        const ownBio = text(row.bio)
        const team = text(row.team_id)
        return {
          id: row.id,
          name,
          role: text(row.specialty) || text(row.role) || 'Coach',
          team: team && team !== 'Unassigned' ? team : null,
          // Coach's own upload first, then what the admin set, then the old website photo.
          photo_url: text(row.profiles?.photo_url) || text(row.photo_url) || legacy?.photo || null,
          bio: !GENERIC_BIOS.has(ownBio.toLowerCase()) ? ownBio : legacy?.bio || '',
        }
      })
      .filter((coach) => coach.name)
      .sort((a, b) => a.name.localeCompare(b.name))

    // Short CDN cache: a newly onboarded coach shows up within a minute or two.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    res.json({ coaches })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Could not load coaches' })
  }
})

export default router
