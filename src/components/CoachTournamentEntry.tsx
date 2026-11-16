import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader, Plus, Trophy, UserPlus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Coach dashboard card: enter the coach's Bamika team(s) in the club's own
// tournament (no entry fee) and pick the tournament roster straight from the
// players already on the coach's team. Visiting clubs use /tournament/club/:token
// for the same thing; Bamika teams land in the same tables so the admin's
// tournament tab, schedule and printouts include them.

interface EntryTournament {
  name: string;
  starts_on: string;
  ends_on: string;
  venue_name: string | null;
  divisions: string[];
  roster_min: number;
  roster_max: number;
  roster_deadline: string | null;
  rosters_locked: boolean;
}

interface EntryTeam {
  id: string;
  division: string;
  team_name: string;
  group_label: string | null;
  payment_status: string;
  coach_team: string | null;
  coach_name: string | null;
  mine: boolean;
  player_count: number;
}

interface EntryRosterPlayer {
  id: string;
  team_id: string;
  full_name: string;
  date_of_birth: string;
  jersey_number: string | null;
  source_player_id: string | null;
}

interface MyPlayer {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  jersey_number: string | null;
}

interface EntriesPayload {
  tournament: EntryTournament;
  coach_team: string;
  suggested_division: string;
  max_entries: number;
  teams: EntryTeam[];
  roster: EntryRosterPlayer[];
  my_players: MyPlayer[];
}

const formatDates = (startsOn: string, endsOn: string) => {
  const fmt = (value: string, withYear: boolean) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) });
  return `${fmt(startsOn, false)} – ${fmt(endsOn, true)}`;
};

