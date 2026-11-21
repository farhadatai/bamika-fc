// Bamika FC Tournament Cup - game-day schedule (Sunday, Nov 22, 2026).
// One day, three age groups, round robin in each age group, then a final.
// Edit this file to change the schedule; the public page, the shareable
// /tournament/schedule link and the admin printout all read from it.

export type Division = 'U8' | 'U10' | 'U12'

export interface ScheduledGame {
  time: string            // 24h "HH:MM", local time at the venue
  field: 1 | 2 | 3
  division: Division
  home: string
  away: string
  referee?: string
  final?: boolean         // championship game: teams decided by round-robin results
}

export const SCHEDULE_DATE = '2026-11-22'

export const DIVISION_TEAMS: Record<Division, string[]> = {
  U8: ['Bamika A', 'Bamika B', 'Ittifaq'],
  U10: ['Bamika A', 'Bamika B', 'Ittifaq A', 'Ittifaq B'],
  U12: ['Bamika A', 'Bamika B', 'Ittifaq', 'JB Soccer Training'],
}

// Which club each team belongs to (for the team list).
export const TEAM_CLUB: Record<string, string> = {
  'Bamika A': 'Bamika FC',
  'Bamika B': 'Bamika FC',
  Ittifaq: 'Ittifaq',
  'Ittifaq A': 'Ittifaq',
  'Ittifaq B': 'Ittifaq',
  'JB Soccer Training': 'JB Soccer Training',
}

export const FIELD_GROUPS: Array<{ title: string, fields: Array<1 | 2 | 3> }> = [
  { title: 'Fields 1 & 2 — U8 & U10', fields: [1, 2] },
  { title: 'Field 3 — U12', fields: [3] },
]

export const FORMAT_NOTES = [
  '25-minute halves for U8 and U10, 30-minute halves for U12.',
  'Every team plays every other team in its age group, then the top two meet in the championship.',
  'Referees for all U10 and U12 games, plus the U8 final.',
  'Last game ends about 5:47 PM.',
]

const finalGame = (time: string, field: 1 | 2 | 3, division: Division, referee: string): ScheduledGame => ({
  time, field, division, home: 'Championship', away: 'Finalists TBD', referee, final: true,
})

export const GAMES: ScheduledGame[] = [
  // Field 1
  { time: '09:00', field: 1, division: 'U10', home: 'Bamika A', away: 'Bamika B', referee: 'Eesa' },
  { time: '10:56', field: 1, division: 'U10', home: 'Bamika A', away: 'Ittifaq A', referee: 'Mustafa' },
  { time: '12:52', field: 1, division: 'U10', home: 'Bamika A', away: 'Ittifaq B', referee: 'Eesa' },
  finalGame('14:48', 1, 'U10', 'Eesa'),
  finalGame('15:46', 1, 'U8', 'Shahab'),

  // Field 2
  { time: '09:00', field: 2, division: 'U10', home: 'Ittifaq A', away: 'Ittifaq B', referee: 'Shahab' },
  { time: '09:58', field: 2, division: 'U8', home: 'Bamika A', away: 'Bamika B' },
  { time: '10:56', field: 2, division: 'U10', home: 'Bamika B', away: 'Ittifaq B', referee: 'Shahab' },
  { time: '11:54', field: 2, division: 'U8', home: 'Bamika A', away: 'Ittifaq' },
  { time: '12:52', field: 2, division: 'U10', home: 'Bamika B', away: 'Ittifaq A', referee: 'Mustafa' },
  { time: '13:50', field: 2, division: 'U8', home: 'Bamika B', away: 'Ittifaq' },

  // Field 3
  { time: '09:00', field: 3, division: 'U12', home: 'Bamika A', away: 'Ittifaq', referee: 'Mustafa' },
  { time: '10:08', field: 3, division: 'U12', home: 'JB Soccer Training', away: 'Bamika B', referee: 'Eesa' },
  { time: '11:16', field: 3, division: 'U12', home: 'Bamika A', away: 'JB Soccer Training', referee: 'Eesa' },
  { time: '12:24', field: 3, division: 'U12', home: 'Ittifaq', away: 'Bamika B', referee: 'Shahab' },
  { time: '13:32', field: 3, division: 'U12', home: 'Bamika A', away: 'Bamika B', referee: 'Shahab' },
  { time: '14:40', field: 3, division: 'U12', home: 'Ittifaq', away: 'JB Soccer Training', referee: 'Mustafa' },
  finalGame('16:44', 3, 'U12', 'Mustafa'),
]

export const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export const formatScheduleDate = (date = SCHEDULE_DATE) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

// A team is identified by its age group and name ("U10 · Bamika A").
export const teamKey = (division: Division, name: string) => `${division}|${name}`

export const gamesForTeam = (division: Division, name: string) =>
  GAMES.filter((game) => game.division === division && (game.home === name || game.away === name))
    .sort((a, b) => a.time.localeCompare(b.time))
