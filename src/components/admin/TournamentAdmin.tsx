import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Check, ChevronDown, ChevronRight, Copy, DollarSign, ExternalLink, FileWarning, Link2, Loader2, Mail, Phone,
  Plus, Printer, RefreshCw, RotateCcw, Save, Search, Trash2, Trophy, Upload, Users, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { TEAM_OPTIONS } from '../../lib/utils'
import TournamentSchedule from '../TournamentSchedule'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  birth_cert_path: string | null
  source_player_id: string | null
  created_at: string
}

interface TeamRow {
  id: string
  division: string
  team_name: string
  group_label: string | null
  payment_status: string
  paid_at: string | null
  coach_team: string | null
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
  is_home: boolean
  tournament_club_teams: TeamRow[]
}

interface ClubPlayer {
  id: string
  full_name: string
  date_of_birth: string | null
  jersey_number: string | null
  team_assigned: string | null
  status: string | null
}

// A team together with the club it belongs to - the unit everything on game day is about.
interface Entry {
  team: TeamRow
  club: ClubRow
}

type View = 'teams' | 'schedule' | 'clubs' | 'bamika' | 'settings'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Paid visiting teams and Bamika's own fee-waived teams both hold a spot.
const isEntered = (paymentStatus: string) => paymentStatus === 'paid' || paymentStatus === 'waived'

const ageOn = (dateOfBirth: string, onDate: string) => {
  const birth = new Date(`${dateOfBirth}T12:00:00`)
  const on = new Date(`${onDate}T12:00:00`)
  let age = on.getFullYear() - birth.getFullYear()
  if (on.getMonth() < birth.getMonth() || (on.getMonth() === birth.getMonth() && on.getDate() < birth.getDate())) age -= 1
  return age
}

const formatDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
const portalUrl = (token: string) => `${window.location.origin}/tournament/club/${token}`
const divisionOrder = (division: string) => Number(division.replace(/\D/g, '')) || 99
const isActivePlayer = (status: string | null) => !['inactive', 'cancelled', 'canceled', 'deleted'].includes(String(status || '').toLowerCase())

const readFileAsBase64 = (file: File) => new Promise<{ name: string, type: string, data: string }>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', data: String(reader.result).split(',')[1] || '' })
  reader.onerror = () => reject(new Error('Could not read the file'))
  reader.readAsDataURL(file)
})

const statusStyles: Record<ClubRow['status'], string> = {
  pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  approved: 'border-green-500/30 bg-green-500/10 text-green-300',
  declined: 'border-red-500/30 bg-red-500/10 text-red-300',
}

const smallButton = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition disabled:opacity-50'
const inputClass = 'w-full rounded-xl border border-gray-800 bg-black px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-[#D4AF37]'

