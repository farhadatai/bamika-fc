// Shared roster sorting used by both the admin and coach dashboards so the two
// lists behave identically.

export type RosterSortKey =
  | 'name_asc'
  | 'name_desc'
  | 'age_desc'
  | 'age_asc'
  | 'team_asc'
  | 'position_asc';

export const ROSTER_SORT_OPTIONS: Array<{ value: RosterSortKey; label: string }> = [
  { value: 'name_asc', label: 'Name A - Z' },
  { value: 'name_desc', label: 'Name Z - A' },
  { value: 'age_desc', label: 'Age: oldest first' },
  { value: 'age_asc', label: 'Age: youngest first' },
  { value: 'team_asc', label: 'Team' },
  { value: 'position_asc', label: 'Position' },
];

export interface SortablePlayer {
  name: string;
  dateOfBirth?: string | null;
  team?: string | null;
  position?: string | null;
}

const birthTime = (dateOfBirth?: string | null) => {
  if (!dateOfBirth) return null;
  const parsed = new Date(dateOfBirth).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Returns a new sorted array. Players with no date of birth always sort last in
 * the age views rather than being treated as newborns, and every sort falls
 * back to name so the order is stable.
 */
export const sortRoster = <T>(
  items: T[],
  sort: RosterSortKey,
  select: (item: T) => SortablePlayer,
): T[] => {
  const byName = (a: T, b: T) => select(a).name.localeCompare(select(b).name, undefined, { sensitivity: 'base' });

  const byAge = (a: T, b: T, oldestFirst: boolean) => {
    const timeA = birthTime(select(a).dateOfBirth);
    const timeB = birthTime(select(b).dateOfBirth);
    if (timeA === null && timeB === null) return byName(a, b);
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    // An earlier birth date means an older player.
    const difference = oldestFirst ? timeA - timeB : timeB - timeA;
    return difference || byName(a, b);
  };

  const sorted = [...items];

  switch (sort) {
    case 'name_desc':
      return sorted.sort((a, b) => byName(b, a));
    case 'age_desc':
      return sorted.sort((a, b) => byAge(a, b, true));
    case 'age_asc':
      return sorted.sort((a, b) => byAge(a, b, false));
    case 'team_asc':
      return sorted.sort((a, b) =>
        (select(a).team || 'Unassigned').localeCompare(select(b).team || 'Unassigned') || byName(a, b));
    case 'position_asc':
      return sorted.sort((a, b) =>
        (select(a).position || 'TBD').localeCompare(select(b).position || 'TBD') || byName(a, b));
    case 'name_asc':
    default:
      return sorted.sort(byName);
  }
};
