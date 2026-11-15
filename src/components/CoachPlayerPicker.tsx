import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader, Phone, Search, Sparkles, UserMinus, UserPlus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ageGroupForPlayer } from '../lib/formations';

// Every registered player in the club, for coaches. New signups start as
// "Unassigned" (automatic placement is off) and are flagged NEW for 3 days so
// coaches notice them and pull them onto their own team.

interface DirectoryPlayer {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string | null;
  position?: string | null;
  status: string;
  payment_status: string;
  team_assigned: string;
  team_coach?: string | null;
  created_at?: string | null;
  parent_name: string;
  parent_phone?: string | null;
}

interface CoachPlayerPickerProps {
  teamId: string | null;
  /** Called after a player is moved so the coach's own roster can reload. */
  onChanged: () => void | Promise<void>;
}

const NEW_PLAYER_DAYS = 3;

const playerName = (player: DirectoryPlayer) =>
  `${player.first_name || ''} ${player.last_name || ''}`.trim() || player.full_name || 'Bamika Player';

const ageFrom = (dateOfBirth?: string | null) => {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return age;
};

const isNewPlayer = (player: DirectoryPlayer) => {
  if (!player.created_at) return false;
  const created = new Date(player.created_at).getTime();
  return Date.now() - created < NEW_PLAYER_DAYS * 24 * 60 * 60 * 1000;
};