const PaymentBadge = ({ status }: { status: string }) => {
  if (status === 'waived') return <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">Bamika</span>
  if (status === 'paid') return <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-green-300">Paid</span>
  if (status === 'refunded') return <span className="rounded-full border border-gray-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Refunded</span>
  return <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-300">Unpaid</span>
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TournamentAdmin() {
  const [tournament, setTournament] = useState<TournamentRow | null>(null)
  const [clubs, setClubs] = useState<ClubRow[]>([])
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [clubPlayers, setClubPlayers] = useState<ClubPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState<View>('teams')
  const [notice, setNotice] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [confirmKey, setConfirmKey] = useState('')

  // Teams view filters
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'entered' | 'unpaid'>('all')
  const [search, setSearch] = useState('')
  const [openTeamId, setOpenTeamId] = useState('')
  const [certLinks, setCertLinks] = useState<Record<string, string>>({})

  // Clubs view filter
  const [clubFilter, setClubFilter] = useState<'all' | ClubRow['status']>('all')

  // Printing: the sheets are rendered into a body-level portal only while printing.
  const [printTeamIds, setPrintTeamIds] = useState<string[] | null>(null)

  const [venueDraft, setVenueDraft] = useState({ venue_name: '', venue_address: '', starts_on: '', ends_on: '', roster_deadline: '' })

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
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

    const [{ data: clubData, error: clubError }, { data: rosterData }, { data: playerData }] = await Promise.all([
      supabase
        .from('tournament_clubs')
        .select('id, reference_code, club_name, contact_name, email, phone, city, notes, status, access_token, created_at, is_home, tournament_club_teams(id, division, team_name, group_label, payment_status, paid_at, coach_team)')
        .order('created_at', { ascending: false }),
      supabase
        .from('tournament_roster_players')
        .select('id, team_id, full_name, date_of_birth, jersey_number, birth_cert_path, source_player_id, created_at')
        .order('created_at', { ascending: true }),
      supabase
        .from('players')
        .select('id, full_name, date_of_birth, jersey_number, team_assigned, status')
        .order('full_name', { ascending: true }),
    ])

    if (clubError) setLoadError(clubError.message)
    setClubs((clubData as ClubRow[]) || [])
    setRoster((rosterData as RosterPlayer[]) || [])
    setClubPlayers(((playerData as ClubPlayer[]) || []).filter((player) => isActivePlayer(player.status)))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Print once the sheets have rendered, then tidy up.
  useEffect(() => {
    if (!printTeamIds) return
    document.body.classList.add('print-isolate')
    const timer = window.setTimeout(() => {
      window.print()
      document.body.classList.remove('print-isolate')
      setPrintTeamIds(null)
    }, 150)
    return () => {
      window.clearTimeout(timer)
      document.body.classList.remove('print-isolate')
    }
  }, [printTeamIds])

  // ---- derived data -------------------------------------------------------

  const homeClub = useMemo(() => clubs.find((club) => club.is_home) || null, [clubs])

  const rosterByTeam = useMemo(() => {
    const map: Record<string, RosterPlayer[]> = {}
    for (const player of roster) (map[player.team_id] ||= []).push(player)
    return map
  }, [roster])

  // Every team from every club that is still in play (declined clubs drop out).
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = []
    for (const club of clubs) {
      if (club.status === 'declined') continue
      for (const team of club.tournament_club_teams) list.push({ team, club })
    }
    return list.sort((a, b) =>
      divisionOrder(a.team.division) - divisionOrder(b.team.division)
      || Number(b.club.is_home) - Number(a.club.is_home)
      || a.club.club_name.localeCompare(b.club.club_name)
      || a.team.team_name.localeCompare(b.team.team_name))
  }, [clubs])

  const summary = useMemo(() => {
    const visiting = entries.filter((entry) => !entry.club.is_home)
    const paid = visiting.filter((entry) => entry.team.payment_status === 'paid').length
    return {
      pendingClubs: clubs.filter((club) => club.status === 'pending' && !club.is_home).length,
      totalTeams: entries.length,
      entered: entries.filter((entry) => isEntered(entry.team.payment_status)).length,
      unpaid: visiting.filter((entry) => !isEntered(entry.team.payment_status)).length,
      bamika: entries.filter((entry) => entry.club.is_home).length,
      collected: paid * (tournament?.team_fee_cents || 0),
      players: entries.reduce((total, entry) => total + (rosterByTeam[entry.team.id]?.length || 0), 0),
    }
  }, [entries, clubs, rosterByTeam, tournament])

  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase()
    return entries.filter((entry) => {
      if (divisionFilter !== 'all' && entry.team.division !== divisionFilter) return false
      if (paymentFilter === 'entered' && !isEntered(entry.team.payment_status)) return false
      if (paymentFilter === 'unpaid' && isEntered(entry.team.payment_status)) return false
      if (term) {
        const haystack = `${entry.team.team_name} ${entry.club.club_name} ${entry.team.division} ${(rosterByTeam[entry.team.id] || []).map((p) => p.full_name).join(' ')}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [entries, divisionFilter, paymentFilter, search, rosterByTeam])

  // ---- API ------------------------------------------------------------------

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

  const patchTeam = (teamId: string, patch: Partial<TeamRow>) => setClubs((current) => current.map((club) => ({
    ...club,
    tournament_club_teams: club.tournament_club_teams.map((team) => (team.id === teamId ? { ...team, ...patch } : team)),
  })))

  const setPayment = (entry: Entry, status: 'paid' | 'unpaid') => run(`pay-${entry.team.id}`, async () => {
    await adminFetch(`/api/tournament/admin/teams/${entry.team.id}/payment`, { method: 'POST', body: JSON.stringify({ status }) })
    patchTeam(entry.team.id, { payment_status: status, paid_at: status === 'paid' ? new Date().toISOString() : null })
    setNotice(status === 'paid'
      ? `${entry.team.team_name} marked paid — ${entry.club.club_name} can now enter their roster.`
      : `${entry.team.team_name} marked unpaid.`)
  })

  const removeTeam = (entry: Entry) => run(`team-${entry.team.id}`, async () => {
    const force = entry.team.payment_status === 'paid' ? '?force=1' : ''
    await adminFetch(`/api/tournament/admin/teams/${entry.team.id}${force}`, { method: 'DELETE' })
    setClubs((current) => current.map((club) => ({ ...club, tournament_club_teams: club.tournament_club_teams.filter((team) => team.id !== entry.team.id) })))
    setRoster((current) => current.filter((player) => player.team_id !== entry.team.id))
    setNotice(`Removed ${entry.team.team_name} (${entry.team.division}).`)
  })

  const setClubStatus = (club: ClubRow, status: ClubRow['status']) => run(`status-${club.id}`, async () => {
    await adminFetch(`/api/tournament/admin/clubs/${club.id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
    setClubs((current) => current.map((row) => (row.id === club.id ? { ...row, status } : row)))
    setNotice(status === 'approved' ? `${club.club_name} approved — club link emailed to ${club.email}.` : `${club.club_name} marked ${status}.`)
  })

  const deleteClub = (club: ClubRow) => run(`delete-${club.id}`, async () => {
    const hasPaid = club.tournament_club_teams.some((team) => team.payment_status === 'paid')
    await adminFetch(`/api/tournament/admin/clubs/${club.id}${hasPaid ? '?force=1' : ''}`, { method: 'DELETE' })
    const teamIds = new Set(club.tournament_club_teams.map((team) => team.id))
    setClubs((current) => current.filter((row) => row.id !== club.id))
    setRoster((current) => current.filter((player) => !teamIds.has(player.team_id)))
    setNotice(`${club.club_name} deleted.`)
  })

  const resendLink = (club: ClubRow) => run(`resend-${club.id}`, async () => {
    await adminFetch(`/api/tournament/admin/clubs/${club.id}/resend-link`, { method: 'POST' })
    setNotice(`Club link emailed to ${club.email}.`)
  })

  const syncPayments = (club: ClubRow) => run(`sync-${club.id}`, async () => {
    const payload = await adminFetch(`/api/tournament/admin/clubs/${club.id}/sync-payments`, { method: 'POST' })
    if (payload.updated > 0) await load(true)
    setNotice(payload.updated > 0 ? `${payload.updated} payment${payload.updated === 1 ? '' : 's'} confirmed from Stripe.` : 'No new Stripe payments found. If they paid you directly, use "Mark paid".')
  })

  const copyLink = async (club: ClubRow) => {
    try {
      await navigator.clipboard.writeText(portalUrl(club.access_token))
      setNotice('Club link copied — paste it into a text or email.')
    } catch {
      window.prompt('Copy this club link:', portalUrl(club.access_token))
    }
  }

  const addPlayer = (teamId: string, body: Record<string, unknown>, label: string) => run(`add-${teamId}`, async () => {
    const payload = await adminFetch(`/api/tournament/admin/teams/${teamId}/players`, { method: 'POST', body: JSON.stringify(body) })
    const created = payload.player as { id: string, team_id: string, full_name: string, date_of_birth: string, jersey_number: string | null, has_birth_cert: boolean, created_at: string }
    setRoster((current) => [...current, {
      id: created.id,
      team_id: created.team_id,
      full_name: created.full_name,
      date_of_birth: created.date_of_birth,
      jersey_number: created.jersey_number,
      birth_cert_path: created.has_birth_cert ? 'uploaded' : null,
      source_player_id: (body.sourcePlayerId as string) || null,
      created_at: created.created_at,
    }])
    setNotice(`${label} added.`)
  })

  const removePlayer = (player: RosterPlayer) => run(`player-${player.id}`, async () => {
    await adminFetch(`/api/tournament/admin/players/${player.id}`, { method: 'DELETE' })
    setRoster((current) => current.filter((row) => row.id !== player.id))
    setNotice(`${player.full_name} removed from the roster.`)
  })

  const uploadCert = (player: RosterPlayer, file: File) => run(`cert-${player.id}`, async () => {
    const birthCert = await readFileAsBase64(file)
    await adminFetch(`/api/tournament/admin/players/${player.id}/birth-certificate`, { method: 'POST', body: JSON.stringify({ birthCert }) })
    setRoster((current) => current.map((row) => (row.id === player.id ? { ...row, birth_cert_path: 'uploaded' } : row)))
    setNotice(`Birth certificate saved for ${player.full_name}.`)
  })

  const loadCertLinks = async (teamId: string) => {
    try {
      const payload = await adminFetch(`/api/tournament/admin/teams/${teamId}/roster`)
      const links: Record<string, string> = {}
      for (const player of (payload.players || []) as Array<{ id: string, birth_cert_url: string | null }>) {
        if (player.birth_cert_url) links[player.id] = player.birth_cert_url
      }
      setCertLinks((current) => ({ ...current, ...links }))
    } catch {
      // Links are a convenience; the roster itself is already loaded.
    }
  }

  const toggleTeam = (teamId: string) => {
    if (openTeamId === teamId) {
      setOpenTeamId('')
      return
    }
    setOpenTeamId(teamId)
    void loadCertLinks(teamId)
  }

  const enterHomeTeam = (division: string, teamName: string, coachTeam: string) => run(`home-${coachTeam || division}`, async () => {
    await adminFetch('/api/tournament/admin/home-teams', { method: 'POST', body: JSON.stringify({ division, teamName, coachTeam }) })
    await load(true)
    setNotice(`${teamName} entered in ${division}. Open it to pick the players.`)
  })

  const saveTournament = async (patch: Partial<TournamentRow>, message: string) => {
    if (!tournament) return
    const { error } = await supabase.from('tournaments').update(patch).eq('id', tournament.id)
    if (error) setNotice(error.message)
    else {
      setTournament({ ...tournament, ...patch })
      setNotice(message)
    }
  }

  // ---- render ---------------------------------------------------------------

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

  const rostersLocked = Boolean(tournament.roster_deadline) && Date.now() > new Date(`${tournament.roster_deadline}T23:59:59-08:00`).getTime()

  const renderTeamRow = (entry: Entry) => {
    const { team, club } = entry
    const players = rosterByTeam[team.id] || []
    const missingCerts = players.filter((player) => !player.birth_cert_path).length
    const open = openTeamId === team.id
    const busy = busyKey.endsWith(team.id)
    const confirmingRemove = confirmKey === `remove-${team.id}`
    const confirmingUnpaid = confirmKey === `unpaid-${team.id}`
    const short = players.length < tournament.roster_min

    return (
      <div key={team.id} className={`rounded-xl border ${open ? 'border-[#D4AF37]/50' : 'border-gray-800'} bg-black`}>
        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <button onClick={() => toggleTeam(team.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            {open ? <ChevronDown size={18} className="shrink-0 text-[#D4AF37]" /> : <ChevronRight size={18} className="shrink-0 text-gray-500" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase text-white">
                {team.team_name}
                {team.group_label ? <span className="ml-2 text-[10px] text-gray-500">Group {team.group_label}</span> : null}
              </p>
              <p className="truncate text-xs text-gray-500">
                {club.is_home ? <span className="text-[#D4AF37]">Bamika FC{team.coach_team ? ` · ${team.coach_team}` : ''}</span> : club.club_name}
                {!club.is_home && club.status === 'pending' ? <span className="text-yellow-300"> · club not approved yet</span> : null}
              </p>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <PaymentBadge status={team.payment_status} />
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ${players.length === 0 ? 'border-gray-700 text-gray-500' : short ? 'border-yellow-500/40 text-yellow-300' : 'border-green-500/40 text-green-300'}`}>
              <Users size={11} /> {players.length}/{tournament.roster_max}
            </span>
            {missingCerts > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-300">
                <FileWarning size={11} /> {missingCerts} no cert
              </span>
            )}

            {team.payment_status !== 'waived' && team.payment_status !== 'paid' && (
              <button disabled={busy} onClick={() => setPayment(entry, 'paid')} className={`${smallButton} bg-green-600 text-white hover:bg-green-500`}>
                {busyKey === `pay-${team.id}` ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={12} />} Mark paid
              </button>
            )}
            {team.payment_status === 'paid' && (confirmingUnpaid ? (
              <span className="inline-flex gap-1">
                <button disabled={busy} onClick={() => setPayment(entry, 'unpaid')} className={`${smallButton} bg-red-700 text-white`}>Mark unpaid</button>
                <button onClick={() => setConfirmKey('')} className={`${smallButton} border border-gray-700 text-gray-400`}>Keep</button>
              </span>
            ) : (
              <button onClick={() => setConfirmKey(`unpaid-${team.id}`)} className="text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:text-gray-300" title="Undo a payment marked by mistake">Undo paid</button>
            ))}
            <button disabled={players.length === 0} onClick={() => setPrintTeamIds([team.id])} className={`${smallButton} border border-gray-700 text-gray-300 hover:text-white`} title="Print this roster">
              <Printer size={12} /> Print
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-gray-800 p-3">
            {players.length === 0 ? (
              <p className="px-1 py-2 text-xs text-gray-500">No players on this roster yet.{!club.is_home && !isEntered(team.payment_status) ? ' Mark the team paid so the club can enter players, or add them below.' : ''}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Player</th>
                      <th className="px-2 py-2">Birth date</th>
                      <th className="px-2 py-2">Age</th>
                      <th className="px-2 py-2">Certificate</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900">
                    {players.map((player, index) => (
                      <tr key={player.id}>
                        <td className="px-2 py-2 font-black text-[#D4AF37]">{player.jersey_number || index + 1}</td>
                        <td className="px-2 py-2 font-bold text-white">{player.full_name}</td>
                        <td className="px-2 py-2 text-gray-400">{formatDate(player.date_of_birth)}</td>
                        <td className="px-2 py-2 text-gray-400">{ageOn(player.date_of_birth, tournament.starts_on)}</td>
                        <td className="px-2 py-2">
                          {player.birth_cert_path ? (
                            certLinks[player.id] ? (
                              <a href={certLinks[player.id]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-green-300 hover:underline"><ExternalLink size={11} /> View</a>
                            ) : <span className="text-[10px] font-black uppercase tracking-widest text-green-300">On file</span>
                          ) : (
                            <label className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-300 hover:text-red-200">
                              {busyKey === `cert-${player.id}` ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Missing — upload
                              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCert(player, file); event.target.value = '' }} />
                            </label>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {confirmKey === `player-${player.id}` ? (
                            <span className="inline-flex gap-1">
                              <button onClick={() => removePlayer(player)} className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">Remove</button>
                              <button onClick={() => setConfirmKey('')} className="rounded border border-gray-700 px-2 py-0.5 text-[10px] font-black uppercase text-gray-400">Keep</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmKey(`player-${player.id}`)} className="text-gray-600 hover:text-red-400" aria-label={`Remove ${player.full_name}`}><X size={14} /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {players.length < tournament.roster_max && (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <AddPlayerForm busy={busyKey === `add-${team.id}`} onAdd={(body, label) => addPlayer(team.id, body, label)} />
                {club.is_home && (
                  <BamikaPlayerPicker
                    players={clubPlayers}
                    defaultTeam={team.coach_team || ''}
                    takenIds={new Set(players.map((player) => player.source_player_id).filter((id): id is string => Boolean(id)))}
                    busy={busyKey === `add-${team.id}`}
                    onPick={(player) => addPlayer(team.id, { sourcePlayerId: player.id }, player.full_name)}
                  />
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-gray-900 pt-3">
              {confirmingRemove ? (
                <>
                  <span className="text-xs text-red-300">
                    Remove {team.team_name} and its {players.length} player{players.length === 1 ? '' : 's'}?{team.payment_status === 'paid' ? ' It is paid — refund in Stripe separately if needed.' : ''}
                  </span>
                  <button onClick={() => removeTeam(entry)} className={`${smallButton} bg-red-700 text-white`}>Yes, remove team</button>
                  <button onClick={() => setConfirmKey('')} className={`${smallButton} border border-gray-700 text-gray-400`}>Keep</button>
                </>
              ) : (
                <button onClick={() => setConfirmKey(`remove-${team.id}`)} className={`${smallButton} border border-gray-800 text-gray-500 hover:border-red-500/50 hover:text-red-400`}>
                  <Trash2 size={12} /> Remove team
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const visibleDivisions = [...new Set(visibleEntries.map((entry) => entry.team.division))].sort((a, b) => divisionOrder(a) - divisionOrder(b))
  const printableVisible = visibleEntries.filter((entry) => (rosterByTeam[entry.team.id] || []).length > 0)

  // Visiting clubs, most urgent first: pending, then approved, then declined.
  const statusRank: Record<ClubRow['status'], number> = { pending: 0, approved: 1, declined: 2 }
  const visitingClubs = clubs
    .filter((club) => !club.is_home)
    .filter((club) => clubFilter === 'all' || club.status === clubFilter)
    .sort((a, b) => statusRank[a.status] - statusRank[b.status] || a.club_name.localeCompare(b.club_name))

  const homeEntries = entries.filter((entry) => entry.club.is_home)
  const bamikaTeamLabels = TEAM_OPTIONS.filter((label) => /^U\d+/.test(label))

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-[#D4AF37]/50 bg-neutral-900 px-4 py-3 text-center text-sm font-bold text-white shadow-2xl">
          {notice}
        </div>
      )}

      {/* ===== Header ===== */}
      <div className="rounded-2xl border border-gray-800 bg-neutral-900">
        <div className="flex flex-col gap-2 border-b border-gray-800 bg-neutral-950 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black uppercase italic text-white">{tournament.name}</h2>
            <p className="text-sm text-gray-500">
              {formatDate(tournament.starts_on)} – {formatDate(tournament.ends_on)}
              {tournament.venue_name ? ` · ${tournament.venue_name}` : ''}
              {' · '}<a href="/tournament" target="_blank" rel="noreferrer" className="text-[#D4AF37] underline">public page</a>
            </p>
          </div>
          <button onClick={() => void load(true)} className={`${smallButton} border border-gray-700 text-gray-300 hover:text-white`}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Teams in', `${summary.entered} / ${summary.totalTeams}`, 'text-white'],
            ['Unpaid teams', summary.unpaid, summary.unpaid > 0 ? 'text-red-300' : 'text-gray-500'],
            ['Bamika teams', summary.bamika, 'text-[#D4AF37]'],
            ['Players on rosters', summary.players, 'text-white'],
            ['Clubs to review', summary.pendingClubs, summary.pendingClubs > 0 ? 'text-yellow-300' : 'text-gray-500'],
            ['Collected', formatMoney(summary.collected), 'text-green-300'],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-xl border border-gray-800 bg-black p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
              <p className={`mt-1 text-2xl font-black italic ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 overflow-x-auto border-t border-gray-800 px-3 py-2">
          {([
            ['teams', 'Teams & rosters'],
            ['schedule', 'Schedule'],
            ['clubs', `Clubs${summary.pendingClubs ? ` (${summary.pendingClubs} new)` : ''}`],
            ['bamika', 'Bamika teams'],
            ['settings', 'Settings'],
          ] as Array<[View, string]>).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-[11px] font-black uppercase tracking-widest ${view === value ? 'bg-[#EF4444] text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Teams & rosters ===== */}
      {view === 'teams' && (
        <div className="rounded-2xl border border-gray-800 bg-neutral-900">
          <div className="flex flex-col gap-3 border-b border-gray-800 bg-neutral-950 p-4">
            <div className="flex flex-wrap gap-1">
              {['all', ...tournament.divisions].map((division) => {
                const count = division === 'all' ? entries.length : entries.filter((entry) => entry.team.division === division).length
                return (
                  <button key={division} onClick={() => setDivisionFilter(division)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${divisionFilter === division ? 'bg-[#D4AF37] text-black' : 'border border-gray-800 text-gray-400 hover:text-white'}`}>
                    {division === 'all' ? 'All ages' : division} · {count}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team, club or player" className={`${inputClass} pl-9`} />
              </div>
              <div className="flex gap-1">
                {([['all', 'All'], ['entered', 'Paid / Bamika'], ['unpaid', 'Unpaid']] as const).map(([value, label]) => (
                  <button key={value} onClick={() => setPaymentFilter(value)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest ${paymentFilter === value ? 'bg-[#EF4444] text-white' : 'border border-gray-800 text-gray-400 hover:text-white'}`}>{label}</button>
                ))}
              </div>
              <button
                disabled={printableVisible.length === 0}
                onClick={() => setPrintTeamIds(printableVisible.map((entry) => entry.team.id))}
                className={`${smallButton} bg-[#EF4444] py-2.5 text-white hover:bg-red-600`}
              >
                <Printer size={12} /> Print {printableVisible.length} roster{printableVisible.length === 1 ? '' : 's'}
              </button>
            </div>
            {rostersLocked && (
              <p className="text-xs text-yellow-300">
                Club rosters are locked (deadline passed), so clubs cannot edit them from their link. You can still add or remove players here, or reopen rosters in Settings.
              </p>
            )}
          </div>

          {visibleEntries.length === 0 ? (
            <div className="p-10 text-center">
              <Trophy className="mx-auto mb-3 text-[#D4AF37]" size={34} />
              <p className="text-sm text-gray-500">No teams match these filters.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5 p-4">
              {visibleDivisions.map((division) => {
                const inDivision = visibleEntries.filter((entry) => entry.team.division === division)
                return (
                  <section key={division}>
                    <h3 className="mb-2 flex items-baseline gap-2 text-sm font-black uppercase tracking-widest text-[#D4AF37]">
                      {division} <span className="text-[10px] text-gray-500">{inDivision.length} team{inDivision.length === 1 ? '' : 's'}</span>
                    </h3>
                    <div className="flex flex-col gap-2">{inDivision.map(renderTeamRow)}</div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== Schedule ===== */}
      {view === 'schedule' && (
        <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-4 sm:p-5">
          <TournamentSchedule venue={tournament.venue_name} />
          <p className="mt-4 text-xs text-gray-500">
            Public link for parents and clubs: <a href="/tournament/schedule" target="_blank" rel="noreferrer" className="text-[#D4AF37] underline">bamikafc.com/tournament/schedule</a>.
            The schedule is set in the site code (src/lib/tournamentSchedule.ts) — ask to have it changed.
          </p>
        </div>
      )}

      {/* ===== Clubs ===== */}
      {view === 'clubs' && (
        <div className="rounded-2xl border border-gray-800 bg-neutral-900">
          <div className="flex flex-col gap-3 border-b border-gray-800 bg-neutral-950 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">Visiting clubs. Approve a club to email them their private link; paying and rosters happen there.</p>
            <div className="flex flex-wrap gap-1">
              {(['all', 'pending', 'approved', 'declined'] as const).map((value) => (
                <button key={value} onClick={() => setClubFilter(value)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest ${clubFilter === value ? 'bg-[#EF4444] text-white' : 'text-gray-500 hover:text-white'}`}>{value}</button>
              ))}
            </div>
          </div>

          {visitingClubs.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">No clubs {clubFilter === 'all' ? 'yet' : `marked ${clubFilter}`}.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {visitingClubs.map((club) => {
                const teams = club.tournament_club_teams
                const paidCount = teams.filter((team) => team.payment_status === 'paid').length
                const busy = busyKey.endsWith(club.id)
                return (
                  <div key={club.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-black uppercase italic text-white">{club.club_name}</h4>
                        {club.city && <span className="text-xs text-gray-500">{club.city}</span>}
                        <span className={`rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-widest ${statusStyles[club.status]}`}>{club.status}</span>
                        <span className="rounded-full border border-gray-700 px-3 py-0.5 text-[10px] font-black tracking-widest text-gray-400">{club.reference_code}</span>
                      </div>
                      <p className="mt-2 text-sm text-gray-300">
                        <span className="font-bold text-white">{club.contact_name}</span>
                        {' · '}<a className="inline-flex items-center gap-1 text-[#D4AF37] hover:underline" href={`mailto:${club.email}`}><Mail size={12} />{club.email}</a>
                        {' · '}<a className="inline-flex items-center gap-1 text-[#D4AF37] hover:underline" href={`tel:${club.phone}`}><Phone size={12} />{club.phone}</a>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {teams.map((team) => (
                          <span key={team.id} className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-black px-3 py-1.5 text-xs font-bold text-gray-200">
                            <span className="text-[#D4AF37]">{team.division}</span> {team.team_name}
                            <PaymentBadge status={team.payment_status} />
                            <span className="text-gray-500">{(rosterByTeam[team.id] || []).length} players</span>
                          </span>
                        ))}
                        {teams.length === 0 && <span className="text-xs text-gray-500">No teams on this request.</span>}
                      </div>
                      {club.notes && <p className="mt-3 border-l-2 border-gray-700 pl-3 text-sm italic text-gray-400">{club.notes}</p>}
                      <p className="mt-3 text-xs text-gray-500">
                        Registered {new Date(club.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}{paidCount} of {teams.length} paid · {formatMoney(paidCount * tournament.team_fee_cents)} collected
                        {' · '}<button onClick={() => { setView('teams'); setSearch(club.club_name); setDivisionFilter('all'); setPaymentFilter('all') }} className="text-[#D4AF37] underline">open teams &amp; rosters</button>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col">
                      {club.status !== 'approved' && (
                        <button disabled={busy} onClick={() => setClubStatus(club, 'approved')} className={`${smallButton} bg-green-600 text-white hover:bg-green-500`}>
                          {busyKey === `status-${club.id}` ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve &amp; send link
                        </button>
                      )}
                      {club.status === 'approved' && (
                        <>
                          <button disabled={busy} onClick={() => copyLink(club)} className={`${smallButton} border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10`}><Copy size={12} /> Copy club link</button>
                          <button disabled={busy} onClick={() => resendLink(club)} className={`${smallButton} border border-gray-700 text-gray-300 hover:text-white`}>
                            {busyKey === `resend-${club.id}` ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />} Email link again
                          </button>
                          {paidCount < teams.length && (
                            <button disabled={busy} onClick={() => syncPayments(club)} className={`${smallButton} border border-gray-700 text-gray-300 hover:text-white`}>
                              {busyKey === `sync-${club.id}` ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Check Stripe payments
                            </button>
                          )}
                        </>
                      )}
                      {club.status !== 'declined' && (confirmKey === `decline-${club.id}` ? (
                        <div className="flex gap-2">
                          <button disabled={busy} onClick={() => setClubStatus(club, 'declined')} className={`${smallButton} flex-1 bg-red-600 text-white`}>Yes, decline</button>
                          <button onClick={() => setConfirmKey('')} className={`${smallButton} border border-gray-700 text-gray-400`}>Keep</button>
                        </div>
                      ) : (
                        <button disabled={busy} onClick={() => setConfirmKey(`decline-${club.id}`)} className={`${smallButton} border border-red-500/50 text-red-300 hover:bg-red-500/10`}><X size={12} /> Decline</button>
                      ))}
                      {club.status !== 'pending' && (
                        <button disabled={busy} onClick={() => setClubStatus(club, 'pending')} className={`${smallButton} border border-gray-700 text-gray-400 hover:text-white`}><RotateCcw size={12} /> Back to pending</button>
                      )}
                      {confirmKey === `delete-${club.id}` ? (
                        <div className="flex flex-col gap-2 rounded-xl border border-red-500/40 p-2">
                          <p className="text-[11px] text-red-200">
                            Delete {club.club_name}, its {teams.length} team{teams.length === 1 ? '' : 's'} and rosters?
                            {paidCount > 0 ? ` ${paidCount} team${paidCount === 1 ? ' is' : 's are'} paid — this does not refund Stripe.` : ''}
                          </p>
                          <div className="flex gap-2">
                            <button disabled={busy} onClick={() => deleteClub(club)} className={`${smallButton} flex-1 bg-red-700 text-white`}>
                              {busyKey === `delete-${club.id}` ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                            </button>
                            <button onClick={() => setConfirmKey('')} className={`${smallButton} border border-gray-700 text-gray-400`}>Keep</button>
                          </div>
                        </div>
                      ) : (
                        <button disabled={busy} onClick={() => setConfirmKey(`delete-${club.id}`)} className={`${smallButton} border border-gray-800 text-gray-500 hover:border-red-500/50 hover:text-red-400`}><Trash2 size={12} /> Delete club</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== Bamika teams ===== */}
      {view === 'bamika' && (
        <div className="rounded-2xl border border-gray-800 bg-neutral-900">
          <div className="border-b border-gray-800 bg-neutral-950 p-4">
            <p className="text-sm font-bold text-white">Enter Bamika&rsquo;s own teams (no entry fee) and pick their players from the club roster.</p>
            <p className="mt-1 text-xs text-gray-500">Each Bamika team below shows whether it is in the tournament. Coaches can also enter their own team from the coach dashboard — those show up here too.</p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {bamikaTeamLabels.map((label) => {
              const division = (label.match(/^(U\d{1,2})/i)?.[1] || '').toUpperCase()
              const inTournament = tournament.divisions.includes(division)
              const teamEntries = homeEntries.filter((entry) => entry.team.coach_team === label)
              const playerCount = clubPlayers.filter((player) => player.team_assigned === label).length
              return (
                <BamikaTeamCard
                  key={label}
                  label={label}
                  division={division}
                  inTournament={inTournament}
                  playerCount={playerCount}
                  entries={teamEntries}
                  rosterByTeam={rosterByTeam}
                  busy={busyKey === `home-${label}`}
                  onEnter={(teamName) => enterHomeTeam(division, teamName, label)}
                  onOpen={(teamId) => { setView('teams'); setDivisionFilter('all'); setPaymentFilter('all'); setSearch(''); setOpenTeamId(teamId); void loadCertLinks(teamId) }}
                />
              )
            })}
          </div>
          {homeEntries.some((entry) => !entry.team.coach_team || !bamikaTeamLabels.includes(entry.team.coach_team)) && (
            <div className="border-t border-gray-800 p-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Other Bamika entries</p>
              <div className="flex flex-col gap-2">
                {homeEntries.filter((entry) => !entry.team.coach_team || !bamikaTeamLabels.includes(entry.team.coach_team)).map(renderTeamRow)}
              </div>
            </div>
          )}
          {!homeClub && <p className="border-t border-gray-800 p-4 text-xs text-gray-500">No Bamika team has been entered yet.</p>}
        </div>
      )}

      {/* ===== Settings ===== */}
      {view === 'settings' && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Registration &amp; rosters</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <p className="text-sm font-black uppercase text-white">New club sign-ups: <span className={tournament.registration_open ? 'text-green-300' : 'text-red-300'}>{tournament.registration_open ? 'open' : 'closed'}</span></p>
                <p className="mt-1 text-xs text-gray-500">Controls the sign-up form on the public tournament page. It does not affect clubs that already registered.</p>
                <button onClick={() => saveTournament({ registration_open: !tournament.registration_open }, `New club sign-ups ${tournament.registration_open ? 'closed' : 'opened'}.`)} className={`${smallButton} mt-3 border border-gray-700 text-gray-200 hover:text-white`}>
                  {tournament.registration_open ? 'Close sign-ups' : 'Open sign-ups'}
                </button>
              </div>
              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <p className="text-sm font-black uppercase text-white">Club roster editing: <span className={rostersLocked ? 'text-red-300' : 'text-green-300'}>{rostersLocked ? 'locked' : 'open'}</span></p>
                <p className="mt-1 text-xs text-gray-500">
                  {tournament.roster_deadline ? `Deadline ${formatDate(tournament.roster_deadline)}. ` : 'No deadline set. '}
                  When locked, clubs cannot add players from their link. You can always edit rosters from Teams &amp; rosters.
                </p>
                {rostersLocked ? (
                  <button onClick={() => saveTournament({ roster_deadline: null }, 'Rosters reopened — clubs can add players from their link again.')} className={`${smallButton} mt-3 bg-green-600 text-white hover:bg-green-500`}>Reopen rosters for clubs</button>
                ) : (
                  <button onClick={() => {
                    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
                    void saveTournament({ roster_deadline: yesterday }, 'Rosters locked — clubs can no longer change them.')
                  }} className={`${smallButton} mt-3 border border-red-500/50 text-red-300 hover:bg-red-500/10`}>Lock rosters now</button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Age groups in the tournament</p>
            <p className="mt-1 text-xs text-gray-500">Shown on the public page and used for team entries. Turning one off does not delete teams already entered in it.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['U8', 'U10', 'U12', 'U14', 'U16'].map((division) => {
                const on = tournament.divisions.includes(division)
                return (
                  <button
                    key={division}
                    onClick={() => {
                      const next = on ? tournament.divisions.filter((value) => value !== division) : [...tournament.divisions, division]
                      if (next.length === 0) return
                      next.sort((a, b) => divisionOrder(a) - divisionOrder(b))
                      void saveTournament({ divisions: next }, `${division} ${on ? 'removed from' : 'added to'} the tournament.`)
                    }}
                    className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest ${on ? 'bg-[#D4AF37] text-black' : 'border border-gray-700 text-gray-500 hover:text-white'}`}
                  >
                    {on ? <Check size={12} className="mr-1 inline" /> : null}{division}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Dates &amp; venue (shown on the public page and in emails)</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">First day</span>
                <input type="date" className={inputClass} value={venueDraft.starts_on} onChange={(e) => setVenueDraft({ ...venueDraft, starts_on: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Last day</span>
                <input type="date" className={inputClass} value={venueDraft.ends_on} onChange={(e) => setVenueDraft({ ...venueDraft, ends_on: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Roster deadline (empty = never lock)</span>
                <input type="date" className={inputClass} value={venueDraft.roster_deadline} onChange={(e) => setVenueDraft({ ...venueDraft, roster_deadline: e.target.value })} />
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <input className={inputClass} placeholder="Venue name" value={venueDraft.venue_name} onChange={(e) => setVenueDraft({ ...venueDraft, venue_name: e.target.value })} />
              <input className={inputClass} placeholder="Street address, city, state" value={venueDraft.venue_address} onChange={(e) => setVenueDraft({ ...venueDraft, venue_address: e.target.value })} />
              <button
                disabled={!venueDraft.starts_on || !venueDraft.ends_on || venueDraft.ends_on < venueDraft.starts_on}
                onClick={() => saveTournament({
                  starts_on: venueDraft.starts_on,
                  ends_on: venueDraft.ends_on,
                  venue_name: venueDraft.venue_name.trim() || null,
                  venue_address: venueDraft.venue_address.trim() || null,
                  roster_deadline: venueDraft.roster_deadline || null,
                }, 'Dates and venue saved.')}
                className={`${smallButton} bg-[#EF4444] text-white`}
              >
                <Save size={12} /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Print sheets (portal outside the app so nothing else prints) ===== */}
      {printTeamIds && createPortal(
        <div className="print-area print-portal">
          {printTeamIds.map((teamId) => {
            const entry = entries.find((row) => row.team.id === teamId)
            if (!entry) return null
            const players = rosterByTeam[teamId] || []
            return (
              <section key={teamId} className="print-page">
                <header className="print-header">
                  <div>
                    <h1>{entry.team.division} — {entry.team.team_name}</h1>
                    <p>
                      {entry.club.is_home ? 'Bamika FC' : entry.club.club_name}
                      {entry.club.is_home ? '' : ` · ${entry.club.contact_name} · ${entry.club.phone}`}
                      {entry.team.group_label ? ` · Group ${entry.team.group_label}` : ''}
                    </p>
                    <p>{tournament.name} · {formatDate(tournament.starts_on)} – {formatDate(tournament.ends_on)}{tournament.venue_name ? ` · ${tournament.venue_name}` : ''}</p>
                  </div>
                  <img src="/logo.png" alt="" className="print-logo" />
                </header>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '7%' }}>#</th>
                      <th style={{ width: '37%' }}>Player</th>
                      <th style={{ width: '18%' }}>Birth date</th>
                      <th style={{ width: '8%' }}>Age</th>
                      <th style={{ width: '12%' }}>Cert</th>
                      <th style={{ width: '18%' }}>Checked in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => (
                      <tr key={player.id}>
                        <td>{player.jersey_number || index + 1}</td>
                        <td className="print-strong">{player.full_name}</td>
                        <td>{formatDate(player.date_of_birth)}</td>
                        <td>{ageOn(player.date_of_birth, tournament.starts_on)}</td>
                        <td>{player.birth_cert_path ? 'Yes' : 'MISSING'}</td>
                        <td>&#9744;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="print-foot">
                  {players.length} player{players.length === 1 ? '' : 's'} · Payment: {entry.team.payment_status === 'waived' ? 'Bamika team (no fee)' : entry.team.payment_status}
                  {' · '}Printed {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
                <p className="print-foot">Coach signature: ____________________________ Field marshal: ____________________________</p>
              </section>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AddPlayerForm({ busy, onAdd }: { busy: boolean, onAdd: (body: Record<string, unknown>, label: string) => Promise<void> }) {
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileKey, setFileKey] = useState(0)

  const submit = async () => {
    const body: Record<string, unknown> = { fullName: fullName.trim(), dateOfBirth, jerseyNumber: jerseyNumber.trim() }
    if (file) body.birthCert = await readFileAsBase64(file)
    await onAdd(body, fullName.trim())
    setFullName('')
    setDateOfBirth('')
    setJerseyNumber('')
    setFile(null)
    setFileKey((key) => key + 1)
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-neutral-950 p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400"><Plus size={11} className="mr-1 inline" />Add a player by hand</p>
      <div className="grid gap-2 sm:grid-cols-[2fr_1.3fr_0.6fr]">
        <input className={inputClass} placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        <input className={inputClass} type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} aria-label="Date of birth" />
        <input className={inputClass} placeholder="#" value={jerseyNumber} maxLength={4} onChange={(event) => setJerseyNumber(event.target.value)} aria-label="Jersey number" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-gray-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white">
          <Upload size={11} /> {file ? file.name.slice(0, 24) : 'Birth certificate (optional)'}
          <input key={fileKey} type="file" accept="application/pdf,image/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button disabled={busy || fullName.trim().length < 2 || !dateOfBirth} onClick={() => void submit()} className={`${smallButton} ml-auto bg-[#EF4444] text-white`}>
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add player
        </button>
      </div>
    </div>
  )
}

function BamikaPlayerPicker({ players, defaultTeam, takenIds, busy, onPick }: {
  players: ClubPlayer[]
  defaultTeam: string
  takenIds: Set<string>
  busy: boolean
  onPick: (player: ClubPlayer) => Promise<void>
}) {
  const [teamFilter, setTeamFilter] = useState(defaultTeam || 'all')
  const [term, setTerm] = useState('')
  const teams = useMemo(() => [...new Set(players.map((player) => player.team_assigned || 'Unassigned'))].sort(), [players])
  const shown = players.filter((player) => {
    if (takenIds.has(player.id)) return false
    if (teamFilter !== 'all' && (player.team_assigned || 'Unassigned') !== teamFilter) return false
    return !term.trim() || player.full_name.toLowerCase().includes(term.trim().toLowerCase())
  })

  return (
    <div className="rounded-xl border border-[#D4AF37]/30 bg-neutral-950 p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]"><Users size={11} className="mr-1 inline" />Add from Bamika players</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <select className={inputClass} value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
          <option value="all">All Bamika players</option>
          {teams.map((team) => <option key={team} value={team}>{team}</option>)}
        </select>
        <input className={inputClass} placeholder="Search name" value={term} onChange={(event) => setTerm(event.target.value)} />
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-900">
        {shown.length === 0 ? (
          <p className="p-3 text-xs text-gray-500">No players to add with this filter.</p>
        ) : shown.map((player) => (
          <div key={player.id} className="flex items-center justify-between gap-2 border-b border-gray-900 px-3 py-2 last:border-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{player.full_name}</p>
              <p className="text-[11px] text-gray-500">
                {player.team_assigned || 'Unassigned'} · {player.date_of_birth ? formatDate(player.date_of_birth) : <span className="text-red-300">no birth date</span>}
              </p>
            </div>
            <button disabled={busy || !player.date_of_birth} onClick={() => void onPick(player)} className={`${smallButton} shrink-0 border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10`}>
              <Plus size={12} /> Add
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function BamikaTeamCard({ label, division, inTournament, playerCount, entries, rosterByTeam, busy, onEnter, onOpen }: {
  label: string
  division: string
  inTournament: boolean
  playerCount: number
  entries: Entry[]
  rosterByTeam: Record<string, RosterPlayer[]>
  busy: boolean
  onEnter: (teamName: string) => Promise<void>
  onOpen: (teamId: string) => void
}) {
  const [teamName, setTeamName] = useState(`Bamika FC ${label}`)

  return (
    <div className={`rounded-xl border p-4 ${entries.length > 0 ? 'border-green-500/30 bg-green-500/5' : 'border-gray-800 bg-black'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-black uppercase italic text-white">{label}</p>
          <p className="text-xs text-gray-500">{playerCount} registered player{playerCount === 1 ? '' : 's'}</p>
        </div>
        {entries.length > 0
          ? <span className="rounded-full border border-green-500/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-green-300">In tournament</span>
          : <span className="rounded-full border border-gray-700 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-gray-500">Not entered</span>}
      </div>

      {entries.map((entry) => (
        <button key={entry.team.id} onClick={() => onOpen(entry.team.id)} className="mt-2 flex w-full items-center justify-between rounded-lg border border-gray-800 bg-black px-3 py-2 text-left text-sm hover:border-[#D4AF37]/50">
          <span className="font-bold text-white"><span className="text-[#D4AF37]">{entry.team.division}</span> {entry.team.team_name}</span>
          <span className="text-xs text-gray-400">{(rosterByTeam[entry.team.id] || []).length} players · open <ChevronRight size={12} className="inline" /></span>
        </button>
      ))}

      {inTournament ? (
        <div className="mt-3 flex gap-2">
          <input className={inputClass} value={teamName} onChange={(event) => setTeamName(event.target.value)} aria-label="Team name in the tournament" />
          <button disabled={busy || teamName.trim().length < 2} onClick={() => void onEnter(teamName.trim())} className={`${smallButton} shrink-0 bg-[#EF4444] text-white`}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {entries.length > 0 ? 'Add another' : 'Enter'}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-600">{division || label} is not a tournament age group.</p>
      )}
    </div>
  )
}
