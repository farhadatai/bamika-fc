// Youth soccer formation data.
//
// Game formats follow the U.S. Soccer Player Development Initiatives (mandated
// 2017): 4v4 at 6U-8U (no goalkeeper), 7v7 at 9U-10U (build-out line, offside
// introduced), 9v9 at 11U-12U, and 11v11 from 13U up. 5v5 is included because
// some local leagues and indoor/futsal events use it.
//
// Slot coordinates are percentages of the pitch with the team's own goal at the
// bottom (y=0) attacking upward (y=100), which matches how the board renders
// and prints in portrait.

export interface PositionInfo {
  code: string;
  name: string;
  group: 'Goalkeeper' | 'Defense' | 'Midfield' | 'Attack';
  summary: string;
  keySkills: string[];
}

export const POSITION_INFO: Record<string, PositionInfo> = {
  GK: {
    code: 'GK',
    name: 'Goalkeeper',
    group: 'Goalkeeper',
    summary: 'Last line of defense and the first line of attack. Organizes the back line and starts play from the back.',
    keySkills: ['Shot stopping', 'Catching and handling', 'Distribution with both feet', 'Loud, clear communication'],
  },
  SW: {
    code: 'SW',
    name: 'Sweeper',
    group: 'Defense',
    summary: 'Free defender behind the back line who cleans up balls played in behind.',
    keySkills: ['Reading the game', 'Recovery speed', 'Clearing under pressure'],
  },
  CB: {
    code: 'CB',
    name: 'Center Back',
    group: 'Defense',
    summary: 'Central defender who wins first contact, protects the middle, and starts possession calmly.',
    keySkills: ['1v1 defending', 'Heading', 'Body positioning and jockeying', 'Short passing under pressure'],
  },
  LB: {
    code: 'LB',
    name: 'Left Back',
    group: 'Defense',
    summary: 'Wide defender on the left who defends the flank and provides width when the team has the ball.',
    keySkills: ['1v1 defending', 'Overlapping runs', 'Crossing', 'Recovery running'],
  },
  RB: {
    code: 'RB',
    name: 'Right Back',
    group: 'Defense',
    summary: 'Wide defender on the right who defends the flank and provides width when the team has the ball.',
    keySkills: ['1v1 defending', 'Overlapping runs', 'Crossing', 'Recovery running'],
  },
  LWB: {
    code: 'LWB',
    name: 'Left Wing Back',
    group: 'Defense',
    summary: 'Attacking wide defender who covers the whole left touchline.',
    keySkills: ['Stamina', 'Crossing', 'Defending in space'],
  },
  RWB: {
    code: 'RWB',
    name: 'Right Wing Back',
    group: 'Defense',
    summary: 'Attacking wide defender who covers the whole right touchline.',
    keySkills: ['Stamina', 'Crossing', 'Defending in space'],
  },
  D: {
    code: 'D',
    name: 'Defender',
    group: 'Defense',
    summary: 'Stays closest to our goal, wins the ball back, and passes it out to a teammate.',
    keySkills: ['Staying goal-side', 'Clearing the ball wide', 'Talking to the keeper'],
  },
  CDM: {
    code: 'CDM',
    name: 'Defensive Midfielder',
    group: 'Midfield',
    summary: 'Shields the back line, intercepts passes, and keeps possession simple.',
    keySkills: ['Screening passing lanes', 'Interceptions', 'One and two touch passing', 'Scanning before receiving'],
  },
  CM: {
    code: 'CM',
    name: 'Center Midfielder',
    group: 'Midfield',
    summary: 'Engine of the team, linking defense to attack and covering ground both ways.',
    keySkills: ['Passing range', 'Scanning and awareness', 'Box-to-box work rate', 'Receiving on the half turn'],
  },
  CAM: {
    code: 'CAM',
    name: 'Attacking Midfielder',
    group: 'Midfield',
    summary: 'Creator between midfield and attack who finds the final pass.',
    keySkills: ['Playing between the lines', 'Through balls', 'Shooting from distance', 'Quick turns'],
  },
  LM: {
    code: 'LM',
    name: 'Left Midfielder',
    group: 'Midfield',
    summary: 'Wide midfielder who stretches the field on the left and tracks back to help the defender.',
    keySkills: ['Width and touchline discipline', 'Crossing', 'Tracking back', 'Beating a defender 1v1'],
  },
  RM: {
    code: 'RM',
    name: 'Right Midfielder',
    group: 'Midfield',
    summary: 'Wide midfielder who stretches the field on the right and tracks back to help the defender.',
    keySkills: ['Width and touchline discipline', 'Crossing', 'Tracking back', 'Beating a defender 1v1'],
  },
  M: {
    code: 'M',
    name: 'Midfielder',
    group: 'Midfield',
    summary: 'Connects defense and attack, supports both ends of the field.',
    keySkills: ['Support angles', 'First touch away from pressure', 'Work rate'],
  },
  LW: {
    code: 'LW',
    name: 'Left Winger',
    group: 'Attack',
    summary: 'Wide attacker who takes defenders on and gets in behind the back line.',
    keySkills: ['1v1 dribbling', 'Pace in behind', 'Cutting inside to shoot', 'Crossing early'],
  },
  RW: {
    code: 'RW',
    name: 'Right Winger',
    group: 'Attack',
    summary: 'Wide attacker who takes defenders on and gets in behind the back line.',
    keySkills: ['1v1 dribbling', 'Pace in behind', 'Cutting inside to shoot', 'Crossing early'],
  },
  ST: {
    code: 'ST',
    name: 'Striker',
    group: 'Attack',
    summary: 'Main goal threat who leads the press and finishes chances.',
    keySkills: ['Finishing with both feet', 'Movement across the last defender', 'Hold-up play', 'First defender when pressing'],
  },
  CF: {
    code: 'CF',
    name: 'Center Forward',
    group: 'Attack',
    summary: 'Front player who links play and gets into scoring positions.',
    keySkills: ['Back-to-goal play', 'Combination play', 'Finishing'],
  },
  F: {
    code: 'F',
    name: 'Forward',
    group: 'Attack',
    summary: 'Plays closest to the other goal and tries to score.',
    keySkills: ['Shooting', 'Running into space', 'Chasing the defender with the ball'],
  },
};

