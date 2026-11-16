import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, ExternalLink, FileWarning, Link2, Loader2, Mail, Phone, RefreshCw, RotateCcw, Save, Trash2, Trophy, Users, X } from 'lucide-react'
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
  roster_deadline: string | null
}

interface RosterPlayer {
  id: string
  team_id: string
  full_name: string
  date_of_birth: string
  jersey_number: string | null
  has_birth_cert: boolean
  birth_cert_url: string | null
}

// Paid visiting teams and Bamika's own fee-waived teams both hold a spot.
const isEntered = (paymentStatus: string) => paymentStatus === 'paid' || paymentStatus === 'waived'

const ageOn = (dateOfBirth: string, onDate: string) => {
  const birth = new Date(`${dateOfBirth}T12:00:00`)
  const on = new Date(`${onDate}T12:00:00`)
  let age = on.getFullYear() - birth.getFullYear()
  if (on.getMonth() < birth.getMonth() || (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate())) age -= 1
  return age
}

interface TeamRow {
  id: string
  division: string
  team_name: string
  group_label: string | null
  payment_status: string
  paid_at: string | null
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
  access_token: string
  created_at: string
  tournament_club_teams: TeamRow[]
}

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

const statusStyles: Record<ClubRow['status'], string> = {
  pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  approved: 'border-green-500/30 bg-green-500/10 text-green-300',
  declined: 'border-red-500/30 bg-red-500/10 text-red-300',
}

const portalUrl = (token: string) => `${window.location.origin}/tournament/club/${token}`

