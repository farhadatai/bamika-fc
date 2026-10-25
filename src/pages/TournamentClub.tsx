import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock, CreditCard, Loader2, MapPin, ShieldAlert, Users } from 'lucide-react'

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
}

interface PortalTeam {
  id: string
  division: string
  team_name: string
  group_label: string | null
  payment_status: 'unpaid' | 'paid' | 'refunded'
  paid_at: string | null
}

interface PortalData {
  tournament: PortalTournament | null
  club: { club_name: string, contact_name: string, email: string, status: 'pending' | 'approved' | 'declined', reference_code: string }
  teams: PortalTeam[]
}

const formatMoney = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
const formatDay = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

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
    setData(payload)
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
              ? { tone: 'success', text: 'Payment received — that team\'s spot is reserved. A receipt is on its way to your email.' }
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
  const { tournament, club, teams } = data
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
                    return (
                      <div key={team.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-lg font-black uppercase italic"><span className="text-[#D4AF37]">{team.division}</span> {team.team_name}</p>
                          <p className="text-xs text-gray-500">
                            {paid
                              ? `Paid${team.paid_at ? ` on ${new Date(team.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''} · spot reserved${team.group_label ? ` · Group ${team.group_label}` : ''}`
                              : `${formatMoney(fee)} entry fee due`}
                          </p>
                        </div>
                        {paid ? (
                          <span className="inline-flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-300"><CheckCircle2 size={14} /> Paid</span>
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
                  Roster entry opens here for each paid team: {tournament?.roster_min ?? 9}–{tournament?.roster_max ?? 18} players per team with name, date of birth, and a birth certificate for each player.
                  {tournament?.roster_deadline ? ` Rosters lock on ${new Date(`${tournament.roster_deadline}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.` : ''}
                  {' '}We will email you when roster entry is available — keep this link.
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
