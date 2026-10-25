import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Mail, Phone, RotateCcw, Save, Trophy, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface TournamentRow {
  id: string
  name: string
  starts_on: string
  ends_on: string
  venue_name: string | null
  venue_address: string | null
  team_fee_cents: number
  divisions: string[]
  roster_min: number
  roster_max: number
  registration_open: boolean
}

interface TeamRow {
  id: string
  division: string
  team_name: string
  group_label: string | null
  payment_status: string
}

interface ClubRow {
  id: string
  reference_code: string
  club_name: string
  contact_name: string
  email: string
  phone: string
  city: string | null
  notes: string | null
  status: 'pending' | 'approved' | 'declined'
  created_at: string
  tournament_club_teams: TeamRow[]
}

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

const statusStyles: Record<ClubRow['status'], string> = {
  pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  approved: 'border-green-500/30 bg-green-500/10 text-green-300',
  declined: 'border-red-500/30 bg-red-500/10 text-red-300',
}

export default function TournamentAdmin() {
  const [tournament, setTournament] = useState<TournamentRow | null>(null)
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | ClubRow['status']>('all')
  const [busyClubId, setBusyClubId] = useState('')
  const [venueDraft, setVenueDraft] = useState({ venue_name: '', venue_address: '' })
  const [savingVenue, setSavingVenue] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('slug', 'bamika-cup-2026')
      .maybeSingle()

    if (tournamentError) {
      setLoadError(tournamentError.message.includes('schema cache') || tournamentError.message.includes('does not exist')
        ? 'Tournament tables are not set up yet. Run the tournament SQL migration in Supabase, then refresh.'
        : tournamentError.message)
      setLoading(false)
      return
    }

    setTournament(tournamentData)
    setVenueDraft({ venue_name: tournamentData?.venue_name || '', venue_address: tournamentData?.venue_address || '' })

    const { data: clubData, error: clubError } = await supabase
      .from('tournament_clubs')
      .select('id, reference_code, club_name, contact_name, email, phone, city, notes, status, created_at, tournament_club_teams(id, division, team_name, group_label, payment_status)')
      .order('created_at', { ascending: false })

    if (clubError) setLoadError(clubError.message)
    setClubs((clubData as ClubRow[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const summary = useMemo(() => {
    const counts = { pending: 0, approved: 0, declined: 0, teams: 0, paidTeams: 0 }
    for (const club of clubs) {
      counts[club.status] += 1
      if (club.status !== 'declined') {
        counts.teams += club.tournament_club_teams.length
        counts.paidTeams += club.tournament_club_teams.filter((team) => team.payment_status === 'paid').length
      }
    }
    return counts
  }, [clubs])

  const teamsByDivision = useMemo(() => {
    const map: Record<string, number> = {}
    for (const club of clubs) {
      if (club.status === 'declined') continue
      for (const team of club.tournament_club_teams) map[team.division] = (map[team.division] || 0) + 1
    }
    return map
  }, [clubs])

  const visibleClubs = filter === 'all' ? clubs : clubs.filter((club) => club.status === filter)

  const setStatus = async (club: ClubRow, status: ClubRow['status']) => {
    if (status === 'declined' && !window.confirm(`Decline ${club.club_name}? They will receive an email.`)) return
    setBusyClubId(club.id)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch(`/api/tournament/admin/clubs/${club.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not update club')
      setClubs((current) => current.map((row) => (row.id === club.id ? { ...row, status } : row)))
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not update club')
    } finally {
      setBusyClubId('')
    }
  }

  const saveTournament = async (patch: Partial<TournamentRow>) => {
    if (!tournament) return
    setSavingVenue(true)
    const { error } = await supabase.from('tournaments').update(patch).eq('id', tournament.id)
    if (error) alert(error.message)
    else setTournament({ ...tournament, ...patch })
    setSavingVenue(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center rounded-2xl border border-gray-800 bg-neutral-900 p-12 text-gray-500"><Loader2 className="animate-spin" /></div>
  }

  if (loadError || !tournament) {
    return (
      <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-sm font-bold text-yellow-200">
        {loadError || 'Tournament not found.'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header + summary */}
      <div className="rounded-2xl border border-gray-800 bg-neutral-900">
        <div className="flex flex-col gap-3 border-b border-gray-800 bg-neutral-950 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black uppercase italic text-white">{tournament.name}</h2>
            <p className="text-sm text-gray-500">
              {new Date(`${tournament.starts_on}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(`${tournament.ends_on}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}{formatMoney(tournament.team_fee_cents)} per team · Public page: <a href="/tournament" target="_blank" rel="noreferrer" className="text-[#D4AF37] underline">bamikafc.com/tournament</a>
            </p>
          </div>
          <button
            onClick={() => saveTournament({ registration_open: !tournament.registration_open })}
            className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${tournament.registration_open ? 'border-green-500/40 text-green-300' : 'border-red-500/40 text-red-300'}`}
          >
            Registration {tournament.registration_open ? 'open' : 'closed'} — tap to {tournament.registration_open ? 'close' : 'open'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
          {[
            ['Pending', summary.pending, 'text-yellow-300'],
            ['Approved clubs', summary.approved, 'text-green-300'],
            ['Declined', summary.declined, 'text-red-300'],
            ['Teams entered', summary.teams, 'text-white'],
            ['Expected fees', formatMoney(summary.teams * tournament.team_fee_cents), 'text-[#D4AF37]'],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
              <p className={`mt-1 text-2xl font-black italic ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {tournament.divisions.map((division) => (
            <span key={division} className="rounded-full border border-gray-700 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-300">
              {division}: <span className="text-white">{teamsByDivision[division] || 0}</span> team{(teamsByDivision[division] || 0) === 1 ? '' : 's'}
            </span>
          ))}
        </div>
      </div>

      {/* Venue */}
      <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Venue (shown on the public page)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" placeholder="Venue name (e.g. Cordova Sports Complex)" value={venueDraft.venue_name} onChange={(e) => setVenueDraft({ ...venueDraft, venue_name: e.target.value })} />
          <input className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" placeholder="Street address, city, state" value={venueDraft.venue_address} onChange={(e) => setVenueDraft({ ...venueDraft, venue_address: e.target.value })} />
          <button disabled={savingVenue} onClick={() => saveTournament({ venue_name: venueDraft.venue_name.trim() || null, venue_address: venueDraft.venue_address.trim() || null })} className="flex items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-60">
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      {/* Clubs */}
      <div className="rounded-2xl border border-gray-800 bg-neutral-900">
        <div className="flex flex-col gap-3 border-b border-gray-800 bg-neutral-950 p-5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-black uppercase italic text-white">Club requests</h3>
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'approved', 'declined'] as const).map((value) => (
              <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest ${filter === value ? 'bg-[#EF4444] text-white' : 'text-gray-500 hover:text-white'}`}>{value}</button>
            ))}
          </div>
        </div>

        {visibleClubs.length === 0 ? (
          <div className="p-10 text-center">
            <Trophy className="mx-auto mb-4 text-[#D4AF37]" size={38} />
            <h3 className="text-lg font-black uppercase italic text-white">No club requests {filter === 'all' ? 'yet' : `marked ${filter}`}</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">Clubs that register at bamikafc.com/tournament appear here. You also get an email for each new request.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {visibleClubs.map((club) => {
              const teamTotal = club.tournament_club_teams.length * tournament.team_fee_cents
              const busy = busyClubId === club.id
              return (
                <div key={club.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-black uppercase italic text-white">{club.club_name}</h4>
                      {club.city && <span className="text-xs text-gray-500">{club.city}</span>}
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyles[club.status]}`}>{club.status}</span>
                      <span className="rounded-full border border-gray-700 px-3 py-1 text-[10px] font-black tracking-widest text-gray-400">{club.reference_code}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-300">
                      <span className="font-bold text-white">{club.contact_name}</span>
                      {' · '}<a className="inline-flex items-center gap-1 text-[#D4AF37] hover:underline" href={`mailto:${club.email}`}><Mail size={12} />{club.email}</a>
                      {' · '}<a className="inline-flex items-center gap-1 text-[#D4AF37] hover:underline" href={`tel:${club.phone}`}><Phone size={12} />{club.phone}</a>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {club.tournament_club_teams.map((team) => (
                        <span key={team.id} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${team.payment_status === 'paid' ? 'border-green-500/40 bg-green-500/10 text-green-200' : 'border-gray-700 bg-black text-gray-200'}`}>
                          <span className="text-[#D4AF37]">{team.division}</span> {team.team_name}{team.group_label ? ` · Group ${team.group_label}` : ''}{team.payment_status === 'paid' ? ' · paid' : ''}
                        </span>
                      ))}
                    </div>
                    {club.notes && <p className="mt-3 border-l-2 border-gray-700 pl-3 text-sm italic text-gray-400">{club.notes}</p>}
                    <p className="mt-3 text-xs text-gray-500">
                      Requested {new Date(club.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {club.tournament_club_teams.length} team{club.tournament_club_teams.length === 1 ? '' : 's'} · {formatMoney(teamTotal)} expected
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:flex-col">
                    {club.status !== 'approved' && (
                      <button disabled={busy} onClick={() => setStatus(club, 'approved')} className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-green-500 disabled:opacity-60">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                      </button>
                    )}
                    {club.status !== 'declined' && (
                      <button disabled={busy} onClick={() => setStatus(club, 'declined')} className="flex items-center justify-center gap-2 rounded-xl border border-red-500/50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/10 disabled:opacity-60">
                        <X size={14} /> Decline
                      </button>
                    )}
                    {club.status !== 'pending' && (
                      <button disabled={busy} onClick={() => setStatus(club, 'pending')} className="flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white disabled:opacity-60">
                        <RotateCcw size={14} /> Back to pending
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
