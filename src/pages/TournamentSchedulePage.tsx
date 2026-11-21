import { useEffect, useState } from 'react'
import TournamentSchedule from '../components/TournamentSchedule'

// bamikafc.com/tournament/schedule - just the schedule, easy to text to parents.
export default function TournamentSchedulePage() {
  const [venue, setVenue] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tournament/info')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const info = payload?.tournament
        if (info?.venue_name) setVenue(`${info.venue_name}${info.venue_address ? ` — ${info.venue_address}` : ''}`)
      })
      .catch(() => { /* schedule still shows without the venue */ })
  }, [])

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="mb-6 text-center text-[10px] font-black uppercase tracking-[0.35em] text-[#D4AF37]">Bamika FC Tournament Cup</p>
        <TournamentSchedule venue={venue} />
      </div>
    </div>
  )
}