export interface FormationSlot {
  id: string;
  code: string;
  x: number;
  y: number;
}

export interface Formation {
  id: string;
  format: string;
  name: string;
  summary: string;
  slots: FormationSlot[];
}

export interface GameFormat {
  id: string;
  label: string;
  playersOnField: number;
  ageGroups: string[];
  hasGoalkeeper: boolean;
  note: string;
}

export const GAME_FORMATS: GameFormat[] = [
  {
    id: '4v4',
    label: '4v4',
    playersOnField: 4,
    ageGroups: ['U6', 'U8'],
    hasGoalkeeper: false,
    note: 'U.S. Soccer standard for 6U-8U. No goalkeeper — every player joins in attack and defense.',
  },
  {
    id: '5v5',
    label: '5v5',
    playersOnField: 5,
    ageGroups: ['U8', 'U10'],
    hasGoalkeeper: true,
    note: 'Common in indoor, futsal, and some local leagues. Goalkeeper plus four outfield players.',
  },
  {
    id: '7v7',
    label: '7v7',
    playersOnField: 7,
    ageGroups: ['U10'],
    hasGoalkeeper: true,
    note: 'U.S. Soccer standard for 9U-10U. Build-out line is used and offside is introduced.',
  },
  {
    id: '9v9',
    label: '9v9',
    playersOnField: 9,
    ageGroups: ['U12'],
    hasGoalkeeper: true,
    note: 'U.S. Soccer standard for 11U-12U. Bridges small-sided play into the full game.',
  },
  {
    id: '11v11',
    label: '11v11',
    playersOnField: 11,
    ageGroups: ['U14', 'U16'],
    hasGoalkeeper: true,
    note: 'U.S. Soccer standard from 13U up. Full field and full team shape.',
  },
];

