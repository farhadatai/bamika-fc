import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid3x3, Plus, Printer, Save, Trash2, Users, X } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import SoccerField, { type FieldPlayer } from '../components/SoccerField';
import {
  FORMATIONS,
  GAME_FORMATS,
  POSITION_INFO,
  TEAM_COLORS,
  ageGroupForPlayer,
  ageFromDateOfBirth,
  compareAgeGroups,
  formationsForFormat,
  getFormat,
  getFormation,
  getTeamColor,
  recommendedFormatForAgeGroup,
} from '../lib/formations';

interface PlayerRow {
  id: string;
  full_name?: string | null;
  date_of_birth?: string | null;
  position?: string | null;
  jersey_number?: string | null;
  jersey_size?: string | null;
  team_assigned?: string | null;
  status?: string | null;
  payment_status?: string | null;
}

interface TournamentTeam {
  id: string;
  name: string;
  color?: string | null;
  age_group?: string | null;
  event_name?: string | null;
  format?: string | null;
  formation_id?: string | null;
  coach_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

interface TeamPlayerRow {
  id: string;
  team_id: string;
  player_id: string;
  slot_id?: string | null;
  is_starter?: boolean | null;
}

interface CoachRow {
  id: string;
  full_name?: string | null;
  name?: string | null;
}

const MISSING_TABLE_NOTICE =
  'Tournament teams need one database update. Open Supabase -> SQL Editor and run the file supabase/APPLY_TOURNAMENT_TEAMS.sql, then refresh this page.';

const isMissingTournamentTable = (message?: string) =>
  !!message && /tournament_teams|tournament_team_players/.test(message) && /schema cache|does not exist|not find/i.test(message);

const playerName = (player?: PlayerRow | null) => player?.full_name?.trim() || 'Unnamed Player';

const isActivePlayer = (player: PlayerRow) => {
  const status = String(player.status || '').toLowerCase();
  return !['inactive', 'deleted', 'cancelled', 'canceled'].includes(status);
};

export default function TeamBuilder() {
  const { user, userRole } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = userRole === 'admin';

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayerRow[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'lineups' | 'rosters'>('lineups');
  const [printMode, setPrintMode] = useState<'lineup' | 'roster' | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Roster print filters
  const [rosterAgeGroups, setRosterAgeGroups] = useState<string[]>([]);
  const [rosterTeamFilter, setRosterTeamFilter] = useState('all');
  const [includeContact, setIncludeContact] = useState(false);

  const [draftTeam, setDraftTeam] = useState({
    name: '',
    color: 'red',
    age_group: 'U12',
    event_name: '',
    format: '9v9',
    formation_id: '9v9-3-3-2',
    coach_id: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    const [playersResponse, coachesResponse] = await Promise.all([
      supabase.from('players').select('id, full_name, date_of_birth, position, jersey_number, jersey_size, team_assigned, status, payment_status'),
      supabase.from('coaches').select('id, full_name, name'),
    ]);

    if (playersResponse.error) {
      setError(playersResponse.error.message);
    } else {
      setPlayers((playersResponse.data || []) as PlayerRow[]);
    }

    if (!coachesResponse.error) {
      setCoaches((coachesResponse.data || []) as CoachRow[]);
    }

    const teamsResponse = await supabase
      .from('tournament_teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (teamsResponse.error) {
      if (isMissingTournamentTable(teamsResponse.error.message)) {
        setNotice(MISSING_TABLE_NOTICE);
      } else {
        setError(teamsResponse.error.message);
      }
      setTeams([]);
    } else {
      setNotice('');
      const rows = (teamsResponse.data || []) as TournamentTeam[];
      setTeams(rows);
      setSelectedTeamId((current) => current || rows[0]?.id || '');

      const linkResponse = await supabase.from('tournament_team_players').select('*');
      if (!linkResponse.error) setTeamPlayers((linkResponse.data || []) as TeamPlayerRow[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Print after the print-only markup has rendered, then restore the screen view.
  useEffect(() => {
    if (!printMode) return;
    const timer = window.setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [printMode]);

  const activePlayers = useMemo(() => players.filter(isActivePlayer), [players]);

  const ageGroups = useMemo(() => {
    const groups = new Set(activePlayers.map((player) => ageGroupForPlayer(player)));
    return [...groups].sort(compareAgeGroups);
  }, [activePlayers]);

  const clubTeams = useMemo(() => {
    const names = new Set(activePlayers.map((player) => player.team_assigned || 'Unassigned'));
    return [...names].sort();
  }, [activePlayers]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || null,
    [teams, selectedTeamId],
  );

  const formation = useMemo(() => {
    if (!selectedTeam) return null;
    return getFormation(selectedTeam.formation_id)
      || formationsForFormat(selectedTeam.format || '9v9')[0]
      || FORMATIONS[0];
  }, [selectedTeam]);

  const rosterLinks = useMemo(
    () => teamPlayers.filter((link) => link.team_id === selectedTeamId),
    [teamPlayers, selectedTeamId],
  );

  const playerById = useMemo(() => {
    const map = new Map<string, PlayerRow>();
    players.forEach((player) => map.set(player.id, player));
    return map;
  }, [players]);

  const assignments = useMemo(() => {
    const map: Record<string, FieldPlayer | undefined> = {};
    rosterLinks.forEach((link) => {
      if (!link.slot_id) return;
      const player = playerById.get(link.player_id);
      if (player) {
        map[link.slot_id] = { id: player.id, name: playerName(player), jersey_number: player.jersey_number };
      }
    });
    return map;
  }, [rosterLinks, playerById]);

  const benchPlayers = useMemo(
    () => rosterLinks.filter((link) => !link.slot_id).map((link) => playerById.get(link.player_id)).filter(Boolean) as PlayerRow[],
    [rosterLinks, playerById],
  );

  // Players eligible to be added: not already on this tournament team. Matching
  // age group first, since that is how coaches build a tournament squad.
  const availablePlayers = useMemo(() => {
    const taken = new Set(rosterLinks.map((link) => link.player_id));
    return activePlayers
      .filter((player) => !taken.has(player.id))
      .sort((a, b) => {
        const groupA = ageGroupForPlayer(a);
        const groupB = ageGroupForPlayer(b);
        const target = selectedTeam?.age_group || '';
        const matchA = groupA === target ? 0 : 1;
        const matchB = groupB === target ? 0 : 1;
        return matchA - matchB || compareAgeGroups(groupA, groupB) || playerName(a).localeCompare(playerName(b));
      });
  }, [activePlayers, rosterLinks, selectedTeam]);

  const handleCreateTeam = async () => {
    if (!draftTeam.name.trim()) {
      setError('Give the team a name first.');
      return;
    }
    setSaving(true);
    setError('');

    const { data, error: insertError } = await supabase
      .from('tournament_teams')
      .insert({
        name: draftTeam.name.trim(),
        color: draftTeam.color,
        age_group: draftTeam.age_group,
        event_name: draftTeam.event_name.trim() || null,
        format: draftTeam.format,
        formation_id: draftTeam.formation_id,
        coach_id: draftTeam.coach_id || null,
        notes: draftTeam.notes.trim() || null,
        created_by: user?.id || null,
      })
      .select('*')
      .single();

    setSaving(false);

    if (insertError) {
      setError(isMissingTournamentTable(insertError.message) ? MISSING_TABLE_NOTICE : insertError.message);
      return;
    }

    setTeams((current) => [data as TournamentTeam, ...current]);
    setSelectedTeamId((data as TournamentTeam).id);
    setShowCreate(false);
    setDraftTeam((current) => ({ ...current, name: '', event_name: '', notes: '' }));
  };

  const updateTeam = async (patch: Partial<TournamentTeam>) => {
    if (!selectedTeam) return;
    setTeams((current) => current.map((team) => (team.id === selectedTeam.id ? { ...team, ...patch } : team)));

    const { error: updateError } = await supabase
      .from('tournament_teams')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', selectedTeam.id);

    if (updateError) setError(updateError.message);
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    if (!window.confirm(`Delete "${selectedTeam.name}"? This removes the team sheet but does not affect player registrations.`)) return;

    const { error: deleteError } = await supabase.from('tournament_teams').delete().eq('id', selectedTeam.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setTeams((current) => current.filter((team) => team.id !== selectedTeam.id));
    setTeamPlayers((current) => current.filter((link) => link.team_id !== selectedTeam.id));
    setSelectedTeamId('');
  };

  const addPlayerToTeam = async (player: PlayerRow) => {
    if (!selectedTeam) return;
    const slotId = selectedSlotId && !assignments[selectedSlotId] ? selectedSlotId : null;

    const { data, error: insertError } = await supabase
      .from('tournament_team_players')
      .insert({ team_id: selectedTeam.id, player_id: player.id, slot_id: slotId, is_starter: !!slotId })
      .select('*')
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTeamPlayers((current) => [...current, data as TeamPlayerRow]);
    setSelectedSlotId(null);
  };

  const setPlayerSlot = async (playerId: string, slotId: string | null) => {
    const link = rosterLinks.find((row) => row.player_id === playerId);
    if (!link) return;

    setTeamPlayers((current) => current.map((row) => (row.id === link.id ? { ...row, slot_id: slotId, is_starter: !!slotId } : row)));

    const { error: updateError } = await supabase
      .from('tournament_team_players')
      .update({ slot_id: slotId, is_starter: !!slotId })
      .eq('id', link.id);

    if (updateError) setError(updateError.message);
  };

  const removePlayerFromTeam = async (playerId: string) => {
    const link = rosterLinks.find((row) => row.player_id === playerId);
    if (!link) return;

    setTeamPlayers((current) => current.filter((row) => row.id !== link.id));
    const { error: deleteError } = await supabase.from('tournament_team_players').delete().eq('id', link.id);
    if (deleteError) setError(deleteError.message);
  };

  const handleSlotClick = (slotId: string) => {
    const occupant = assignments[slotId];
    if (occupant) {
      // Clicking a filled slot sends that player back to the bench.
      setPlayerSlot(occupant.id, null);
      setSelectedSlotId(slotId);
      return;
    }
    setSelectedSlotId((current) => (current === slotId ? null : slotId));
  };

  // ---- Roster print data -------------------------------------------------
  const rosterGroups = useMemo(() => {
    const chosen = rosterAgeGroups.length ? rosterAgeGroups : ageGroups;
    const grouped = new Map<string, PlayerRow[]>();

    activePlayers.forEach((player) => {
      const group = ageGroupForPlayer(player);
      if (!chosen.includes(group)) return;
      if (rosterTeamFilter !== 'all' && (player.team_assigned || 'Unassigned') !== rosterTeamFilter) return;
      const list = grouped.get(group) || [];
      list.push(player);
      grouped.set(group, list);
    });

    return [...grouped.entries()]
      .sort((a, b) => compareAgeGroups(a[0], b[0]))
      .map(([group, list]) => ({
        group,
        players: list.sort((a, b) => playerName(a).localeCompare(playerName(b))),
      }));
  }, [activePlayers, ageGroups, rosterAgeGroups, rosterTeamFilter]);

  const toggleAgeGroup = (group: string) => {
    setRosterAgeGroups((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group],
    );
  };

  const coachName = (id?: string | null) => {
    const coach = coaches.find((row) => row.id === id);
    return coach?.full_name || coach?.name || '';
  };

  if (!isAdmin && userRole !== 'coach') {
    return (
      <div className="w-full py-16 text-center text-white">
        <h1 className="text-2xl font-black uppercase italic">Coaches only</h1>
        <p className="mt-3 text-sm text-gray-400">This planner is available to club coaches and admins.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-6">Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="w-full py-6 text-white">
      {/* ================= SCREEN UI ================= */}
      <div className="no-print mx-auto flex w-full max-w-7xl flex-col gap-6 px-1">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-neutral-950/80 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gray-800 bg-black px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <Grid3x3 size={14} className="text-[#EF4444]" />
              Match planning
            </div>
            <h1 className="text-3xl font-black uppercase italic leading-tight sm:text-4xl">
              Teams & <span className="text-[#D4AF37]">Lineups</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Build tournament squads by age group, place players in a formation, and print team sheets for coaches.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('lineups')}
              className={`rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest ${view === 'lineups' ? 'bg-[#EF4444] text-white' : 'border border-gray-700 text-gray-400 hover:text-white'}`}
            >
              Teams & Lineups
            </button>
            <button
              onClick={() => setView('rosters')}
              className={`rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest ${view === 'rosters' ? 'bg-[#EF4444] text-white' : 'border border-gray-700 text-gray-400 hover:text-white'}`}
            >
              Print Rosters
            </button>
          </div>
        </div>

        {notice && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            <div className="font-black uppercase tracking-widest text-yellow-300">Database update needed</div>
            <p className="mt-1">{notice}</p>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm font-bold text-red-200">{error}</div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-gray-800 bg-neutral-900 p-10 text-center text-sm font-black uppercase tracking-widest text-gray-500">
            Loading squads...
          </div>
        ) : view === 'rosters' ? (
          /* ---------------- ROSTER PRINT BUILDER ---------------- */
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-5">
              <h2 className="text-sm font-black uppercase italic">Choose what to print</h2>
              <p className="mt-1 text-xs text-gray-500">Pick one or more age groups. Each group starts on its own page.</p>

              <div className="mt-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Age groups</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setRosterAgeGroups([])}
                    className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest ${rosterAgeGroups.length === 0 ? 'bg-[#D4AF37] text-black' : 'border border-gray-700 text-gray-300 hover:text-white'}`}
                  >
                    All groups
                  </button>
                  {ageGroups.map((group) => (
                    <button
                      key={group}
                      onClick={() => toggleAgeGroup(group)}
                      className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest ${rosterAgeGroups.includes(group) ? 'bg-[#EF4444] text-white' : 'border border-gray-700 text-gray-300 hover:text-white'}`}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Club team</span>
                  <select value={rosterTeamFilter} onChange={(event) => setRosterTeamFilter(event.target.value)} className="input-primary">
                    <option value="all">All club teams</option>
                    {clubTeams.map((team) => <option key={team} value={team}>{team}</option>)}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-3">
                  <input type="checkbox" checked={includeContact} onChange={(event) => setIncludeContact(event.target.checked)} className="h-4 w-4" />
                  <span className="text-xs font-bold text-gray-300">Include jersey size column</span>
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button onClick={() => setPrintMode('roster')} className="inline-flex items-center gap-2 rounded-lg bg-[#EF4444] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-700">
                  <Printer size={15} /> Print Roster Sheets
                </button>
                <span className="text-xs text-gray-500">
                  {rosterGroups.reduce((total, entry) => total + entry.players.length, 0)} players across {rosterGroups.length} group(s)
                </span>
              </div>
            </div>

            {/* On-screen preview of the same content that prints */}
            <div className="flex flex-col gap-5">
              {rosterGroups.map((entry) => (
                <div key={entry.group} className="overflow-hidden rounded-2xl border border-gray-800 bg-neutral-900">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-5 py-3">
                    <h3 className="font-black uppercase italic">{entry.group}</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{entry.players.length} players</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-black text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <tr>
                          <th className="px-4 py-2">#</th>
                          <th className="px-4 py-2">Player</th>
                          <th className="px-4 py-2">Age</th>
                          <th className="px-4 py-2">Position</th>
                          <th className="px-4 py-2">Club Team</th>
                          {includeContact && <th className="px-4 py-2">Jersey</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {entry.players.map((player) => (
                          <tr key={player.id}>
                            <td className="px-4 py-2 font-black text-[#D4AF37]">{player.jersey_number && player.jersey_number !== '-' ? player.jersey_number : '—'}</td>
                            <td className="px-4 py-2 font-bold text-white">{playerName(player)}</td>
                            <td className="px-4 py-2 text-gray-400">{ageFromDateOfBirth(player.date_of_birth) ?? '—'}</td>
                            <td className="px-4 py-2 text-gray-400">{player.position || 'TBD'}</td>
                            <td className="px-4 py-2 text-gray-400">{player.team_assigned || 'Unassigned'}</td>
                            {includeContact && <td className="px-4 py-2 text-gray-400">{player.jersey_size || '—'}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ---------------- TEAMS & LINEUPS ---------------- */
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-800 bg-neutral-950 p-3">
              {teams.map((team) => {
                const color = getTeamColor(team.color);
                return (
                  <button
                    key={team.id}
                    onClick={() => { setSelectedTeamId(team.id); setSelectedSlotId(null); }}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition ${selectedTeamId === team.id ? 'bg-neutral-800 text-white ring-1 ring-white/30' : 'text-gray-400 hover:text-white'}`}
                  >
                    <span className="h-3 w-3 rounded-full border border-white/40" style={{ backgroundColor: color.hex }} />
                    {team.name}
                  </button>
                );
              })}
              <button
                onClick={() => setShowCreate((current) => !current)}
                disabled={!!notice}
                className="ml-auto inline-flex items-center gap-2 rounded-xl border border-gray-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-300 hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={14} /> New Team
              </button>
            </div>

            {showCreate && (
              <div className="rounded-2xl border border-[#D4AF37]/40 bg-neutral-950 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase italic">Create tournament team</h2>
                  <X className="cursor-pointer text-gray-500 hover:text-white" size={18} onClick={() => setShowCreate(false)} />
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Team name</span>
                    <input value={draftTeam.name} onChange={(e) => setDraftTeam({ ...draftTeam, name: e.target.value })} placeholder="Bamika Red" className="input-primary" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Tournament / event</span>
                    <input value={draftTeam.event_name} onChange={(e) => setDraftTeam({ ...draftTeam, event_name: e.target.value })} placeholder="Elk Grove Fall Cup" className="input-primary" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Age group</span>
                    <select
                      value={draftTeam.age_group}
                      onChange={(e) => {
                        const nextFormat = recommendedFormatForAgeGroup(e.target.value);
                        setDraftTeam({
                          ...draftTeam,
                          age_group: e.target.value,
                          format: nextFormat,
                          formation_id: formationsForFormat(nextFormat)[0]?.id || '',
                        });
                      }}
                      className="input-primary"
                    >
                      {['U6', 'U8', 'U10', 'U12', 'U14', 'U16'].map((group) => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Team color</span>
                    <select value={draftTeam.color} onChange={(e) => setDraftTeam({ ...draftTeam, color: e.target.value })} className="input-primary">
                      {TEAM_COLORS.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Format</span>
                    <select
                      value={draftTeam.format}
                      onChange={(e) => setDraftTeam({ ...draftTeam, format: e.target.value, formation_id: formationsForFormat(e.target.value)[0]?.id || '' })}
                      className="input-primary"
                    >
                      {GAME_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Formation</span>
                    <select value={draftTeam.formation_id} onChange={(e) => setDraftTeam({ ...draftTeam, formation_id: e.target.value })} className="input-primary">
                      {formationsForFormat(draftTeam.format).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  {isAdmin && (
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Assign coach</span>
                      <select value={draftTeam.coach_id} onChange={(e) => setDraftTeam({ ...draftTeam, coach_id: e.target.value })} className="input-primary">
                        <option value="">Unassigned</option>
                        {coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.full_name || coach.name || 'Coach'}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                <button onClick={handleCreateTeam} disabled={saving} className="btn-primary mt-4 inline-flex items-center gap-2">
                  <Save size={15} /> {saving ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            )}

            {!selectedTeam ? (
              <div className="rounded-2xl border border-dashed border-gray-800 bg-black p-10 text-center">
                <Users className="mx-auto text-[#EF4444]" size={36} />
                <h3 className="mt-4 text-lg font-black uppercase italic">No tournament team yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                  Create a team for your event — for example "Bamika Red U12" — then add players and set their positions.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
                {/* Field + team settings */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Format</span>
                        <select
                          value={selectedTeam.format || '9v9'}
                          onChange={(e) => updateTeam({ format: e.target.value, formation_id: formationsForFormat(e.target.value)[0]?.id || null })}
                          className="input-primary"
                        >
                          {GAME_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Formation</span>
                        <select value={selectedTeam.formation_id || ''} onChange={(e) => updateTeam({ formation_id: e.target.value })} className="input-primary">
                          {formationsForFormat(selectedTeam.format || '9v9').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Color</span>
                        <select value={selectedTeam.color || 'red'} onChange={(e) => updateTeam({ color: e.target.value })} className="input-primary">
                          {TEAM_COLORS.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Event</span>
                        <input value={selectedTeam.event_name || ''} onChange={(e) => updateTeam({ event_name: e.target.value })} placeholder="Tournament name" className="input-primary" />
                      </label>
                    </div>

                    {formation && (
                      <p className="mt-3 rounded-lg border border-gray-800 bg-black p-3 text-xs leading-5 text-gray-400">
                        <span className="font-black uppercase tracking-widest text-[#D4AF37]">{formation.name}</span> — {formation.summary}
                        <br />
                        <span className="text-gray-500">{getFormat(selectedTeam.format || '')?.note}</span>
                      </p>
                    )}
                  </div>

                  {formation && (
                    <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-black uppercase italic">Starting lineup</h2>
                        <div className="flex gap-2">
                          <button onClick={() => setPrintMode('lineup')} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-[10px] font-black uppercase text-gray-300 hover:border-[#D4AF37] hover:text-[#D4AF37]">
                            <Printer size={13} /> Print Team Sheet
                          </button>
                          {(isAdmin || selectedTeam.created_by === user?.id) && (
                            <button onClick={handleDeleteTeam} className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-3 py-2 text-[10px] font-black uppercase text-red-300 hover:bg-red-500/10">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mb-3 text-xs text-gray-500">
                        {selectedSlotId ? 'Now pick a player from the list to fill that position.' : 'Tap an empty position, then pick a player. Tap a filled position to move that player back to the bench.'}
                      </p>
                      <div className="mx-auto max-w-md">
                        <SoccerField
                          formation={formation}
                          assignments={assignments}
                          colorId={selectedTeam.color}
                          selectedSlotId={selectedSlotId}
                          onSlotClick={(slot) => handleSlotClick(slot.id)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Squad management */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-4">
                    <h2 className="text-sm font-black uppercase italic">Squad ({rosterLinks.length})</h2>
                    {benchPlayers.length === 0 && rosterLinks.length === 0 ? (
                      <p className="mt-3 text-xs text-gray-500">No players added yet. Add them from the list below.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {rosterLinks.map((link) => {
                          const player = playerById.get(link.player_id);
                          if (!player) return null;
                          const slotCode = formation?.slots.find((slot) => slot.id === link.slot_id)?.code;
                          return (
                            <div key={link.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-800 bg-black p-2.5">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-white">{playerName(player)}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                                  {slotCode ? <span className="text-green-300">Starting — {slotCode}</span> : 'Substitute'}
                                  {' · '}{ageGroupForPlayer(player)}
                                </div>
                              </div>
                              <button onClick={() => removePlayerFromTeam(player.id)} className="shrink-0 rounded-lg border border-gray-700 p-1.5 text-gray-500 hover:border-red-500/50 hover:text-red-300">
                                <X size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-800 bg-neutral-950 p-4">
                    <h2 className="text-sm font-black uppercase italic">Add players</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedTeam.age_group} players are listed first.
                      {selectedSlotId ? ' Picking a player fills the selected position.' : ''}
                    </p>
                    <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                      {availablePlayers.map((player) => (
                        <button
                          key={player.id}
                          onClick={() => addPlayerToTeam(player)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-800 bg-black p-2.5 text-left hover:border-[#D4AF37]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-white">{playerName(player)}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                              {ageGroupForPlayer(player)} · {player.position || 'TBD'} · {player.team_assigned || 'Unassigned'}
                            </div>
                          </div>
                          <Plus size={15} className="shrink-0 text-gray-500" />
                        </button>
                      ))}
                      {availablePlayers.length === 0 && (
                        <p className="text-xs text-gray-500">Every active player is already on this team.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= PRINT OUTPUT ================= */}
      {printMode === 'roster' && (
        <div className="print-area">
          {rosterGroups.map((entry) => (
            <section key={entry.group} className="print-page">
              <header className="print-header">
                <div>
                  <h1>Bamika FC — {entry.group} Roster</h1>
                  <p>
                    {rosterTeamFilter === 'all' ? 'All club teams' : rosterTeamFilter}
                    {' · '}{entry.players.length} players
                    {' · '}Printed {new Date().toLocaleDateString()}
                  </p>
                </div>
                <img src="/logo.png" alt="" className="print-logo" />
              </header>
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>#</th>
                    <th style={{ width: '32%' }}>Player</th>
                    <th style={{ width: '8%' }}>Age</th>
                    <th style={{ width: '18%' }}>Position</th>
                    <th style={{ width: '22%' }}>Club Team</th>
                    {includeContact && <th style={{ width: '12%' }}>Jersey</th>}
                  </tr>
                </thead>
                <tbody>
                  {entry.players.map((player) => (
                    <tr key={player.id}>
                      <td>{player.jersey_number && player.jersey_number !== '-' ? player.jersey_number : ''}</td>
                      <td className="print-strong">{playerName(player)}</td>
                      <td>{ageFromDateOfBirth(player.date_of_birth) ?? ''}</td>
                      <td>{player.position || 'TBD'}</td>
                      <td>{player.team_assigned || 'Unassigned'}</td>
                      {includeContact && <td>{player.jersey_size || ''}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="print-foot">Coach signature: ____________________________　Date: ______________</p>
            </section>
          ))}
        </div>
      )}

      {printMode === 'lineup' && selectedTeam && formation && (
        <div className="print-area">
          <section className="print-page">
            <header className="print-header">
              <div>
                <h1>{selectedTeam.name}</h1>
                <p>
                  {[selectedTeam.event_name, selectedTeam.age_group, getFormat(selectedTeam.format || '')?.label, formation.name]
                    .filter(Boolean).join(' · ')}
                  {coachName(selectedTeam.coach_id) ? ` · Coach ${coachName(selectedTeam.coach_id)}` : ''}
                </p>
              </div>
              <img src="/logo.png" alt="" className="print-logo" />
            </header>

            <div className="print-lineup">
              <div className="print-field">
                <SoccerField formation={formation} assignments={assignments} colorId={selectedTeam.color} readOnly />
              </div>
              <div className="print-lineup-lists">
                <h2>Starting {formation.slots.length}</h2>
                <table className="print-table">
                  <thead>
                    <tr><th style={{ width: '22%' }}>Pos</th><th style={{ width: '15%' }}>#</th><th>Player</th></tr>
                  </thead>
                  <tbody>
                    {formation.slots.map((slot) => {
                      const player = assignments[slot.id];
                      return (
                        <tr key={slot.id}>
                          <td className="print-strong">{slot.code}</td>
                          <td>{player?.jersey_number && player.jersey_number !== '-' ? player.jersey_number : ''}</td>
                          <td>{player?.name || ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <h2>Substitutes ({benchPlayers.length})</h2>
                <table className="print-table">
                  <thead>
                    <tr><th style={{ width: '15%' }}>#</th><th>Player</th><th style={{ width: '30%' }}>Minutes</th></tr>
                  </thead>
                  <tbody>
                    {benchPlayers.map((player) => (
                      <tr key={player.id}>
                        <td>{player.jersey_number && player.jersey_number !== '-' ? player.jersey_number : ''}</td>
                        <td className="print-strong">{playerName(player)}</td>
                        <td></td>
                      </tr>
                    ))}
                    {benchPlayers.length === 0 && <tr><td colSpan={3}>No substitutes listed</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="print-positions">
              <h2>Position notes for this formation</h2>
              <ul>
                {[...new Set(formation.slots.map((slot) => slot.code))].map((code) => {
                  const info = POSITION_INFO[code];
                  if (!info) return null;
                  return (
                    <li key={code}>
                      <strong>{info.code} — {info.name}:</strong> {info.summary} <em>Focus: {info.keySkills.join(', ')}.</em>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