const registrationStatus = (player: DirectoryPlayer) => {
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

type Filter = 'new' | 'unassigned' | 'mine' | 'all';

export default function CoachPlayerPicker({ teamId, onChanged }: CoachPlayerPickerProps) {
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [notice, setNotice] = useState('');

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Please log in again.');
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/coach-player-directory', { headers: await authHeaders() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load the club players.');
      setPlayers((payload.players || []) as DirectoryPlayer[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the club players.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const newPlayers = useMemo(() => players.filter((player) => isNewPlayer(player) && registrationStatus(player) !== 'inactive'), [players]);
  const unassignedCount = useMemo(() => players.filter((player) => player.team_assigned === 'Unassigned' && registrationStatus(player) !== 'inactive').length, [players]);

  // Default to the NEW list when there are new signups, otherwise Unassigned.
  useEffect(() => {
    if (loading) return;
    setFilter(newPlayers.length > 0 ? 'new' : unassignedCount > 0 ? 'unassigned' : 'all');
  }, [loading, newPlayers.length, unassignedCount]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return players
      .filter((player) => {
        if (filter === 'new') return isNewPlayer(player);
        if (filter === 'unassigned') return player.team_assigned === 'Unassigned';
        if (filter === 'mine') return Boolean(teamId) && player.team_assigned === teamId;
        return true;
      })
      .filter((player) => registrationStatus(player) !== 'inactive' || filter === 'all')
      .filter((player) => !needle || `${playerName(player)} ${player.parent_name} ${player.team_assigned}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aNew = isNewPlayer(a) ? 0 : 1;
        const bNew = isNewPlayer(b) ? 0 : 1;
        if (aNew !== bNew) return aNew - bNew;
        return playerName(a).localeCompare(playerName(b));
      });
  }, [players, filter, query, teamId]);

  const move = async (player: DirectoryPlayer, action: 'claim' | 'release') => {
    setBusyId(player.id);
    setConfirmId('');
    setError('');
    try {
      const response = await fetch('/api/auth/coach/assign-player', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ player_id: player.id, action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not move the player.');
      setPlayers((current) => current.map((row) => (row.id === player.id
        ? { ...row, team_assigned: payload.team_assigned, team_coach: action === 'claim' ? 'You' : null }
        : row)));
      setNotice(payload.message || 'Saved.');
      await onChanged();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Could not move the player.');
    } finally {
      setBusyId('');
    }
  };

  const filters: Array<[Filter, string, number | null]> = [
    ['new', `New (${NEW_PLAYER_DAYS} days)`, newPlayers.length],
    ['unassigned', 'Unassigned', unassignedCount],
    ['mine', 'My team', teamId ? players.filter((player) => player.team_assigned === teamId).length : 0],
    ['all', 'All players', players.length],
  ];

  return (
    <section className="rounded-2xl border border-gray-800 bg-neutral-950">
      <div className="flex flex-col gap-3 border-b border-gray-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]"><Users size={12} /> Club players</div>
          <h2 className="mt-1 text-lg font-black uppercase italic text-white">Pick players for {teamId || 'your team'}</h2>
          <p className="mt-1 text-sm text-gray-400">
            Every registered player in the club. New signups are no longer placed automatically — add the ones that belong to you.
          </p>
        </div>
        <button type="button" onClick={() => load()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white">
          Refresh
        </button>
      </div>

      {newPlayers.length > 0 && (
        <div className="mx-5 mt-5 flex items-center gap-3 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-3 text-sm font-bold text-[#F5D97A]">
          <Sparkles size={18} className="shrink-0" />
          <span>{newPlayers.length} new player{newPlayers.length === 1 ? '' : 's'} signed up in the last {NEW_PLAYER_DAYS} days. {newPlayers.filter((player) => player.team_assigned === 'Unassigned').length} still need a team.</span>
        </div>
      )}

      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {filters.map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest ${filter === value ? 'bg-[#EF4444] text-white' : 'border border-gray-800 text-gray-400 hover:text-white'}`}
            >
              {label}{count !== null ? ` · ${count}` : ''}
            </button>
          ))}
        </div>
        <label className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search player, parent, or team"
            className="w-full rounded-lg border border-gray-800 bg-black py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-[#D4AF37] focus:outline-none"
          />
        </label>
      </div>

      {notice && <p className="mx-5 mb-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-200">{notice}</p>}
      {error && <p className="mx-5 mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200">{error}</p>}
      {!teamId && !loading && (
        <p className="mx-5 mb-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-200">
          You do not have a team assigned yet, so you can look but not add players. Ask the admin to assign your team.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center p-10 text-gray-500"><Loader className="animate-spin" /></div>
      ) : visible.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-gray-500">
          {filter === 'new' ? `No new signups in the last ${NEW_PLAYER_DAYS} days.` : filter === 'unassigned' ? 'Every player has a team.' : 'No players match.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-900 border-t border-gray-900">
          {visible.map((player) => {
            const age = ageFrom(player.date_of_birth);
            const bracket = player.date_of_birth ? ageGroupForPlayer({ date_of_birth: player.date_of_birth, team_assigned: null }) : null;
            const mine = Boolean(teamId) && player.team_assigned === teamId;
            const onAnotherCoach = !mine && player.team_assigned !== 'Unassigned' && Boolean(player.team_coach);
            const busy = busyId === player.id;
            const status = registrationStatus(player);
            return (
              <li key={player.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-white">{playerName(player)}</p>
                    {isNewPlayer(player) && <span className="rounded-full bg-[#D4AF37] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">New</span>}
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusClass(status)}`}>{status}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {age !== null ? `${age} yrs` : 'Age unknown'}{bracket && bracket !== 'Unassigned' ? ` · ${bracket} bracket` : ''}
                    {' · '}{player.team_assigned === 'Unassigned' ? <span className="text-yellow-200">Unassigned</span> : <span className={mine ? 'text-green-300' : 'text-gray-300'}>{player.team_assigned}{player.team_coach && !mine ? ` (Coach ${player.team_coach})` : ''}</span>}
                    {' · '}Parent: {player.parent_name}
                    {player.parent_phone ? <a href={`tel:${player.parent_phone}`} className="ml-2 inline-flex items-center gap-1 text-[#D4AF37] hover:underline"><Phone size={10} />{player.parent_phone}</a> : null}
                  </p>
                </div>
                {teamId && status !== 'inactive' && (
                  mine ? (
                    confirmId === player.id ? (
                      <span className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => move(player, 'release')} className="rounded-lg bg-red-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">{busy ? '…' : 'Yes, remove'}</button>
                        <button type="button" onClick={() => setConfirmId('')} className="rounded-lg border border-gray-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Keep</button>
                      </span>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => setConfirmId(player.id)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:border-red-500/50 hover:text-red-300">
                        <UserMinus size={13} /> Remove from my team
                      </button>
                    )
                  ) : onAnotherCoach && confirmId !== player.id ? (
                    <button type="button" disabled={busy} onClick={() => setConfirmId(player.id)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D4AF37]/50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37] hover:bg-[#D4AF37]/10">
                      <UserPlus size={13} /> Move to my team
                    </button>
                  ) : onAnotherCoach ? (
                    <span className="flex flex-col gap-2 sm:items-end">
                      <span className="text-xs text-yellow-200">Currently with Coach {player.team_coach} on {player.team_assigned}.</span>
                      <span className="flex gap-2">
                        <button type="button" disabled={busy} onClick={() => move(player, 'claim')} className="rounded-lg bg-[#EF4444] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">{busy ? '…' : 'Yes, move'}</button>
                        <button type="button" onClick={() => setConfirmId('')} className="rounded-lg border border-gray-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Cancel</button>
                      </span>
                    </span>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => move(player, 'claim')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#EF4444] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-60">
                      {busy ? <Loader size={13} className="animate-spin" /> : <UserPlus size={13} />} Add to my team
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