const authHeaders = async () => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please log in again.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api/tournament${path}`, { ...init, headers: { ...(await authHeaders()), ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Something went wrong.');
  return payload as T;
};

export default function CoachTournamentEntry({ teamId }: { teamId: string }) {
  const [data, setData] = useState<EntriesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEnterForm, setShowEnterForm] = useState(false);
  const [division, setDivision] = useState('');
  const [teamName, setTeamName] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickingTeamId, setPickingTeamId] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [confirmWithdrawId, setConfirmWithdrawId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await api<EntriesPayload>('/coach/entries');
      setData(payload);
      setDivision((current) => current || payload.suggested_division || payload.tournament.divisions[0] || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the tournament.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const myTeams = useMemo(() => (data?.teams || []).filter((team) => team.mine), [data]);
  const otherTeams = useMemo(() => (data?.teams || []).filter((team) => !team.mine), [data]);

  const defaultTeamName = () => {
    const base = `Bamika FC ${teamId}`;
    if (!myTeams.some((team) => team.team_name.toLowerCase() === base.toLowerCase())) return base;
    const letter = String.fromCharCode('A'.charCodeAt(0) + myTeams.length);
    return `${base} ${letter}`;
  };

  const openEnterForm = () => {
    setTeamName(defaultTeamName());
    setShowEnterForm(true);
  };

  const enterTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = await api<{ team: EntryTeam }>('/coach/teams', { method: 'POST', body: JSON.stringify({ division, teamName }) });
      setData((current) => current && { ...current, teams: [...current.teams, payload.team] });
      setShowEnterForm(false);
      setPickingTeamId(payload.team.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not enter the team.');
    } finally {
      setSaving(false);
    }
  };

  const addPlayer = async (team: EntryTeam, player: MyPlayer) => {
    setBusyKey(`${team.id}:${player.id}`);
    setError('');
    try {
      const payload = await api<{ player: EntryRosterPlayer }>(`/coach/teams/${team.id}/players`, { method: 'POST', body: JSON.stringify({ player_id: player.id }) });
      setData((current) => current && {
        ...current,
        roster: [...current.roster, payload.player],
        teams: current.teams.map((row) => (row.id === team.id ? { ...row, player_count: row.player_count + 1 } : row)),
      });
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add the player.');
    } finally {
      setBusyKey('');
    }
  };

  const removePlayer = async (team: EntryTeam, rosterPlayer: EntryRosterPlayer) => {
    setBusyKey(`${team.id}:${rosterPlayer.source_player_id || rosterPlayer.id}`);
    setError('');
    try {
      await api(`/coach/teams/${team.id}/players/${rosterPlayer.id}`, { method: 'DELETE' });
      setData((current) => current && {
        ...current,
        roster: current.roster.filter((row) => row.id !== rosterPlayer.id),
        teams: current.teams.map((row) => (row.id === team.id ? { ...row, player_count: Math.max(0, row.player_count - 1) } : row)),
      });
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove the player.');
    } finally {
      setBusyKey('');
    }
  };

  const withdrawTeam = async (team: EntryTeam) => {
    setBusyKey(`withdraw:${team.id}`);
    setError('');
    try {
      await api(`/coach/teams/${team.id}`, { method: 'DELETE' });
      setData((current) => current && {
        ...current,
        teams: current.teams.filter((row) => row.id !== team.id),
        roster: current.roster.filter((row) => row.team_id !== team.id),
      });
      setConfirmWithdrawId('');
      if (pickingTeamId === team.id) setPickingTeamId('');
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Could not withdraw the team.');
    } finally {
      setBusyKey('');
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
        <div className="flex items-center gap-3 text-gray-500"><Loader size={16} className="animate-spin" /> Loading tournament…</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-2xl border border-gray-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-black uppercase italic text-white">Tournament</h2>
        <p className="mt-2 text-sm text-red-300">{error || 'The tournament is not available right now.'}</p>
      </section>
    );
  }

  const { tournament } = data;
  const locked = tournament.rosters_locked;
  const canAddTeam = !locked && myTeams.length < data.max_entries;

  return (
    <section className="rounded-2xl border border-[#D4AF37]/30 bg-neutral-900 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37]"><Trophy size={13} /> Our tournament</p>
          <h2 className="mt-1 text-lg font-black uppercase italic text-white sm:text-xl">{tournament.name}</h2>
          <p className="text-xs text-gray-500">
            {formatDates(tournament.starts_on, tournament.ends_on)}{tournament.venue_name ? ` · ${tournament.venue_name}` : ''} · No entry fee for Bamika teams
          </p>
        </div>
        {canAddTeam && !showEnterForm && (
          <button
            type="button"
            onClick={openEnterForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#D4AF37] px-4 py-3 text-xs font-black uppercase tracking-widest text-black hover:bg-yellow-400 sm:py-2"
          >
            <Plus size={15} /> {myTeams.length === 0 ? `Enter ${teamId}` : 'Add another team'}
          </button>
        )}
      </div>

      {locked && (
        <p className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs font-bold text-yellow-100">
          Rosters are locked for the tournament. Ask the admin if something must change.
        </p>
      )}

      {error && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-200">{error}</p>}

      {showEnterForm && (
        <form onSubmit={enterTeam} className="mt-4 grid gap-3 rounded-xl border border-gray-800 bg-black p-4 sm:grid-cols-[140px_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Age group</span>
            <select value={division} onChange={(event) => setDivision(event.target.value)} className="input-primary mt-1">
              {tournament.divisions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Team name on the schedule</span>
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} required minLength={2} maxLength={80} className="input-primary mt-1" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[#D4AF37] px-4 py-3 text-xs font-black uppercase tracking-widest text-black disabled:opacity-60 sm:flex-none">
              {saving ? 'Entering…' : 'Enter team'}
            </button>
            <button type="button" onClick={() => setShowEnterForm(false)} className="rounded-lg border border-gray-700 px-3 py-3 text-xs font-black uppercase text-gray-400">Cancel</button>
          </div>
        </form>
      )}

      {myTeams.length === 0 && !showEnterForm && (
        <p className="mt-4 rounded-xl border border-dashed border-gray-800 bg-black p-4 text-sm text-gray-500">
          {teamId} is not entered yet. Tap <span className="font-bold text-white">Enter {teamId}</span>, then pick which of your players play in the tournament. You can enter an A and a B team if you have enough players.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {myTeams.map((team) => {
          const rosterPlayers = data.roster.filter((row) => row.team_id === team.id);
          const picking = pickingTeamId === team.id;
          const full = rosterPlayers.length >= tournament.roster_max;
          const short = rosterPlayers.length < tournament.roster_min;
          // Players already entered who are no longer on my Bamika team still show so they can be removed.
          const strays = rosterPlayers.filter((row) => !row.source_player_id || !data.my_players.some((player) => player.id === row.source_player_id));
          return (
            <div key={team.id} className="rounded-xl border border-gray-800 bg-black">
              <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-black uppercase italic text-white"><span className="text-[#D4AF37]">{team.division}</span> {team.team_name}</h3>
                  <p className="text-xs text-gray-500">
                    {rosterPlayers.length} of {tournament.roster_max} players
                    {short ? <span className="text-yellow-200"> · need {tournament.roster_min - rosterPlayers.length} more (minimum {tournament.roster_min})</span> : <span className="text-green-300"> · ready</span>}
                    {team.group_label ? ` · Group ${team.group_label}` : ''}
                  </p>
                </div>
                {!locked && (
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => setPickingTeamId(picking ? '' : team.id)}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[10px] font-black uppercase tracking-widest ${picking ? 'bg-white text-black' : 'bg-[#EF4444] text-white hover:bg-red-700'}`}
                    >
                      <UserPlus size={13} /> {picking ? 'Done' : 'Pick players'}
                    </button>
                    {confirmWithdrawId === team.id ? (
                      <span className="inline-flex items-center justify-center gap-1">
                        <button type="button" disabled={busyKey === `withdraw:${team.id}`} onClick={() => withdrawTeam(team)} className="rounded-lg bg-red-600 px-3 py-2.5 text-[10px] font-black uppercase text-white">Yes, withdraw</button>
                        <button type="button" onClick={() => setConfirmWithdrawId('')} className="rounded-lg border border-gray-700 px-3 py-2.5 text-[10px] font-black uppercase text-gray-400">Keep</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmWithdrawId(team.id)} className="rounded-lg border border-gray-800 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:border-red-500/50 hover:text-red-300">Withdraw</button>
                    )}
                  </div>
                )}
              </div>

              {picking ? (
                <ul className="divide-y divide-gray-900 border-t border-gray-800">
                  {data.my_players.length === 0 && <li className="px-4 py-4 text-sm text-gray-500">No players on {teamId} yet. Use Add Players on your roster first.</li>}
                  {data.my_players.map((player) => {
                    const entered = rosterPlayers.find((row) => row.source_player_id === player.id);
                    const busy = busyKey === `${team.id}:${player.id}`;
                    return (
                      <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-white">{player.full_name}</p>
                          <p className="text-xs text-gray-500">{player.date_of_birth ? new Date(`${player.date_of_birth.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No birth date on file'}{player.jersey_number && player.jersey_number !== '-' ? ` · #${player.jersey_number}` : ''}</p>
                        </div>
                        {entered ? (
                          <button type="button" disabled={busy} onClick={() => removePlayer(team, entered)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-green-300 hover:border-red-500/50 hover:text-red-300" title="Tap to take off the tournament roster">
                            {busy ? <Loader size={12} className="animate-spin" /> : <Check size={12} />} Playing
                          </button>
                        ) : (
                          <button type="button" disabled={busy || full || !player.date_of_birth} onClick={() => addPlayer(team, player)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#EF4444] px-3.5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-50" title={full ? 'Roster is full' : 'Add to the tournament roster'}>
                            {busy ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />} Add
                          </button>
                        )}
                      </li>
                    );
                  })}
                  {strays.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-white">{row.full_name}</p>
                        <p className="text-xs text-yellow-200">No longer on {teamId}</p>
                      </div>
                      <button type="button" onClick={() => removePlayer(team, row)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-700 px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-red-300"><X size={12} /> Remove</button>
                    </li>
                  ))}
                </ul>
              ) : rosterPlayers.length > 0 ? (
                <ol className="flex flex-wrap gap-1.5 border-t border-gray-800 px-4 py-3">
                  {rosterPlayers.map((row) => (
                    <li key={row.id} className="rounded-full border border-gray-800 bg-neutral-950 px-2.5 py-1 text-xs font-bold text-gray-200">
                      {row.jersey_number ? <span className="mr-1 text-[#D4AF37]">#{row.jersey_number}</span> : null}{row.full_name}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="border-t border-gray-800 px-4 py-3 text-xs text-gray-500">No players picked yet.</p>
              )}
            </div>
          );
        })}
      </div>

      {otherTeams.length > 0 && (
        <div className="mt-4 border-t border-gray-800 pt-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Other Bamika teams entered</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {otherTeams.map((team) => (
              <li key={team.id} className="rounded-full border border-gray-800 px-2.5 py-1 text-xs text-gray-400">
                <span className="text-[#D4AF37]">{team.division}</span> {team.team_name}{team.coach_name ? ` · Coach ${team.coach_name}` : ''} · {team.player_count} players
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
