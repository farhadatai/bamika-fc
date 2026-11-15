import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock, CreditCard, FileCheck2, FileWarning, Loader2, Lock, MapPin, Plus, ShieldAlert, Trash2, Upload, Users } from 'lucide-react'

interface PortalTournament {
  name: string
  starts_on: string
  ends_on: string
  venue_name: string | null
  venue_address: string | null
  team_fee_cents: number
  roster_min: number
  roster_max: number
  roster_deadline: string | null
  rosters_locked: boolean
}

interface PortalTeam {
  id: string
  division: string
  team_name: string
  group_label: string | null
  payment_status: 'unpaid' | 'paid' | 'refunded'
  paid_at: string | null
}

interface RosterPlayer {
  id: string
  team_id: string
  full_name: string
  date_of_birth: string
  jersey_number: string | null
  has_birth_cert: boolean
}

interface PortalData {
  tournament: PortalTournament | null
  club: { club_name: string, contact_name: string, email: string, status: 'pending' | 'approved' | 'declined', reference_code: string }
  teams: PortalTeam[]
  roster: RosterPlayer[]
}

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
const formatDay = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const formatBirthDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const ACCEPTED_CERT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif'
const MAX_CERT_BYTES = 6 * 1024 * 1024

// Reads a file as base64 (without the data: prefix) so the API can store it.
const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
  reader.onerror = () => reject(new Error('Could not read that file.'))
  reader.readAsDataURL(file)
})

// iPhones report HEIC photos with an empty type; map by extension as a fallback.
const certMimeType = (file: File) => {
  if (file.type) return file.type
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  return ''
}

const emptyPlayerForm = { fullName: '', dateOfBirth: '', jerseyNumber: '' }

interface TeamRosterProps {
  token: string
  team: PortalTeam
  tournament: PortalTournament
  players: RosterPlayer[]
  onChange: (next: (current: RosterPlayer[]) => RosterPlayer[]) => void
}