const slot = (id: string, code: string, x: number, y: number): FormationSlot => ({ id, code, x, y });

export const FORMATIONS: Formation[] = [
  // ---------- 4v4 (no goalkeeper) ----------
  {
    id: '4v4-2-2',
    format: '4v4',
    name: '2-2',
    summary: 'Two backs and two forwards. Easiest shape for first-time players to understand.',
    slots: [
      slot('d1', 'D', 30, 25), slot('d2', 'D', 70, 25),
      slot('f1', 'F', 30, 72), slot('f2', 'F', 70, 72),
    ],
  },
  {
    id: '4v4-1-2-1',
    format: '4v4',
    name: '1-2-1 (Diamond)',
    summary: 'Diamond shape that teaches width and support angles early.',
    slots: [
      slot('d1', 'D', 50, 20),
      slot('m1', 'M', 22, 50), slot('m2', 'M', 78, 50),
      slot('f1', 'F', 50, 80),
    ],
  },

  // ---------- 5v5 ----------
  {
    id: '5v5-1-2-1',
    format: '5v5',
    name: '1-2-1 (Diamond)',
    summary: 'Balanced diamond in front of the keeper. Great for teaching support and width.',
    slots: [
      slot('gk', 'GK', 50, 6),
      slot('d1', 'D', 50, 26),
      slot('m1', 'LM', 22, 54), slot('m2', 'RM', 78, 54),
      slot('f1', 'F', 50, 82),
    ],
  },
  {
    id: '5v5-2-2',
    format: '5v5',
    name: '2-2 (Box)',
    summary: 'Two backs, two forwards. Simple and solid, with clear defensive pairs.',
    slots: [
      slot('gk', 'GK', 50, 6),
      slot('d1', 'LB', 30, 28), slot('d2', 'RB', 70, 28),
      slot('f1', 'F', 30, 74), slot('f2', 'F', 70, 74),
    ],
  },
  {
    id: '5v5-2-1-1',
    format: '5v5',
    name: '2-1-1',
    summary: 'Adds a midfield link between the backs and the forward.',
    slots: [
      slot('gk', 'GK', 50, 6),
      slot('d1', 'LB', 30, 26), slot('d2', 'RB', 70, 26),
      slot('m1', 'M', 50, 55),
      slot('f1', 'F', 50, 83),
    ],
  },

  // ---------- 7v7 (9U-10U) ----------
  {
    id: '7v7-2-3-1',
    format: '7v7',
    name: '2-3-1',
    summary: 'The most popular 7v7 shape. Overloads midfield, gives natural width, and keeps a target forward.',
    slots: [
      slot('gk', 'GK', 50, 6),
      slot('lb', 'LB', 28, 26), slot('rb', 'RB', 72, 26),
      slot('lm', 'LM', 18, 55), slot('cm', 'CM', 50, 52), slot('rm', 'RM', 82, 55),
      slot('st', 'ST', 50, 83),
    ],
  },
  {
    id: '7v7-3-2-1',
    format: '7v7',
    name: '3-2-1',
    summary: 'Extra defender for cover. Good against strong attacking opponents.',
    slots: [
      slot('gk', 'GK', 50, 6),
      slot('lb', 'LB', 22, 30), slot('cb', 'CB', 50, 26), slot('rb', 'RB', 78, 30),
      slot('lcm', 'CM', 34, 56), slot('rcm', 'CM', 66, 56),
      slot('st', 'ST', 50, 83),
    ],
  },
  {
    id: '7v7-3-1-2',
    format: '7v7',
    name: '3-1-2',
    summary: 'Solid back three with a holding midfielder and two forwards to press together.',
    slots: [
      slot('gk', 'GK', 50, 6),
      slot('lb', 'LB', 22, 30), slot('cb', 'CB', 50, 26), slot('rb', 'RB', 78, 30),
      slot('cdm', 'CDM', 50, 53),
      slot('lf', 'F', 34, 81), slot('rf', 'F', 66, 81),
    ],
  },
  {
    id: '7v7-2-1-2-1',
    format: '7v7',
    name: '2-1-2-1',
    summary: 'Staggered shape with a holding midfielder. Teaches players to play through the middle.',
    slots: [
      slot('gk', 'GK', 50, 6),
      slot('lb', 'LB', 28, 25), slot('rb', 'RB', 72, 25),
      slot('cdm', 'CDM', 50, 43),
      slot('lm', 'LM', 24, 63), slot('rm', 'RM', 76, 63),
      slot('st', 'ST', 50, 85),
    ],
  },

  // ---------- 9v9 (11U-12U) ----------
  {
    id: '9v9-3-3-2',
    format: '9v9',
    name: '3-3-2',
    summary: 'The most balanced 9v9 shape. Back three, midfield three with width, and two forwards.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lb', 'LB', 22, 28), slot('cb', 'CB', 50, 24), slot('rb', 'RB', 78, 28),
      slot('lm', 'LM', 20, 54), slot('cm', 'CM', 50, 51), slot('rm', 'RM', 80, 54),
      slot('lf', 'F', 38, 81), slot('rf', 'F', 62, 81),
    ],
  },
  {
    id: '9v9-3-2-3',
    format: '9v9',
    name: '3-2-3',
    summary: 'Attacking shape that presses high and uses three forwards to stretch the defense wide.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lb', 'LB', 22, 28), slot('cb', 'CB', 50, 24), slot('rb', 'RB', 78, 28),
      slot('lcm', 'CM', 34, 51), slot('rcm', 'CM', 66, 51),
      slot('lw', 'LW', 18, 78), slot('st', 'ST', 50, 84), slot('rw', 'RW', 82, 78),
    ],
  },
  {
    id: '9v9-2-3-3',
    format: '9v9',
    name: '2-3-3',
    summary: 'Front-foot shape for dominant teams. Midfield three supports three forwards.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lb', 'LB', 30, 24), slot('rb', 'RB', 70, 24),
      slot('lm', 'LM', 20, 52), slot('cm', 'CM', 50, 49), slot('rm', 'RM', 80, 52),
      slot('lw', 'LW', 18, 79), slot('st', 'ST', 50, 85), slot('rw', 'RW', 82, 79),
    ],
  },
  {
    id: '9v9-3-4-1',
    format: '9v9',
    name: '3-4-1',
    summary: 'Packs the midfield to control possession, with one forward holding the line.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lb', 'LB', 22, 28), slot('cb', 'CB', 50, 24), slot('rb', 'RB', 78, 28),
      slot('lm', 'LM', 16, 53), slot('lcm', 'CM', 39, 51), slot('rcm', 'CM', 61, 51), slot('rm', 'RM', 84, 53),
      slot('st', 'ST', 50, 82),
    ],
  },

  // ---------- 11v11 (13U+) ----------
  {
    id: '11v11-4-4-2',
    format: '11v11',
    name: '4-4-2',
    summary: 'Classic balanced shape with two banks of four. Easy for players to learn their zone.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lb', 'LB', 14, 26), slot('lcb', 'CB', 38, 22), slot('rcb', 'CB', 62, 22), slot('rb', 'RB', 86, 26),
      slot('lm', 'LM', 14, 51), slot('lcm', 'CM', 38, 48), slot('rcm', 'CM', 62, 48), slot('rm', 'RM', 86, 51),
      slot('lst', 'ST', 40, 81), slot('rst', 'ST', 60, 81),
    ],
  },
  {
    id: '11v11-4-3-3',
    format: '11v11',
    name: '4-3-3',
    summary: 'Possession shape with a midfield triangle and wide forwards attacking 1v1.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lb', 'LB', 14, 26), slot('lcb', 'CB', 38, 22), slot('rcb', 'CB', 62, 22), slot('rb', 'RB', 86, 26),
      slot('cdm', 'CDM', 50, 42), slot('lcm', 'CM', 32, 54), slot('rcm', 'CM', 68, 54),
      slot('lw', 'LW', 16, 77), slot('st', 'ST', 50, 84), slot('rw', 'RW', 84, 77),
    ],
  },
  {
    id: '11v11-4-2-3-1',
    format: '11v11',
    name: '4-2-3-1',
    summary: 'Two holding midfielders protect the back four while three creators support one striker.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lb', 'LB', 14, 26), slot('lcb', 'CB', 38, 22), slot('rcb', 'CB', 62, 22), slot('rb', 'RB', 86, 26),
      slot('ldm', 'CDM', 38, 40), slot('rdm', 'CDM', 62, 40),
      slot('lam', 'LM', 18, 63), slot('cam', 'CAM', 50, 60), slot('ram', 'RM', 82, 63),
      slot('st', 'ST', 50, 85),
    ],
  },
  {
    id: '11v11-4-1-4-1',
    format: '11v11',
    name: '4-1-4-1',
    summary: 'Compact defensive block with a single pivot. Hard to play through.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lb', 'LB', 14, 26), slot('lcb', 'CB', 38, 22), slot('rcb', 'CB', 62, 22), slot('rb', 'RB', 86, 26),
      slot('cdm', 'CDM', 50, 38),
      slot('lm', 'LM', 14, 58), slot('lcm', 'CM', 38, 56), slot('rcm', 'CM', 62, 56), slot('rm', 'RM', 86, 58),
      slot('st', 'ST', 50, 83),
    ],
  },
  {
    id: '11v11-3-5-2',
    format: '11v11',
    name: '3-5-2',
    summary: 'Wing backs provide all the width so the midfield can outnumber the opponent centrally.',
    slots: [
      slot('gk', 'GK', 50, 5),
      slot('lcb', 'CB', 28, 24), slot('cb', 'CB', 50, 21), slot('rcb', 'CB', 72, 24),
      slot('lwb', 'LWB', 10, 49), slot('lcm', 'CM', 34, 48), slot('cm', 'CM', 50, 44), slot('rcm', 'CM', 66, 48), slot('rwb', 'RWB', 90, 49),
      slot('lst', 'ST', 40, 81), slot('rst', 'ST', 60, 81),
    ],
  },
];

