import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader, Search, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// "Add from club roster" popup for coaches: every registered player, one tap
// to put them on the coach's team. New signups start Unassigned (automatic
// placement is off) and are flagged NEW for 3 days.

interface DirectoryPlayer {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string | null;
  status: string;
  payment_status: string;
  team_assigned: string;
  team_coach?: string | null;
  created_at?: string | null;
  parent_name: string;
}

interface CoachPlayerPickerProps {
  teamId: string;
  open: boolean;
  onClose: () => void;
  /** Called after a player is added or removed so the team roster reloads. */
  onChanged: () => void | Promise<void>;
  /** Opens the old "register a brand-new player + invite parent" form. */
  onRegisterNew: () => void;
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

const isNewPlayer = (player: DirectoryPlayer) =>
  Boolean(player.created_at) && Date.now() - new Date(player.created_at as string).getTime() < NEW_PLAYER_DAYS * 24 * 60 * 60 * 1000;

const isInactive = (player: DirectoryPlayer) =>
  ['inactive', 'cancelled', 'canceled', 'deleted', 'paused'].includes(String(player.status || '').toLowerCase());

export default function CoachPlayerPicker({ teamId, open, onClose, onChanged, onRegisterNew }: CoachPlayerPickerProps) {
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');

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
      if (!response.ok) throw new Error(payload.error || 'Could not load the club roster.');
      setPlayers(((payload.players || []) as DirectoryPlayer[]).filter((player) => !isInactive(player)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the club roster.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const newCount = useMemo(() => players.filter((player) => isNewPlayer(player) && player.team_assigned === 'Unassigned').length, [players]);

  // Unassigned first (new ones at the very top), then other teams, then mine.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rank = (player: DirectoryPlayer) => {
      if (player.team_assigned === teamId) return 3;
      if (player.team_assigned === 'Unassigned') return isNewPlayer(player) ? 0 : 1;
      return 2;
    };
    return players
      .filter((player) => !needle || `${playerName(player)} ${player.parent_name} ${player.team_assigned}`.toLowerCase().includes(needle))
      .sort((a, b) => rank(a) - rank(b) || playerName(a).localeCompare(playerName(b)));
  }, [players, query, teamId]);

  const move = async (player: DirectoryPlayer, action: 'claim' | 'release') => {
    setBusyId(player.id);
    setError('');
    try {
      const response = await fetch('/api/auth/coach/assign-player', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ player_id: player.id, action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not move the player.');
      setPlayers((current) => current.map((row) => (row.id === player.id ? { ...row, team_assigned: payload.team_assigned, team_coach: null } : row)));
      await onChanged();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Could not move the player.');
    } finally {
      setBusyId('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/85 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl border border-gray-800 bg-neutral-950 shadow-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-800 p-5">
          <div>
            <h2 className="text-2xl font-black uppercase italic text-white">Add players to {teamId}</h2>
            <p className="mt-1 text-sm text-gray-500">Tap <span className="font-bold text-white">Add</span> next to any registered player. {newCount > 0 ? <span className="font-bold text-[#D4AF37]">{newCount} new signup{newCount === 1 ? '' : 's'} this week still need a team.</span> : null}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-800 p-2 text-gray-500 hover:border-[#EF4444] hover:text-[#EF4444]" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="border-b border-gray-800 p-4">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by player or parent name"
              className="w-full rounded-xl border border-gray-800 bg-black py-3 pl-10 pr-3 text-base text-white placeholder:text-gray-600 focus:border-[#D4AF37] focus:outline-none"
            />
          </label>
          {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200">{error}</p>}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-10 text-gray-500"><Loader className="animate-spin" /></div>
          ) : visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">No registered player matches "{query}".</p>
          ) : (
            <ul className="divide-y divide-gray-900">
              {visible.map((player) => {
                const mine = player.team_assigned === teamId;
                const unassigned = player.team_assigned === 'Unassigned';
                const age = ageFrom(player.date_of_birth);
                const busy = busyId === player.id;
                return (
                  <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold text-white">
                        <span className="truncate">{playerName(player)}</span>
                        {isNewPlayer(player) && <span className="rounded-full bg-[#D4AF37] px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">New</span>}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {age !== null ? `${age} yrs · ` : ''}
                        {mine ? <span className="text-green-300">On your team</span> : unassigned ? <span className="text-yellow-200">No team yet</span> : <span>{player.team_assigned}{player.team_coach ? ` · Coach ${player.team_coach}` : ''}</span>}
                        {' · '}{player.parent_name}
                      </p>
                    </div>
                    {mine ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => move(player, 'release')}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-green-300 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                        title="Remove from your team"
                      >
                        {busy ? <Loader size={12} className="animate-spin" /> : <Check size={12} />} Added
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => move(player, 'claim')}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-60 ${unassigned ? 'bg-[#EF4444] hover:bg-red-700' : 'border border-gray-700 bg-black hover:border-[#D4AF37]'}`}
                        title={unassigned ? 'Add to your team' : `Move from ${player.team_assigned} to your team`}
                      >
                        {busy ? <Loader size={12} className="animate-spin" /> : <UserPlus size={12} />} {unassigned ? 'Add' : 'Move'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">Player not registered yet?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { onClose(); onRegisterNew(); }} className="rounded-lg border border-gray-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white">Register a new player</button>
            <button type="button" onClick={onClose} className="rounded-lg bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black">Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