function TeamRoster({ token, team, tournament, players, onChange }: TeamRosterProps) {
  const [form, setForm] = useState(emptyPlayerForm)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyPlayerId, setBusyPlayerId] = useState('')
  const [confirmRemoveId, setConfirmRemoveId] = useState('')
  const [replacingId, setReplacingId] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)

  const locked = tournament.rosters_locked
  const full = players.length >= tournament.roster_max
  const missingCerts = players.filter((player) => !player.has_birth_cert).length
  const complete = players.length >= tournament.roster_min && missingCerts === 0

  const encodeFile = async (chosen: File) => {
    const type = certMimeType(chosen)
    if (!type || !ACCEPTED_CERT.split(',').includes(type)) throw new Error('Upload the birth certificate as a PDF or a photo (JPG, PNG, HEIC).')
    if (chosen.size > MAX_CERT_BYTES) throw new Error('That file is over 6 MB. Take a smaller photo or compress the PDF.')
    return { name: chosen.name, type, data: await fileToBase64(chosen) }
  }

  const addPlayer = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const birthCert = file ? await encodeFile(file) : undefined
      const response = await fetch(`/api/tournament/club/${token}/teams/${team.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, birthCert }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.player) throw new Error(payload.error || 'Could not add the player.')
      onChange((current) => [...current, payload.player as RosterPlayer])
      setForm(emptyPlayerForm)
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add the player.')
    } finally {
      setSaving(false)
    }
  }

  const removePlayer = async (player: RosterPlayer) => {
    setError('')
    setBusyPlayerId(player.id)
    try {
      const response = await fetch(`/api/tournament/club/${token}/players/${player.id}`, { method: 'DELETE' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not remove the player.')
      onChange((current) => current.filter((row) => row.id !== player.id))
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the player.')
    } finally {
      setBusyPlayerId('')
      setConfirmRemoveId('')
    }
  }

  const replaceCert = async (player: RosterPlayer, chosen: File) => {
    setError('')
    setBusyPlayerId(player.id)
    try {
      const birthCert = await encodeFile(chosen)
      const response = await fetch(`/api/tournament/club/${token}/players/${player.id}/birth-certificate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthCert }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not upload the birth certificate.')
      onChange((current) => current.map((row) => (row.id === player.id ? { ...row, has_birth_cert: true } : row)))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the birth certificate.')
    } finally {
      setBusyPlayerId('')
      setReplacingId('')
      if (replaceInput.current) replaceInput.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-neutral-900">
      <div className="flex flex-col gap-3 border-b border-gray-800 bg-neutral-950 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black uppercase italic"><span className="text-[#D4AF37]">{team.division}</span> {team.team_name}{team.group_label ? <span className="text-gray-500"> · Group {team.group_label}</span> : null}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {players.length} of {tournament.roster_max} players · minimum {tournament.roster_min}
            {missingCerts > 0 ? ` · ${missingCerts} missing a birth certificate` : ''}
          </p>
        </div>
        {locked ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400"><Lock size={12} /> Locked</span>
        ) : complete ? (
          <span className="inline-flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-green-300"><CheckCircle2 size={12} /> Roster complete</span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-yellow-200"><Clock size={12} /> {players.length < tournament.roster_min ? `${tournament.roster_min - players.length} more needed` : 'Certificates missing'}</span>
        )}
      </div>

      {players.length > 0 && (
        <ol className="divide-y divide-gray-800">
          {players.map((player, index) => {
            const busy = busyPlayerId === player.id
            return (
              <li key={player.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-sm font-black text-[#D4AF37]">{player.jersey_number || index + 1}</span>
                  <div>
                    <p className="font-bold text-white">{player.full_name}</p>
                    <p className="text-xs text-gray-500">Born {formatBirthDate(player.date_of_birth)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {player.has_birth_cert ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-green-300"><FileCheck2 size={12} /> Certificate on file</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-300"><FileWarning size={12} /> No certificate</span>
                  )}
                  {!locked && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => { setReplacingId(player.id); replaceInput.current?.click() }}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:border-[#D4AF37] hover:text-white disabled:opacity-50"
                      >
                        {busy && replacingId === player.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {player.has_birth_cert ? 'Replace' : 'Upload'}
                      </button>
                      {confirmRemoveId === player.id ? (
                        <span className="inline-flex items-center gap-1">
                          <button type="button" disabled={busy} onClick={() => removePlayer(player)} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white">{busy ? '…' : 'Remove'}</button>
                          <button type="button" onClick={() => setConfirmRemoveId('')} className="rounded-lg border border-gray-700 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Keep</button>
                        </span>
                      ) : (
                        <button type="button" disabled={busy} onClick={() => setConfirmRemoveId(player.id)} className="rounded-lg p-1.5 text-gray-500 hover:text-red-400" aria-label={`Remove ${player.full_name}`}><Trash2 size={14} /></button>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <input
        ref={replaceInput}
        type="file"
        accept={ACCEPTED_CERT}
        className="hidden"
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          const target = players.find((row) => row.id === replacingId)
          if (chosen && target) void replaceCert(target, chosen)
        }}
      />

      {!locked && !full && (
        <form onSubmit={addPlayer} className="border-t border-gray-800 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500"><Plus size={10} className="mr-1 inline" />Add player {players.length + 1}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_150px_80px]">
            <input
              required
              value={form.fullName}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              placeholder="Player full name"
              autoComplete="off"
              className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-[#D4AF37] focus:outline-none"
            />
            <input
              required
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
              aria-label="Date of birth"
              className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
            />
            <input
              value={form.jerseyNumber}
              onChange={(event) => setForm({ ...form, jerseyNumber: event.target.value.replace(/[^0-9]/g, '').slice(0, 3) })}
              placeholder="#"
              inputMode="numeric"
              aria-label="Jersey number"
              className="rounded-xl border border-gray-800 bg-black px-4 py-3 text-center text-sm text-white placeholder:text-gray-600 focus:border-[#D4AF37] focus:outline-none"
            />
          </div>
          <label className="mt-3 flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-gray-700 bg-black/50 p-4 text-sm text-gray-400 hover:border-[#D4AF37] sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><Upload size={16} className="text-[#D4AF37]" />{file ? <span className="text-white">{file.name}</span> : 'Birth certificate — PDF or photo (you can also add it later)'}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Max 6 MB</span>
            <input ref={fileInput} type="file" accept={ACCEPTED_CERT} className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
          {error && <p className="mt-3 text-sm font-bold text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-red-600 disabled:opacity-60 sm:w-auto"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {saving ? 'Saving…' : 'Add to roster'}
          </button>
        </form>
      )}
      {!locked && full && <p className="border-t border-gray-800 p-4 text-sm text-gray-500">This roster is full ({tournament.roster_max} players). Remove a player to add another.</p>}
      {error && (locked || full) && <p className="px-4 pb-4 text-sm font-bold text-red-300">{error}</p>}
    </div>
  )
}

export default function TournamentClub() {
  const { token = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingTeamId, setPayingTeamId] = useState('')
  const [banner, setBanner] = useState<{ tone: 'success' | 'info', text: string } | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/tournament/club/${token}`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'This club link is not valid.')
    setData({ ...payload, roster: payload.roster || [] })
  }, [token])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const sessionId = searchParams.get('session_id')
        if (sessionId) {
          // Back from Stripe: confirm this payment before showing the page.
          const response = await fetch(`/api/tournament/club/${token}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!cancelled) {
            setBanner(payload.paid
              ? { tone: 'success', text: 'Payment received — that team\'s spot is reserved. You can enter its roster below. A receipt is on its way to your email.' }
              : { tone: 'info', text: 'We could not confirm that payment yet. If your card was charged, it will show as paid within a few minutes — refresh this page.' })
          }
          setSearchParams({}, { replace: true })
        }
        await load()
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load your club page.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const payForTeam = async (team: PortalTeam) => {
    setPayingTeamId(team.id)
    setError('')
    try {
      const response = await fetch(`/api/tournament/club/${token}/teams/${team.id}/checkout`, { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Could not start the payment.')
      window.location.href = payload.url
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : 'Could not start the payment.')
      setPayingTeamId('')
    }
  }

  const updateRoster = (next: (current: RosterPlayer[]) => RosterPlayer[]) => {
    setData((current) => (current ? { ...current, roster: next(current.roster) } : current))
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-gray-500"><Loader2 className="animate-spin" size={32} /></div>
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-black px-4 py-20 text-white">
        <div className="mx-auto max-w-md rounded-3xl border border-red-500/30 bg-neutral-900 p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 text-red-400" size={44} />
          <h1 className="text-2xl font-black uppercase italic">Link not valid</h1>
          <p className="mt-3 text-sm text-gray-400">{error}</p>
          <p className="mt-4 text-sm text-gray-500">Use the exact link from your approval email, or contact Bamika FC to have it re-sent.</p>
        </div>
      </div>
    )
  }

  if (!data) return null
  const { tournament, club, teams, roster } = data
  const fee = tournament?.team_fee_cents || 0
  const paidTeams = teams.filter((team) => team.payment_status === 'paid')
  const unpaidTeams = teams.filter((team) => team.payment_status !== 'paid')

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="border-b border-gray-900 bg-gradient-to-b from-neutral-900 to-black px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#D4AF37]">{tournament?.name || 'Bamika FC Tournament'} · Club page</p>
          <h1 className="mt-3 text-3xl font-black uppercase italic sm:text-5xl">{club.club_name}</h1>
          <p className="mt-2 text-sm text-gray-400">Contact: {club.contact_name} · Reference {club.reference_code}</p>
          {tournament && (
            <div className="mt-5 flex flex-col gap-2 text-sm font-bold text-gray-300 sm:flex-row sm:gap-6">
              <span className="flex items-center gap-2"><CalendarDays className="text-[#EF4444]" size={16} />{formatDay(tournament.starts_on)} – {formatDay(tournament.ends_on)}</span>
              <span className="flex items-center gap-2"><MapPin className="text-[#EF4444]" size={16} />{tournament.venue_name || 'Venue announced soon'}{tournament.venue_address ? ` — ${tournament.venue_address}` : ''}</span>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          {banner && (
            <div className={`rounded-2xl border p-4 text-sm font-bold ${banner.tone === 'success' ? 'border-green-500/40 bg-green-500/10 text-green-200' : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200'}`}>
              {banner.text}
            </div>
          )}
          {error && <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-bold text-red-300">{error}</div>}

          {club.status === 'pending' && (
            <div className="rounded-2xl border border-yellow-500/30 bg-neutral-900 p-6">
              <div className="flex items-center gap-3"><Clock className="text-yellow-300" size={24} /><h2 className="text-xl font-black uppercase italic">Awaiting approval</h2></div>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">The tournament director is reviewing your request. You will get an email as soon as your club is approved — payment buttons appear here at that point.</p>
            </div>
          )}

          {club.status === 'declined' && (
            <div className="rounded-2xl border border-red-500/30 bg-neutral-900 p-6">
              <h2 className="text-xl font-black uppercase italic">Request not accepted</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">We were unable to accept your club for this tournament. Check your email for details, or reply to it with any questions.</p>
            </div>
          )}

          {club.status === 'approved' && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Teams</p>
                  <p className="mt-1 text-3xl font-black italic">{teams.length}</p>
                </div>
                <div className="rounded-2xl border border-green-500/30 bg-neutral-900 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Paid</p>
                  <p className="mt-1 text-3xl font-black italic text-green-300">{paidTeams.length} <span className="text-base text-gray-500">/ {teams.length}</span></p>
                </div>
                <div className="rounded-2xl border border-[#D4AF37]/30 bg-neutral-900 p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Still due</p>
                  <p className="mt-1 text-3xl font-black italic text-[#D4AF37]">{formatMoney(unpaidTeams.length * fee)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-neutral-900">
                <div className="border-b border-gray-800 bg-neutral-950 p-5">
                  <h2 className="text-xl font-black uppercase italic">Your teams</h2>
                  <p className="mt-1 text-sm text-gray-500">Pay {formatMoney(fee)} per team, one at a time, with any card. Each team's spot is reserved the moment it is paid.</p>
                </div>
                <div className="divide-y divide-gray-800">
                  {teams.map((team) => {
                    const paid = team.payment_status === 'paid'
                    const busy = payingTeamId === team.id
                    const count = roster.filter((player) => player.team_id === team.id).length
                    return (
                      <div key={team.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-black uppercase italic"><span className="text-[#D4AF37]">{team.division}</span> {team.team_name}</p>
                          <p className="text-xs text-gray-500">
                            {paid
                              ? `Paid${team.paid_at ? ` on ${new Date(team.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''} · spot reserved${team.group_label ? ` · Group ${team.group_label}` : ''} · ${count} player${count === 1 ? '' : 's'} on roster`
                              : `${formatMoney(fee)} entry fee due`}
                          </p>
                        </div>
                        {paid ? (
                          <a href={`#roster-${team.id}`} className="inline-flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-300 hover:bg-green-500/20"><CheckCircle2 size={14} /> Paid · Roster ↓</a>
                        ) : (
                          <button
                            onClick={() => payForTeam(team)}
                            disabled={Boolean(payingTeamId)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EF4444] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-red-600 disabled:opacity-60"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Pay {formatMoney(fee)}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-6">
                <div className="flex items-center gap-3"><Users className="text-[#D4AF37]" size={22} /><h2 className="text-lg font-black uppercase italic">Rosters</h2></div>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">
                  Enter {tournament?.roster_min ?? 9}–{tournament?.roster_max ?? 18} players per paid team, substitutes included: full name, date of birth, and a birth certificate for each player (PDF or a clear photo). Players without a birth certificate on file cannot be checked in on game day.
                  {tournament?.roster_deadline ? ` Rosters lock after ${new Date(`${tournament.roster_deadline}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.` : ''}
                </p>
                {tournament?.rosters_locked && <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300"><Lock size={12} /> Rosters are locked — contact Bamika FC for changes</p>}
                {paidTeams.length === 0 && <p className="mt-3 text-sm font-bold text-yellow-200">Pay for a team above to unlock its roster.</p>}
              </div>

              {tournament && paidTeams.map((team) => (
                <div key={team.id} id={`roster-${team.id}`} className="scroll-mt-24">
                  <TeamRoster
                    token={token}
                    team={team}
                    tournament={tournament}
                    players={roster.filter((player) => player.team_id === team.id)}
                    onChange={updateRoster}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