export default function TournamentAdmin() {
  const [tournament, setTournament] = useState<TournamentRow | null>(null)
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filter, setFilter] = useState<'all' | ClubRow['status']>('all')
  const [busyKey, setBusyKey] = useState('')
  const [confirmKey, setConfirmKey] = useState('')
  const [notice, setNotice] = useState('')
  const [venueDraft, setVenueDraft] = useState({ venue_name: '', venue_address: '', starts_on: '', ends_on: '', roster_deadline: '' })
  const [savingVenue, setSavingVenue] = useState(false)
  // Roster size per team (total players, players with a certificate) for the chips.
  const [rosterCounts, setRosterCounts] = useState<Record<string, { total: number, certs: number }>>({})
  const [openRosterTeamId, setOpenRosterTeamId] = useState('')
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)

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
    setVenueDraft({
      venue_name: tournamentData?.venue_name || '',
      venue_address: tournamentData?.venue_address || '',
      starts_on: tournamentData?.starts_on || '',
      ends_on: tournamentData?.ends_on || '',
      roster_deadline: tournamentData?.roster_deadline || '',
    })

    const [{ data: clubData, error: clubError }, { data: rosterData }] = await Promise.all([
      supabase
        .from('tournament_clubs')
        .select('id, reference_code, club_name, contact_name, email, phone, city, notes, status, access_token, created_at, tournament_club_teams(id, division, team_name, group_label, payment_status, paid_at)')
        .order('created_at', { ascending: false }),
      // Roster table may not exist until its migration runs; counts just stay empty then.
      supabase.from('tournament_roster_players').select('team_id, birth_cert_path'),
    ])

    if (clubError) setLoadError(clubError.message)
    setClubs((clubData as ClubRow[]) || [])
    const counts: Record<string, { total: number, certs: number }> = {}
    for (const row of (rosterData || []) as Array<{ team_id: string, birth_cert_path: string | null }>) {
      const entry = counts[row.team_id] || { total: 0, certs: 0 }
      entry.total += 1
      if (row.birth_cert_path) entry.certs += 1
      counts[row.team_id] = entry
    }
    setRosterCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const summary = useMemo(() => {
    const counts = { pending: 0, approved: 0, declined: 0, teams: 0, paidTeams: 0 }
    for (const club of clubs) {
      counts[club.status] += 1
      if (club.status !== 'declined') {
        counts.teams += club.tournament_club_teams.length
        counts.paidTeams += club.tournament_club_teams.filter((team) => isEntered(team.payment_status)).length
      }
    }
    return counts
  }, [clubs])

  const teamsByDivision = useMemo(() => {
    const map: Record<string, { total: number, paid: number }> = {}
    for (const club of clubs) {
      if (club.status === 'declined') continue
      for (const team of club.tournament_club_teams) {
        const entry = map[team.division] || { total: 0, paid: 0 }
        entry.total += 1
        if (isEntered(team.payment_status)) entry.paid += 1
        map[team.division] = entry
      }
    }
    return map
  }, [clubs])

  const visibleClubs = filter === 'all' ? clubs : clubs.filter((club) => club.status === filter)

  const adminFetch = async (path: string, init?: RequestInit) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Request failed')
    return payload
  }

  const run = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key)
    setConfirmKey('')
    try {
      await action()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setBusyKey('')
    }
  }

  const setStatus = (club: ClubRow, status: ClubRow['status']) => run(`status-${club.id}`, async () => {
    await adminFetch(`/api/tournament/admin/clubs/${club.id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
    setClubs((current) => current.map((row) => (row.id === club.id ? { ...row, status } : row)))
    setNotice(status === 'approved' ? `${club.club_name} approved — payment link emailed to ${club.email}.` : `${club.club_name} marked ${status}.`)
  })

  const deleteClub = (club: ClubRow) => run(`delete-${club.id}`, async () => {
    await adminFetch(`/api/tournament/admin/clubs/${club.id}`, { method: 'DELETE' })
    setClubs((current) => current.filter((row) => row.id !== club.id))
    setNotice(`${club.club_name} deleted.`)
  })

  const removeTeam = (club: ClubRow, team: TeamRow) => run(`team-${team.id}`, async () => {
    await adminFetch(`/api/tournament/admin/teams/${team.id}`, { method: 'DELETE' })
    setClubs((current) => current.map((row) => (row.id === club.id
      ? { ...row, tournament_club_teams: row.tournament_club_teams.filter((item) => item.id !== team.id) }
      : row)))
    setNotice(`Removed ${team.team_name} (${team.division}).`)
  })

  const resendLink = (club: ClubRow) => run(`resend-${club.id}`, async () => {
    await adminFetch(`/api/tournament/admin/clubs/${club.id}/resend-link`, { method: 'POST' })
    setNotice(`Club link emailed to ${club.email}.`)
  })

  const syncPayments = (club: ClubRow) => run(`sync-${club.id}`, async () => {
    const payload = await adminFetch(`/api/tournament/admin/clubs/${club.id}/sync-payments`, { method: 'POST' })
    if (payload.updated > 0) await load()
    setNotice(payload.updated > 0 ? `${payload.updated} payment${payload.updated === 1 ? '' : 's'} confirmed from Stripe.` : 'No new payments found in Stripe.')
  })

  const toggleRoster = async (team: TeamRow) => {
    if (openRosterTeamId === team.id) {
      setOpenRosterTeamId('')
      setRosterPlayers([])
      return
    }
    setOpenRosterTeamId(team.id)
    setRosterPlayers([])
    setRosterLoading(true)
    try {
      const payload = await adminFetch(`/api/tournament/admin/teams/${team.id}/roster`)
      setRosterPlayers((payload.players || []) as RosterPlayer[])
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load the roster')
      setOpenRosterTeamId('')
    } finally {
      setRosterLoading(false)
    }
  }

  const copyLink = async (club: ClubRow) => {
    try {
      await navigator.clipboard.writeText(portalUrl(club.access_token))
      setNotice('Club link copied — paste it into a text or email.')
    } catch {
      window.prompt('Copy this club link:', portalUrl(club.access_token))
    }
  }

  const saveTournament = async (patch: Partial<TournamentRow>) => {
    if (!tournament) return
    setSavingVenue(true)
    const { error } = await supabase.from('tournaments').update(patch).eq('id', tournament.id)
    if (error) setNotice(error.message)
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

  const smallButton = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-60'

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-[#D4AF37]/50 bg-neutral-900 px-4 py-3 text-center text-sm font-bold text-white shadow-2xl">
          {notice}
        </div>
      )}

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

        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Pending', summary.pending, 'text-yellow-300'],
            ['Approved clubs', summary.approved, 'text-green-300'],
            ['Declined', summary.declined, 'text-red-300'],
            ['Teams entered', summary.teams, 'text-white'],
            ['Teams paid', `${summary.paidTeams} / ${summary.teams}`, 'text-green-300'],
            ['Collected', formatMoney(summary.paidTeams * tournament.team_fee_cents), 'text-[#D4AF37]'],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
              <p className={`mt-1 text-2xl font-black italic ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {tournament.divisions.map((division) => {
            const entry = teamsByDivision[division] || { total: 0, paid: 0 }
            return (
              <span key={division} className="rounded-full border border-gray-700 bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-300">
                {division}: <span className="text-white">{entry.total}</span> team{entry.total === 1 ? '' : 's'}{entry.total > 0 ? <span className="text-green-300"> · {entry.paid} paid</span> : null}
              </span>
            )
          })}
        </div>
      </div>

      {/* Venue */}
      <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Dates &amp; venue (shown on the public page and in emails)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">First day</span>
            <input type="date" className="w-full rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" value={venueDraft.starts_on} onChange={(e) => setVenueDraft({ ...venueDraft, starts_on: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Last day</span>
            <input type="date" className="w-full rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" value={venueDraft.ends_on} onChange={(e) => setVenueDraft({ ...venueDraft, ends_on: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Roster deadline (clubs can edit rosters through this day; leave empty for no lock)</span>
            <input type="date" className="w-full rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37] sm:w-64" value={venueDraft.roster_deadline} onChange={(e) => setVenueDraft({ ...venueDraft, roster_deadline: e.target.value })} />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" placeholder="Venue name (e.g. Luther Burbank High School)" value={venueDraft.venue_name} onChange={(e) => setVenueDraft({ ...venueDraft, venue_name: e.target.value })} />
          <input className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37]" placeholder="Street address, city, state" value={venueDraft.venue_address} onChange={(e) => setVenueDraft({ ...venueDraft, venue_address: e.target.value })} />
          <button
            disabled={savingVenue || !venueDraft.starts_on || !venueDraft.ends_on || venueDraft.ends_on < venueDraft.starts_on}
            onClick={() => saveTournament({
              starts_on: venueDraft.starts_on,
              ends_on: venueDraft.ends_on,
              venue_name: venueDraft.venue_name.trim() || null,
              venue_address: venueDraft.venue_address.trim() || null,
              roster_deadline: venueDraft.roster_deadline || null,
            }).then(() => setNotice('Dates and venue saved — the public page and emails now use them.'))}
            className={`${smallButton} bg-[#EF4444] text-white`}
          >
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
              const teams = club.tournament_club_teams
              const paidCount = teams.filter((team) => isEntered(team.payment_status)).length
              const busy = busyKey.endsWith(club.id)
              const hasPaid = paidCount > 0
              return (
                <div key={club.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                        {teams.map((team) => {
                          const paid = isEntered(team.payment_status)
                          const waived = team.payment_status === 'waived'
                          const confirming = confirmKey === `team-${team.id}`
                          const rosterCount = rosterCounts[team.id] || { total: 0, certs: 0 }
                          const rosterOpen = openRosterTeamId === team.id
                          return (
                            <span key={team.id} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold ${paid ? 'border-green-500/40 bg-green-500/10 text-green-200' : 'border-gray-700 bg-black text-gray-200'}`}>
                              <span><span className="text-[#D4AF37]">{team.division}</span> {team.team_name}{team.group_label ? ` · Group ${team.group_label}` : ''}{waived ? ' · Bamika (no fee)' : paid ? ' · paid' : ' · unpaid'}</span>
                              {paid && (
                                <button
                                  onClick={() => toggleRoster(team)}
                                  title="View this team's roster and birth certificates"
                                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${rosterOpen ? 'bg-[#D4AF37] text-black' : rosterCount.total >= tournament.roster_min ? 'border border-green-500/40 text-green-200 hover:bg-green-500/20' : 'border border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/20'}`}
                                >
                                  <Users size={11} /> Roster {rosterCount.total}/{tournament.roster_max}{rosterCount.total > rosterCount.certs ? ` · ${rosterCount.total - rosterCount.certs} no cert` : ''}
                                </button>
                              )}
                              {!paid && (
                                confirming ? (
                                  <span className="inline-flex items-center gap-1">
                                    <button onClick={() => removeTeam(club, team)} className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">Remove</button>
                                    <button onClick={() => setConfirmKey('')} className="rounded border border-gray-700 px-2 py-0.5 text-[10px] font-black uppercase text-gray-400">Keep</button>
                                  </span>
                                ) : (
                                  <button onClick={() => setConfirmKey(`team-${team.id}`)} className="text-gray-500 hover:text-red-400" aria-label={`Remove ${team.team_name}`} title="Remove this team"><X size={14} /></button>
                                )
                              )}
                            </span>
                          )
                        })}
                        {teams.length === 0 && <span className="text-xs text-gray-500">No teams left on this request.</span>}
                      </div>

                      {teams.some((team) => team.id === openRosterTeamId) && (() => {
                        const team = teams.find((row) => row.id === openRosterTeamId)!
                        const missing = rosterPlayers.filter((player) => !player.has_birth_cert).length
                        return (
                          <div className="mt-3 rounded-xl border border-[#D4AF37]/30 bg-black">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
                              <p className="text-xs font-black uppercase tracking-widest text-white">
                                <span className="text-[#D4AF37]">{team.division}</span> {team.team_name} roster · {rosterPlayers.length} player{rosterPlayers.length === 1 ? '' : 's'}
                                {rosterPlayers.length > 0 && rosterPlayers.length < tournament.roster_min ? <span className="text-yellow-300"> · below minimum of {tournament.roster_min}</span> : null}
                                {missing > 0 ? <span className="text-red-300"> · {missing} without certificate</span> : null}
                              </p>
                              <button onClick={() => toggleRoster(team)} className="text-gray-500 hover:text-white" aria-label="Close roster"><X size={14} /></button>
                            </div>
                            {rosterLoading ? (
                              <div className="p-4 text-gray-500"><Loader2 size={16} className="animate-spin" /></div>
                            ) : rosterPlayers.length === 0 ? (
                              <p className="p-4 text-xs text-gray-500">No players entered yet. The club adds them from their club link.</p>
                            ) : (
                              <ol className="divide-y divide-gray-900">
                                {rosterPlayers.map((player, index) => (
                                  <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                                    <span className="text-gray-200">
                                      <span className="mr-2 inline-block w-7 text-center font-black text-[#D4AF37]">{player.jersey_number || index + 1}</span>
                                      {player.full_name}
                                      <span className="ml-2 text-xs text-gray-500">{new Date(`${player.date_of_birth}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · age {ageOn(player.date_of_birth, tournament.starts_on)}</span>
                                    </span>
                                    {player.birth_cert_url ? (
                                      <a href={player.birth_cert_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-green-500/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-green-300 hover:bg-green-500/10"><ExternalLink size={11} /> Birth certificate</a>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded border border-red-500/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-300"><FileWarning size={11} /> No certificate</span>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )
                      })()}

                      {club.notes && <p className="mt-3 border-l-2 border-gray-700 pl-3 text-sm italic text-gray-400">{club.notes}</p>}
                      <p className="mt-3 text-xs text-gray-500">
                        Requested {new Date(club.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {' · '}{teams.length} team{teams.length === 1 ? '' : 's'}
                        {' · '}<span className={paidCount === teams.length && teams.length > 0 ? 'text-green-300' : ''}>{paidCount} paid</span>
                        {' · '}{formatMoney(paidCount * tournament.team_fee_cents)} collected of {formatMoney(teams.length * tournament.team_fee_cents)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col">
                      {club.status !== 'approved' && (
                        <button disabled={busy} onClick={() => setStatus(club, 'approved')} className={`${smallButton} bg-green-600 text-white hover:bg-green-500`}>
                          {busyKey === `status-${club.id}` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve &amp; send link
                        </button>
                      )}
                      {club.status === 'approved' && (
                        <>
                          <button disabled={busy} onClick={() => copyLink(club)} className={`${smallButton} border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10`}>
                            <Copy size={14} /> Copy club link
                          </button>
                          <button disabled={busy} onClick={() => resendLink(club)} className={`${smallButton} border border-gray-700 text-gray-300 hover:text-white`}>
                            {busyKey === `resend-${club.id}` ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Email link again
                          </button>
                          {paidCount < teams.length && (
                            <button disabled={busy} onClick={() => syncPayments(club)} className={`${smallButton} border border-gray-700 text-gray-300 hover:text-white`}>
                              {busyKey === `sync-${club.id}` ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh payments
                            </button>
                          )}
                        </>
                      )}
                      {club.status !== 'declined' && (
                        confirmKey === `decline-${club.id}` ? (
                          <div className="flex gap-2">
                            <button disabled={busy} onClick={() => setStatus(club, 'declined')} className={`${smallButton} flex-1 bg-red-600 text-white`}>Yes, decline</button>
                            <button onClick={() => setConfirmKey('')} className={`${smallButton} border border-gray-700 text-gray-400`}>Keep</button>
                          </div>
                        ) : (
                          <button disabled={busy} onClick={() => setConfirmKey(`decline-${club.id}`)} className={`${smallButton} border border-red-500/50 text-red-300 hover:bg-red-500/10`}>
                            <X size={14} /> Decline
                          </button>
                        )
                      )}
                      {club.status !== 'pending' && (
                        <button disabled={busy} onClick={() => setStatus(club, 'pending')} className={`${smallButton} border border-gray-700 text-gray-400 hover:text-white`}>
                          <RotateCcw size={14} /> Back to pending
                        </button>
                      )}
                      {confirmKey === `delete-${club.id}` ? (
                        <div className="flex gap-2">
                          <button disabled={busy || hasPaid} onClick={() => deleteClub(club)} className={`${smallButton} flex-1 bg-red-700 text-white`}>
                            {busyKey === `delete-${club.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Yes, delete
                          </button>
                          <button onClick={() => setConfirmKey('')} className={`${smallButton} border border-gray-700 text-gray-400`}>Keep</button>
                        </div>
                      ) : (
                        <button
                          disabled={busy || hasPaid}
                          title={hasPaid ? 'Refund the paid teams in Stripe before deleting' : 'Delete this club request and its teams'}
                          onClick={() => setConfirmKey(`delete-${club.id}`)}
                          className={`${smallButton} border border-gray-800 text-gray-500 hover:border-red-500/50 hover:text-red-400`}
                        >
                          <Trash2 size={14} /> Delete club
                        </button>
                      )}
                    </div>
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