// Position choices for the roster dropdowns. The first five values are the
// originals, kept verbatim so existing player records stay valid; the rest add
// the specific roles used by the formation board.
export const PLAYER_POSITION_OPTIONS: Array<{ group: string; options: string[] }> = [
  { group: 'General', options: ['TBD', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward'] },
  { group: 'Defense', options: ['Center Back', 'Left Back', 'Right Back', 'Wing Back', 'Sweeper'] },
  { group: 'Midfield', options: ['Defensive Midfielder', 'Center Midfielder', 'Attacking Midfielder', 'Left Midfielder', 'Right Midfielder'] },
  { group: 'Attack', options: ['Left Winger', 'Right Winger', 'Striker', 'Center Forward'] },
];

export const ALL_PLAYER_POSITIONS = PLAYER_POSITION_OPTIONS.flatMap((entry) => entry.options);

// Maps a roster position label to the formation slot codes it can fill, so the
// lineup builder can suggest players who already play that role.
export const POSITION_LABEL_TO_CODES: Record<string, string[]> = {
  Goalkeeper: ['GK'],
  Defender: ['CB', 'LB', 'RB', 'LWB', 'RWB', 'SW', 'D'],
  'Center Back': ['CB', 'D'],
  'Left Back': ['LB', 'LWB', 'D'],
  'Right Back': ['RB', 'RWB', 'D'],
  'Wing Back': ['LWB', 'RWB', 'LB', 'RB'],
  Sweeper: ['SW', 'CB'],
  Midfielder: ['CM', 'CDM', 'CAM', 'LM', 'RM', 'M'],
  'Defensive Midfielder': ['CDM', 'CM', 'M'],
  'Center Midfielder': ['CM', 'CDM', 'CAM', 'M'],
  'Attacking Midfielder': ['CAM', 'CM', 'M'],
  'Left Midfielder': ['LM', 'LW', 'M'],
  'Right Midfielder': ['RM', 'RW', 'M'],
  Forward: ['ST', 'CF', 'LW', 'RW', 'F'],
  'Left Winger': ['LW', 'LM', 'F'],
  'Right Winger': ['RW', 'RM', 'F'],
  Striker: ['ST', 'CF', 'F'],
  'Center Forward': ['CF', 'ST', 'F'],
};

export const TEAM_COLORS = [
  { id: 'red', label: 'Red', hex: '#EF4444', text: '#FFFFFF' },
  { id: 'gold', label: 'Gold', hex: '#D4AF37', text: '#000000' },
  { id: 'green', label: 'Green', hex: '#22C55E', text: '#000000' },
  { id: 'blue', label: 'Blue', hex: '#3B82F6', text: '#FFFFFF' },
  { id: 'yellow', label: 'Yellow', hex: '#FACC15', text: '#000000' },
  { id: 'orange', label: 'Orange', hex: '#F97316', text: '#000000' },
  { id: 'purple', label: 'Purple', hex: '#A855F7', text: '#FFFFFF' },
  { id: 'black', label: 'Black', hex: '#171717', text: '#FFFFFF' },
  { id: 'white', label: 'White', hex: '#F5F5F5', text: '#000000' },
];

export const getTeamColor = (id?: string | null) =>
  TEAM_COLORS.find((color) => color.id === id) || TEAM_COLORS[0];

export const getFormation = (id?: string | null) =>
  FORMATIONS.find((formation) => formation.id === id);

export const formationsForFormat = (formatId: string) =>
  FORMATIONS.filter((formation) => formation.format === formatId);

export const getFormat = (id?: string | null) =>
  GAME_FORMATS.find((format) => format.id === id);

// "U12 A" / "u12-b" -> "U12". Returns '' when no age marker is present.
export const ageGroupFromTeamName = (teamName?: string | null) => {
  const match = /u\s*-?\s*(\d{1,2})/i.exec(String(teamName || ''));
  return match ? `U${match[1]}` : '';
};

export const ageFromDateOfBirth = (dateOfBirth?: string | null) => {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};

// Falls back to the player's birth date when no team age marker is available,
// bucketing into the club's even-numbered age groups (U6/U8/U10/U12/U14/U16).
export const ageGroupForPlayer = (player: { team_assigned?: string | null; date_of_birth?: string | null }) => {
  const fromTeam = ageGroupFromTeamName(player.team_assigned);
  if (fromTeam) return fromTeam;

  const age = ageFromDateOfBirth(player.date_of_birth);
  if (age === null) return 'Unassigned';

  for (const bracket of [6, 8, 10, 12, 14, 16]) {
    if (age <= bracket) return `U${bracket}`;
  }
  return 'U18';
};

export const recommendedFormatForAgeGroup = (ageGroup?: string | null) => {
  const match = /U(\d{1,2})/i.exec(String(ageGroup || ''));
  const age = match ? Number(match[1]) : null;
  if (age === null) return '7v7';
  if (age <= 8) return '4v4';
  if (age <= 10) return '7v7';
  if (age <= 12) return '9v9';
  return '11v11';
};

// Sorts age-group labels youngest first, with Unassigned last.
export const compareAgeGroups = (a: string, b: string) => {
  const value = (label: string) => {
    const match = /U(\d{1,2})/i.exec(label);
    return match ? Number(match[1]) : 999;
  };
  return value(a) - value(b) || a.localeCompare(b);
};
