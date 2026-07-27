import type { Formation, FormationSlot } from '../lib/formations';
import { POSITION_INFO, getTeamColor } from '../lib/formations';

export interface FieldPlayer {
  id: string;
  name: string;
  jersey_number?: string | null;
}

interface SoccerFieldProps {
  formation: Formation;
  /** slot id -> player placed in that slot */
  assignments: Record<string, FieldPlayer | undefined>;
  colorId?: string | null;
  selectedSlotId?: string | null;
  onSlotClick?: (slot: FormationSlot) => void;
  /** Print/read-only rendering: no hover affordances or empty-slot prompts. */
  readOnly?: boolean;
}

const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'FC';

export default function SoccerField({
  formation,
  assignments,
  colorId,
  selectedSlotId,
  onSlotClick,
  readOnly = false,
}: SoccerFieldProps) {
  const color = getTeamColor(colorId);

  // Inset the usable area so chips and their name labels never clip at the
  // touchlines or goal lines.
  const toLeft = (x: number) => 7 + (x / 100) * 86;
  const toTop = (y: number) => 7 + ((100 - y) / 100) * 84;

  // Busier formations get narrower chips so neighbouring players don't collide.
  const count = formation.slots.length;
  const slotWidth = count > 9 ? 19 : count > 7 ? 21 : 24;
  const badgeWidth = count > 9 ? 62 : count > 7 ? 66 : 70;

  return (
    <div className="field-wrap relative w-full overflow-hidden rounded-2xl border border-gray-800 bg-[#0d3b1e]" style={{ aspectRatio: '68 / 100' }}>
      {/* Pitch markings. viewBox matches the 0-100 slot coordinate space. */}
      <svg viewBox="0 0 68 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="field-stripes" width="68" height="12.5" patternUnits="userSpaceOnUse">
            <rect width="68" height="6.25" fill="rgba(255,255,255,0.035)" />
          </pattern>
        </defs>
        <rect width="68" height="100" fill="url(#field-stripes)" />
        <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.4">
          <rect x="2" y="2" width="64" height="96" />
          <line x1="2" y1="50" x2="66" y2="50" />
          <circle cx="34" cy="50" r="9" />
          <circle cx="34" cy="50" r="0.7" fill="rgba(255,255,255,0.55)" stroke="none" />
          {/* Own goal (bottom) */}
          <rect x="14" y="82" width="40" height="16" />
          <rect x="25" y="92" width="18" height="6" />
          <path d="M 25 82 A 9 9 0 0 0 43 82" />
          {/* Attacking goal (top) */}
          <rect x="14" y="2" width="40" height="16" />
          <rect x="25" y="2" width="18" height="6" />
          <path d="M 25 18 A 9 9 0 0 1 43 18" />
        </g>
      </svg>

      {formation.slots.map((slot) => {
        const player = assignments[slot.id];
        const position = POSITION_INFO[slot.code];
        const isSelected = selectedSlotId === slot.id;

        return (
          <button
            key={slot.id}
            type="button"
            disabled={readOnly}
            onClick={() => onSlotClick?.(slot)}
            title={position ? `${position.name} — ${position.summary}` : slot.code}
            className={`field-slot absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
            style={{ left: `${toLeft(slot.x)}%`, top: `${toTop(slot.y)}%`, width: `${slotWidth}%` }}
          >
            <span
              className={`slot-badge flex aspect-square items-center justify-center rounded-full border-2 text-[clamp(0.5rem,1.9vw,0.9rem)] font-black leading-none shadow-lg ${
                isSelected ? 'ring-4 ring-white' : ''
              }`}
              style={{
                width: `${badgeWidth}%`,
                backgroundColor: player ? color.hex : 'rgba(0,0,0,0.45)',
                color: player ? color.text : 'rgba(255,255,255,0.75)',
                borderColor: player ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
                borderStyle: player ? 'solid' : 'dashed',
              }}
            >
              {player ? (player.jersey_number && player.jersey_number !== '-' ? player.jersey_number : initialsOf(player.name)) : slot.code}
            </span>
            <span className="slot-name mt-0.5 w-full truncate rounded bg-black/70 px-1 py-0.5 text-center text-[clamp(0.4rem,1.35vw,0.62rem)] font-bold uppercase leading-tight tracking-tight text-white">
              {player ? player.name : (readOnly ? position?.name || slot.code : 'Tap to fill')}
            </span>
            <span className="slot-code text-[clamp(0.36rem,1.15vw,0.55rem)] font-black uppercase leading-tight tracking-widest text-white/80">
              {slot.code}
            </span>
          </button>
        );
      })}
    </div>
  );
}
