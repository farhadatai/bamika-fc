import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, MapPin, Printer, Trophy, Users, X } from 'lucide-react'
import {
  DIVISION_TEAMS, FIELD_GROUPS, FORMAT_NOTES, GAMES, TEAM_CLUB,
  formatScheduleDate, formatTime, gamesForTeam,
  type Division, type ScheduledGame,
} from '../lib/tournamentSchedule'

const DIVISION_STYLE: Record<Division, { badge: string, text: string, border: string }> = {
  U8: { badge: 'bg-green-600 text-white', text: 'text-green-400', border: 'border-green-600/40' },
  U10: { badge: 'bg-blue-600 text-white', text: 'text-blue-400', border: 'border-blue-600/40' },
  U12: { badge: 'bg-orange-500 text-black', text: 'text-orange-400', border: 'border-orange-500/40' },
}

const DivisionBadge = ({ division }: { division: Division }) => (
  <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${DIVISION_STYLE[division].badge}`}>{division}</span>
)

interface Selected { division: Division, team: string }

interface Props {
  venue?: string | null
  /** Show the print button (admin and the standalone schedule page). */
  allowPrint?: boolean
}

export default function TournamentSchedule({ venue, allowPrint = true }: Props) {
  const [selected, setSelected] = useState<Selected | null>(null)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    if (!printing) return
    document.body.classList.add('print-isolate')
    const timer = window.setTimeout(() => {
      window.print()
      document.body.classList.remove('print-isolate')
      setPrinting(false)
    }, 150)
    return () => {
      window.clearTimeout(timer)
      document.body.classList.remove('print-isolate')
    }
  }, [printing])

  const teamGames = useMemo(() => (selected ? gamesForTeam(selected.division, selected.team) : []), [selected])
  const divisions = Object.keys(DIVISION_TEAMS) as Division[]
  const totalTeams = divisions.reduce((sum, division) => sum + DIVISION_TEAMS[division].length, 0)

  const renderGameCell = (game: ScheduledGame | undefined) => {
    if (!game) return <div className="hidden sm:block" />
    const style = DIVISION_STYLE[game.division]
    return (
      <div className={`rounded-lg border ${style.border} bg-black/40 p-2.5`}>
        <div className="flex flex-wrap items-center gap-2">
          <DivisionBadge division={game.division} />
          {game.referee && <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ref: <span className="text-gray-300">{game.referee}</span></span>}
        </div>
        {game.final ? (
          <p className={`mt-1.5 flex items-center gap-1.5 text-base font-black uppercase italic ${style.text}`}><Trophy size={15} /> Championship</p>
        ) : (
          <p className="mt-1.5 text-sm font-black text-white">{game.home}</p>
        )}
        <p className="text-xs text-gray-400">{game.final ? 'Finalists TBD' : `vs ${game.away}`}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Game-day schedule</p>
          <h2 className="mt-1 text-2xl font-black uppercase italic text-white sm:text-3xl">{formatScheduleDate()}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
            <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-[#EF4444]" /> First kickoff 9:00 AM</span>
            {venue && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-[#EF4444]" /> {venue}</span>}
            <span className="inline-flex items-center gap-1.5"><Users size={14} className="text-[#EF4444]" /> {totalTeams} teams · {GAMES.length} games</span>
          </p>
        </div>
        {allowPrint && (
          <button onClick={() => setPrinting(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:text-white">
            <Printer size={14} /> Print schedule
          </button>
        )}
      </div>

      {/* Team list - tap a team to see just its games */}
      <div>
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Teams — tap one to see only its games</p>
        <div className="grid gap-3 md:grid-cols-3">
          {divisions.map((division) => (
            <div key={division} className={`rounded-2xl border ${DIVISION_STYLE[division].border} bg-neutral-900 p-4`}>
              <div className="flex items-center justify-between">
                <DivisionBadge division={division} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{DIVISION_TEAMS[division].length} teams</span>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {DIVISION_TEAMS[division].map((team) => {
                  const active = selected?.division === division && selected.team === team
                  return (
                    <button
                      key={team}
                      onClick={() => setSelected(active ? null : { division, team })}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition ${active ? 'bg-[#D4AF37] text-black' : 'bg-black text-white hover:bg-neutral-800'}`}
                    >
                      <span>{team}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${active ? 'text-black/70' : 'text-gray-500'}`}>{TEAM_CLUB[team] || ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* One team's games */}
      {selected ? (
        <div className="rounded-2xl border border-[#D4AF37]/40 bg-neutral-900">
          <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
            <p className="text-sm font-black uppercase text-white"><DivisionBadge division={selected.division} /> <span className="ml-1">{selected.team}</span> <span className="text-gray-500">— {teamGames.length} games</span></p>
            <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white"><X size={14} /> Full schedule</button>
          </div>
          <ul className="divide-y divide-gray-800">
            {teamGames.map((game) => (
              <li key={`${game.time}-${game.field}`} className="flex items-center gap-4 px-4 py-3">
                <span className="w-20 shrink-0 text-sm font-black text-white">{formatTime(game.time)}</span>
                <span className="flex-1 text-sm text-gray-200">vs <strong className="text-white">{game.home === selected.team ? game.away : game.home}</strong></span>
                <span className="shrink-0 text-right text-xs font-bold uppercase tracking-widest text-gray-400">Field {game.field}{game.referee ? <span className="block text-[10px] text-gray-500">Ref {game.referee}</span> : null}</span>
              </li>
            ))}
            {(() => {
              const final = GAMES.find((game) => game.final && game.division === selected.division)
              return final ? (
                <li className="flex items-center gap-4 bg-black/40 px-4 py-3">
                  <span className="w-20 shrink-0 text-sm font-black text-white">{formatTime(final.time)}</span>
                  <span className={`flex-1 text-sm font-black uppercase italic ${DIVISION_STYLE[selected.division].text}`}>Championship — if you finish top 2</span>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-gray-400">Field {final.field}</span>
                </li>
              ) : null
            })()}
          </ul>
        </div>
      ) : (
        FIELD_GROUPS.map((group) => {
          const times = [...new Set(GAMES.filter((game) => group.fields.includes(game.field)).map((game) => game.time))].sort()
          return (
            <div key={group.title} className="overflow-hidden rounded-2xl border border-gray-800 bg-neutral-900">
              <h3 className="border-b border-gray-800 bg-neutral-950 px-4 py-3 text-sm font-black uppercase tracking-widest text-white">{group.title}</h3>
              {group.fields.length > 1 && (
                <div className="hidden grid-cols-[6rem_1fr_1fr] gap-3 border-b border-gray-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 sm:grid">
                  <span>Time</span>
                  {group.fields.map((field) => <span key={field}>Field {field}</span>)}
                </div>
              )}
              <div className="divide-y divide-gray-800">
                {times.map((time) => (
                  <div key={time} className={`grid gap-2 px-4 py-3 ${group.fields.length > 1 ? 'grid-cols-[4.75rem_1fr_1fr] sm:grid-cols-[6rem_1fr_1fr] sm:gap-3' : 'grid-cols-[4.75rem_1fr] sm:grid-cols-[6rem_1fr]'}`}>
                    <span className="pt-2 text-sm font-black text-white">{formatTime(time)}</span>
                    {group.fields.map((field) => (
                      <div key={field}>{renderGameCell(GAMES.find((game) => game.time === time && game.field === field))}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}

      <ul className="rounded-2xl border border-gray-800 bg-neutral-950 p-4 text-sm text-gray-400">
        {FORMAT_NOTES.map((note) => <li key={note} className="py-0.5">• {note}</li>)}
      </ul>

      {/* Print version: plain black-on-white tables, rendered outside the app */}
      {printing && createPortal(
        <div className="print-area print-portal">
          <section className="print-page">
            <header className="print-header">
              <div>
                <h1>Tournament Schedule</h1>
                <p>{formatScheduleDate()}{venue ? ` · ${venue}` : ''}</p>
              </div>
              <img src="/logo.png" alt="" className="print-logo" />
            </header>
            {FIELD_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="print-strong" style={{ margin: '10px 0 4px', textTransform: 'uppercase' }}>{group.title}</p>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '11%' }}>Time</th>
                      <th style={{ width: '8%' }}>Field</th>
                      <th style={{ width: '8%' }}>Age</th>
                      <th>Game</th>
                      <th style={{ width: '14%' }}>Referee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GAMES.filter((game) => group.fields.includes(game.field))
                      .sort((a, b) => a.time.localeCompare(b.time) || a.field - b.field)
                      .map((game) => (
                        <tr key={`${game.time}-${game.field}`}>
                          <td className="print-strong">{formatTime(game.time)}</td>
                          <td>{game.field}</td>
                          <td>{game.division}</td>
                          <td className={game.final ? 'print-strong' : ''}>{game.final ? 'CHAMPIONSHIP — finalists TBD' : `${game.home} vs ${game.away}`}</td>
                          <td>{game.referee || ''}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))}
            <p className="print-foot">
              Teams — {divisions.map((division) => `${division}: ${DIVISION_TEAMS[division].join(', ')}`).join('  ·  ')}
            </p>
            <p className="print-foot">{FORMAT_NOTES.join(' ')}</p>
          </section>
        </div>,
        document.body,
      )}
    </div>
  )
}
