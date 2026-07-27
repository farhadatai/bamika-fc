// Automatic team placement.
//
// A coach is linked to a club team through coaches.team_id, which holds one of
// the TEAM_OPTIONS labels (for example "U14 A"). A player belongs to a team
// through players.team_assigned, using the same labels. So placing a player
// with the right coach means choosing a team in the player's age bracket.

import { TEAM_OPTIONS } from './utils';
import { ageGroupFromTeamName, ageGroupForPlayer } from './formations';

export interface TeamPickContext {
  /** Team labels that currently have a coach assigned. */
  coachedTeams: Set<string>;
  /** Current number of players per team label, used to keep squads even. */
  teamCounts: Record<string, number>;
}

export const teamsInAgeGroup = (ageGroup: string) =>
  TEAM_OPTIONS.filter((team) => team !== 'Unassigned' && ageGroupFromTeamName(team) === ageGroup);

/**
 * Picks the best team for an age group: prefer teams that have a coach, and
 * among those the one with the fewest players so A/B/C squads stay balanced.
 * Returns null when the club has no team for that age group.
 */
export const pickTeamForAgeGroup = (ageGroup: string, context: TeamPickContext): string | null => {
  const candidates = teamsInAgeGroup(ageGroup);
  if (candidates.length === 0) return null;

  const coached = candidates.filter((team) => context.coachedTeams.has(team));
  const pool = coached.length > 0 ? coached : candidates;

  return pool.reduce(
    (best, team) => ((context.teamCounts[team] ?? 0) < (context.teamCounts[best] ?? 0) ? team : best),
    pool[0],
  );
};

/** Convenience wrapper for a player record that may only have a birth date. */
export const pickTeamForPlayer = (
  player: { team_assigned?: string | null; date_of_birth?: string | null },
  context: TeamPickContext,
) => {
  const ageGroup = ageGroupForPlayer({ ...player, team_assigned: null });
  if (!ageGroup || ageGroup === 'Unassigned') return null;
  return pickTeamForAgeGroup(ageGroup, context);
};

/**
 * Builds the picking context from the coaches table and the current roster.
 * Both queries are readable by admins and by the registration flow.
 */
export const buildTeamPickContext = (
  coaches: Array<{ team_id?: string | null }>,
  players: Array<{ team_assigned?: string | null }>,
): TeamPickContext => {
  const coachedTeams = new Set(
    coaches.map((coach) => (coach.team_id || '').trim()).filter(Boolean),
  );

  const teamCounts: Record<string, number> = {};
  players.forEach((player) => {
    const team = player.team_assigned || 'Unassigned';
    teamCounts[team] = (teamCounts[team] ?? 0) + 1;
  });

  return { coachedTeams, teamCounts };
};
