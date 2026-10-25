import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardList, CreditCard, MapPin, Plus, Trash2, Trophy, Users } from 'lucide-react'

interface TournamentInfo {
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

interface TeamEntry {
  key: string
  division: string
  teamName: string
}

const FALLBACK_INFO: TournamentInfo = {
  name: 'Bamika FC Thanksgiving Cup 2026',
  starts_on: '2026-11-28',
  ends_on: '2026-11-29',
  venue_name: null,
  venue_address: null,
  team_fee_cents: 25000,
  divisions: ['U8', 'U10', 'U12', 'U14', 'U16'],
  roster_min: 9,
  roster_max: 18,
  registration_open: true,
}

const MAX_TEAMS_PER_DIVISION = 3

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`

const formatDay = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

const steps = [
  { icon: ClipboardList, title: 'Register your club', text: 'Fill out the form below with your club name, contact person, and the teams you want to enter. No account needed.' },
  { icon: CheckCircle2, title: 'Get approved', text: 'Our tournament director reviews your request and emails you within 1–2 days.' },
  { icon: CreditCard, title: 'Pay per team', text: 'Approved clubs receive a private link to pay the entry fee for each team. Your spot is reserved once paid.' },
  { icon: Users, title: 'Submit rosters', text: 'The same link unlocks your rosters: player names, birth dates, and a birth certificate for each player.' },
]

export default function Tournament() {
  const [info, setInfo] = useState<TournamentInfo>(FALLBACK_INFO)
  const [form, setForm] = useState({ clubName: '', contactName: '', email: '', phone: '', city: '', notes: '', website: '' })
  const [teams, setTeams] = useState<TeamEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ referenceCode: string, totalCents: number } | null>(null)

  useEffect(() => {
    fetch('/api/tournament/info')
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (payload?.tournament) setInfo({ ...FALLBACK_INFO, ...payload.tournament }) })
      .catch(() => { /* keep fallback copy */ })
  }, [])

  const teamsByDivision = useMemo(() => {
    const map = new Map<string, TeamEntry[]>()
    for (const team of teams) map.set(team.division, [...(map.get(team.division) || []), team])
    return map
  }, [teams])

  const totalCents = teams.length * info.team_fee_cents

  const addTeam = (division: string) => {
    const existing = teamsByDivision.get(division)?.length || 0
    if (existing >= MAX_TEAMS_PER_DIVISION) return
    const base = form.clubName.trim() || 'Team'
    const suffix = existing === 0 ? '' : ` ${String.fromCharCode(65 + existing)}`
    setTeams((current) => [...current, { key: `${division}-${Date.now()}-${existing}`, division, teamName: `${base} ${division}${suffix}` }])
  }

  const updateTeamName = (key: string, teamName: string) => {
    setTeams((current) => current.map((team) => (team.key === key ? { ...team, teamName } : team)))
  }

  const removeTeam = (key: string) => setTeams((current) => current.filter((team) => team.key !== key))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (teams.length === 0) {
      setError('Add at least one team to a division.')
      return
    }
    if (teams.some((team) => team.teamName.trim().length < 2)) {
      setError('Every team needs a name.')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/tournament/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, teams: teams.map(({ division, teamName }) => ({ division, teamName: teamName.trim() })) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Could not submit your request. Please try again.')
      setSuccess({ referenceCode: payload.referenceCode, totalCents: payload.totalCents })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit your request.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-gray-800 bg-black px-4 py-3 text-sm font-bold text-white outline-none placeholder:font-medium placeholder:text-gray-600 focus:border-[#D4AF37]'
  const labelClass = 'mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500'

  if (success) {
    return (
      <div className="min-h-screen bg-black px-4 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-green-500/30 bg-neutral-900 p-8 text-center sm:p-12">
          <CheckCircle2 className="mx-auto mb-6 text-green-400" size={56} />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Request received</p>
          <h1 className="mt-3 text-3xl font-black uppercase italic">You're on the list!</h1>
          <p className="mt-4 text-gray-400">Your reference code is</p>
          <p className="mt-1 text-3xl font-black tracking-widest text-[#D4AF37]">{success.referenceCode}</p>
          <div className="mt-8 rounded-2xl border border-gray-800 bg-black p-5 text-left text-sm leading-relaxed text-gray-300">
            <p><strong className="text-white">What happens next</strong></p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>We emailed a confirmation to <strong className="text-white">{form.email}</strong> (check spam if you don't see it).</li>
              <li>The tournament director reviews your request within 1–2 days.</li>
              <li>Once approved, you get a private link to pay <strong className="text-white">{formatMoney(info.team_fee_cents)} per team</strong> ({formatMoney(success.totalCents)} total for {teams.length} team{teams.length === 1 ? '' : 's'}).</li>
              <li>After payment, the same link opens your team rosters.</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-900 bg-gradient-to-b from-neutral-900 to-black px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#D4AF37]">Bamika FC presents</p>
          <h1 className="mt-4 text-4xl font-black uppercase italic leading-none sm:text-6xl">{info.name}</h1>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 text-sm font-bold text-gray-300 sm:flex-row sm:gap-8">
            <span className="flex items-center gap-2"><CalendarDays className="text-[#EF4444]" size={18} />{formatDay(info.starts_on)} &amp; {formatDay(info.ends_on)}</span>
            <span className="flex items-center gap-2"><MapPin className="text-[#EF4444]" size={18} />{info.venue_name || 'Venue announced soon'}{info.venue_address ? ` — ${info.venue_address}` : ''}</span>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {info.divisions.map((division) => (
              <span key={division} className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#D4AF37]">{division}</span>
            ))}
          </div>
          <p className="mt-6 text-lg font-black uppercase italic text-white">
            {formatMoney(info.team_fee_cents)} <span className="text-gray-500">per team</span>
          </p>
          <a href="#register" className="mt-8 inline-block rounded-xl bg-[#EF4444] px-10 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-red-600">
            Register your club
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-black uppercase italic sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-gray-800 bg-neutral-900 p-6">
                <div className="flex items-center justify-between">
                  <step.icon className="text-[#D4AF37]" size={26} />
                  <span className="text-3xl font-black italic text-gray-700">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-black uppercase italic">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-5">
              <Trophy className="text-[#EF4444]" size={22} />
              <p className="mt-3 text-sm font-black uppercase">Format</p>
              <p className="mt-1 text-sm text-gray-400">Group play on Saturday, playoffs and finals on Sunday. Groups are set after registration closes.</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-5">
              <Users className="text-[#EF4444]" size={22} />
              <p className="mt-3 text-sm font-black uppercase">Rosters</p>
              <p className="mt-1 text-sm text-gray-400">{info.roster_min} to {info.roster_max} players per team, substitutes included. Birth certificate required for every player.</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-5">
              <CreditCard className="text-[#EF4444]" size={22} />
              <p className="mt-3 text-sm font-black uppercase">Entry fee</p>
              <p className="mt-1 text-sm text-gray-400">{formatMoney(info.team_fee_cents)} per team. A club entering U8 and U10 pays {formatMoney(info.team_fee_cents * 2)}. Paid securely online after approval.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Registration form */}
      <section id="register" className="border-t border-gray-900 bg-neutral-950 px-4 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-black uppercase italic sm:text-3xl">Register your club</h2>
          <p className="mt-2 text-sm text-gray-400">Takes about two minutes. You will get a confirmation email right away.</p>

          {!info.registration_open ? (
            <div className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6 text-sm font-bold text-yellow-200">
              Registration is currently closed. Contact Bamika FC for late entries.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-8">
              <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5 sm:p-7">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Step 1 · Club details</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Club name *</label>
                    <input required className={inputClass} value={form.clubName} onChange={(e) => setForm({ ...form, clubName: e.target.value })} placeholder="e.g. Sacramento United FC" />
                  </div>
                  <div>
                    <label className={labelClass}>Contact person *</label>
                    <input required className={inputClass} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Full name" autoComplete="name" />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Where is your club based?" />
                  </div>
                  <div>
                    <label className={labelClass}>Email *</label>
                    <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@club.com" autoComplete="email" />
                  </div>
                  <div>
                    <label className={labelClass}>Phone *</label>
                    <input required type="tel" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(916) 555-0100" autoComplete="tel" />
                  </div>
                  {/* Honeypot — hidden from people, filled by bots */}
                  <div className="hidden" aria-hidden="true">
                    <label>Website</label>
                    <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5 sm:p-7">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Step 2 · Your teams</p>
                <p className="mt-2 text-sm text-gray-400">Add a team to every age group you want to enter. Up to {MAX_TEAMS_PER_DIVISION} teams per age group.</p>
                <div className="mt-5 space-y-3">
                  {info.divisions.map((division) => {
                    const entries = teamsByDivision.get(division) || []
                    return (
                      <div key={division} className="rounded-xl border border-gray-800 bg-black p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-black uppercase italic">{division}</p>
                            <p className="text-xs text-gray-500">{entries.length === 0 ? 'Not entering' : `${entries.length} team${entries.length === 1 ? '' : 's'} · ${formatMoney(entries.length * info.team_fee_cents)}`}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addTeam(division)}
                            disabled={entries.length >= MAX_TEAMS_PER_DIVISION}
                            className="flex items-center gap-1 rounded-lg border border-[#D4AF37]/50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37] transition hover:bg-[#D4AF37]/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus size={14} /> Add team
                          </button>
                        </div>
                        {entries.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {entries.map((team) => (
                              <div key={team.key} className="flex items-center gap-2">
                                <input
                                  required
                                  className={inputClass}
                                  value={team.teamName}
                                  onChange={(e) => updateTeamName(team.key, e.target.value)}
                                  placeholder={`Team name (e.g. ${form.clubName || 'Club'} ${division})`}
                                />
                                <button type="button" onClick={() => removeTeam(team.key)} className="rounded-lg border border-gray-800 p-3 text-gray-500 transition hover:border-red-500/50 hover:text-red-400" aria-label="Remove team">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-5 sm:p-7">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Step 3 · Anything we should know?</p>
                <textarea rows={3} className={`${inputClass} mt-4`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional — schedule conflicts, questions, coach names…" />
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-bold text-red-300">{error}</div>
              )}

              <div className="flex flex-col gap-4 rounded-2xl border border-[#D4AF37]/30 bg-black p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Estimated entry fees</p>
                  <p className="text-3xl font-black italic text-white">{formatMoney(totalCents)}</p>
                  <p className="text-xs text-gray-500">{teams.length} team{teams.length === 1 ? '' : 's'} × {formatMoney(info.team_fee_cents)} — nothing is charged today</p>
                </div>
                <button type="submit" disabled={submitting} className="rounded-xl bg-[#EF4444] px-8 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-red-600 disabled:opacity-60">
                  {submitting ? 'Submitting…' : 'Submit club request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
