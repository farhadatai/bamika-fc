import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ROSTER_SORT_OPTIONS, sortRoster, type RosterSortKey } from '../lib/roster';

// Club-wide player list for staff. Backed by /api/auth/coach-player-directory,
// which deliberately returns only roster-level fields — addresses, medical
// notes and documents stay out of it.
export interface ClubPlayerSummary {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string | null;
  position?: string | null;
  status: string;
  payment_status: string;
  team_assigned: string;
  created_at?: string | null;
  parent_name: string;
}

const playerName = (player: ClubPlayerSummary) =>
  `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name || 'Bamika Player';

const registrationStatus = (player: ClubPlayerSummary) => {
  const status = String(player.status || '').toLowerCase();
  const payment = String(player.payment_status || '').toLowerCase();
  if (['inactive', 'cancelled', 'canceled', 'deleted', 'paused'].includes(status)) return 'inactive';
  if (status === 'active' || payment === 'paid' || payment === 'waived') return 'active';
  return 'pending';
};

const statusClass = (status: string) => {
  if (status === 'active') return 'border-green-500/40 bg-green-500/10 text-green-300';
  if (status === 'inactive') return 'border-gray-600/40 bg-gray-600/10 text-gray-300';
  return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200';
};

const ageFrom = (dateOfBirth?: string | null) => {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

export default function ClubRegistrationOverview() {
  const [players, setPlayers] = useState<ClubPlayerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<RosterSortKey>('name_asc');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setError('Please log in again to view club registrations.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/coach-player-directory', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        setPlayers(Array.isArray(result.players) ? result.players : []);
      } else {
        setError(result.error || 'Club registrations could not be loaded.');
      }
    } catch {
      setError('Club registrations could not be loaded.');
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = players.reduce(
    (totals, player) => {
      totals.total += 1;
      totals[registrationStatus(player) as 'active' | 'pending' | 'inactive'] += 1;
      return totals;
    },
    { total: 0, active: 0, pending: 0, inactive: 0 },
  );

  const visible = sortRoster(
    players.filter((player) => {
      const status = registrationStatus(player);
      const haystack = [playerName(player), player.parent_name, player.team_assigned, status, player.payment_status]
        .filter(Boolean).join(' ').toLowerCase();
      return (statusFilter === 'all' || status === statusFilter)
        && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
    }),
    sort,
    (player) => ({
      name: playerName(player),
      dateOfBirth: player.date_of_birth,
      team: player.team_assigned,
      position: player.position,
    }),
  );

  return (
    <section className="rounded-2xl border border-blue-500/30 bg-neutral-950 p-5 sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300">
            <Users size={13} /> Club overview
          </div>
          <h2 className="mt-2 text-xl font-black uppercase italic text-white">Every Registered Player</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Player, age, position, parent, team and status across the whole club. Addresses, medical details and
            documents stay private.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
          {visible.length} of {stats.total}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Registered', value: stats.total, color: 'text-white' },
          { label: 'Active', value: stats.active, color: 'text-green-300' },
          { label: 'Pending', value: stats.pending, color: 'text-yellow-200' },
          { label: 'Inactive', value: stats.inactive, color: 'text-gray-300' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-800 bg-black p-4">
            <div className="text-[9px] font-black uppercase tracking-widest text-gray-600">{stat.label}</div>
            <div className={`mt-2 text-2xl font-black ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_170px_190px]">
        <input
          aria-label="Search club registrations"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search player, parent, or team"
          className="input-primary"
        />
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-primary">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="inactive">Inactive</option>
        </select>
        <select aria-label="Sort club registrations" value={sort} onChange={(event) => setSort(event.target.value as RosterSortKey)} className="input-primary">
          {ROSTER_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>Sort: {option.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-4 rounded-xl border border-gray-800 bg-black p-6 text-center text-sm font-black uppercase tracking-widest text-gray-500">
          Loading club roster...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</div>
      ) : visible.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-800 bg-black p-6 text-center text-sm text-gray-500">
          No registrations match this filter.
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3 lg:hidden">
            {visible.map((player) => {
              const status = registrationStatus(player);
              return (
                <article key={player.id} className="rounded-xl border border-gray-800 bg-black p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-black uppercase italic text-white">{playerName(player)}</h3>
                      <p className="mt-1 text-xs text-gray-500">Parent: {player.parent_name}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(status)}`}>{status}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold text-gray-500">
                    <span>{player.team_assigned}</span>
                    <span>{ageFrom(player.date_of_birth) ?? '-'} yrs · {player.position || 'TBD'}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-gray-800 bg-black lg:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-gray-800 bg-neutral-950 text-[10px] font-black uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Age</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Parent</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900">
                {visible.map((player) => {
                  const status = registrationStatus(player);
                  return (
                    <tr key={player.id}>
                      <td className="px-4 py-3 font-black uppercase italic text-white">{playerName(player)}</td>
                      <td className="px-4 py-3 text-gray-400">{ageFrom(player.date_of_birth) ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-400">{player.position || 'TBD'}</td>
                      <td className="px-4 py-3 font-bold text-gray-300">{player.parent_name}</td>
                      <td className="px-4 py-3 text-gray-400">{player.team_assigned}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(status)}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
