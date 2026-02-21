import { useMemo, useState } from 'react';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import { useUpdateSystemState } from '../../hooks/useMutations';
import { useDataPermissions } from '../../hooks/usePermissions';
import { EditButton } from '../controls/EditButton';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import { STATUS_COLORS } from './arcUtils';
import { getConfig } from '../../types';
import type { WidgetRendererProps, SystemState } from '../../types';
import type { ShieldDisplayConfig, ShieldSegment } from '../../types';
import './ShieldDisplayWidget.css';

const LABEL_FONT_SIZE = 8;

// ─── Arc geometry ──────────────────────────────────────────────────────────────

/** Convert a "clock-degrees" angle (0=top/fore, 90=right/starboard, CW) to SVG radians. */
function clockToRad(deg: number): number {
  return ((deg - 90) * Math.PI) / 180;
}

/**
 * Build an open arc stroke path.
 * All angles in clock-degrees (0=top/fore, 90=right/starboard, CW).
 * halfGap shrinks each side of the arc slightly for visual separation.
 */
function buildArcStroke(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  halfGap: number,
): string {
  const s = startDeg + halfGap;
  const e = endDeg - halfGap;
  const sweep = e - s;
  if (sweep <= 0) return '';

  const sRad = clockToRad(s);
  const eRad = clockToRad(e);
  const largeArc = sweep > 180 ? 1 : 0;

  const x1 = cx + r * Math.cos(sRad);
  const y1 = cy + r * Math.sin(sRad);
  const x2 = cx + r * Math.cos(eRad);
  const y2 = cy + r * Math.sin(eRad);

  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/**
 * Build a label arc path for use with SVG <textPath>.
 * clockwise=true for top-half arcs (readable L→R), false for bottom-half.
 */
function buildLabelArcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  halfGap: number,
  clockwise: boolean,
): string {
  const s = startDeg + halfGap;
  const e = endDeg - halfGap;
  const sweep = e - s;
  if (sweep <= 0) return '';

  const sRad = clockToRad(s);
  const eRad = clockToRad(e);
  const largeArc = sweep > 180 ? 1 : 0;

  const x1 = cx + r * Math.cos(sRad);
  const y1 = cy + r * Math.sin(sRad);
  const x2 = cx + r * Math.cos(eRad);
  const y2 = cy + r * Math.sin(eRad);

  if (clockwise) {
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }
  // Counter-clockwise: swap start/end, flip sweep flag
  return `M ${x2} ${y2} A ${r} ${r} 0 ${largeArc} 0 ${x1} ${y1}`;
}

/**
 * True if the arc's midpoint is in the top half of the circle (above center in SVG).
 * Determines clockwise (top) vs counter-clockwise (bottom) for readable textPath.
 */
function arcIsTopHalf(startDeg: number, endDeg: number): boolean {
  return Math.sin(clockToRad((startDeg + endDeg) / 2)) <= 0;
}

// ─── Segment layout ────────────────────────────────────────────────────────────

interface SegmentArc {
  startDeg: number;
  endDeg: number;
  label: string;
}

function getSegmentArcs(count: number, twoSplit: string): SegmentArc[] {
  if (count === 1) {
    return [{ startDeg: 0, endDeg: 360, label: 'All' }];
  }

  if (count === 2) {
    if (twoSplit === 'fore_aft') {
      return [
        { startDeg: -90, endDeg: 90, label: 'Fore' },
        { startDeg: 90, endDeg: 270, label: 'Aft' },
      ];
    }
    return [
      { startDeg: 0, endDeg: 180, label: 'Starboard' },
      { startDeg: 180, endDeg: 360, label: 'Port' },
    ];
  }

  if (count === 3) {
    return [
      { startDeg: -60, endDeg: 60, label: 'Fore' },
      { startDeg: 60, endDeg: 180, label: 'Stbd-Aft' },
      { startDeg: 180, endDeg: 300, label: 'Port-Aft' },
    ];
  }

  return [
    { startDeg: -90, endDeg: 0, label: 'Fore-Stbd' },
    { startDeg: 0, endDeg: 90, label: 'Aft-Stbd' },
    { startDeg: 90, endDeg: 180, label: 'Aft-Port' },
    { startDeg: 180, endDeg: 270, label: 'Fore-Port' },
  ];
}

// ─── Ship icon ─────────────────────────────────────────────────────────────────

/** Isosceles triangle pointing up. */
function trianglePath(r: number): string {
  return `M 0 ${-r} L ${r * 0.5} ${r} L ${-r * 0.5} ${r} Z`;
}

// ─── Widget component ──────────────────────────────────────────────────────────

export function ShieldDisplayWidget({
  instance,
  systemStates,
  isEditing,
  canEditData,
}: WidgetRendererProps) {
  const config = getConfig<ShieldDisplayConfig>(instance.config);
  const rawSegments: ShieldSegment[] = config.segments ?? [];
  const twoSplit = config.two_segment_split ?? 'port_starboard';
  const showLabels = config.show_labels ?? false;
  const halfGapDeg = (config.arc_gap_deg ?? 4) / 2;
  const shipImageUrl = config.ship_image_url as string | undefined;

  const activeSegments = rawSegments.filter((s) => s.primary_id);
  const count = Math.min(Math.max(activeSegments.length, 0), 4);

  // Compute segment arcs early so they're available for the bound systems list
  const segmentArcs = count > 0 ? getSegmentArcs(count, twoSplit) : [];

  // Collect all bound system IDs for the edit picker
  const boundSystems: Array<{ systemId: string; label: string }> = [];
  for (let i = 0; i < activeSegments.length; i++) {
    const seg = activeSegments[i];
    const arcLabel = segmentArcs[i]?.label ?? `Segment ${i + 1}`;
    if (seg.primary_id) boundSystems.push({ systemId: seg.primary_id, label: `${arcLabel} · Primary` });
    if (seg.secondary_id) boundSystems.push({ systemId: seg.secondary_id, label: `${arcLabel} · Secondary` });
  }

  // Edit state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);

  const updateSystemState = useUpdateSystemState();
  const systemPermissions = useDataPermissions('systemStates');

  const { containerRef, width, height, ready } = useContainerDimensions();

  const geometry = useMemo(() => {
    if (!ready || width === 0 || height === 0) return null;
    const size = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;

    // When labels are visible, shrink slightly to keep primary label (at outerR+2) within bounds
    const edgePad = showLabels ? 12 : 4;
    const outerR = size / 2 - edgePad;

    // Thin stroke arcs — ~4% of radius, min 2px
    const arcThickness = Math.max(2, outerR * 0.04);
    const arcGap = Math.max(1.5, outerR * 0.025); // gap between primary and secondary arcs

    // Arc centerline radii
    const primaryR = outerR - arcThickness / 2;
    const secondaryR = primaryR - arcThickness - arcGap;

    // Image fills the interior of the arc ring; triangle uses a smaller fraction
    const imageR = Math.max(8, secondaryR - arcThickness / 2 - 3);
    const iconR = Math.max(8, outerR * 0.28);

    return { cx, cy, outerR, arcThickness, primaryR, secondaryR, imageR, iconR };
  }, [ready, width, height, showLabels]);

  // Unique clip-path ID so multiple widget instances don't collide
  const clipId = `shield-clip-${instance.id}`;

  if (isEditing) {
    return (
      <div className="shield-display-widget shield-display-widget--editing">
        <span className="shield-display-widget__edit-label">SHIELD DISPLAY</span>
        <span className="shield-display-widget__edit-hint">
          {count > 0 ? `${count} segment${count > 1 ? 's' : ''} configured` : 'No segments configured'}
        </span>
      </div>
    );
  }

  if (!geometry) return <div className="shield-display-widget" ref={containerRef} />;

  const { cx, cy, outerR, arcThickness, primaryR, secondaryR, imageR, iconR } = geometry;
  const isFullRing = count === 1;

  return (
    <div className="shield-display-widget" ref={containerRef}>
      {/* Edit button + picker */}
      {canEditData && count > 0 && (
        <EditButton onClick={() => setPickerOpen((p) => !p)} title="Edit system status" />
      )}
      {pickerOpen && (
        <div className="shield-edit-picker" role="menu">
          {boundSystems.map(({ systemId, label }) => {
            const sys = systemStates.get(systemId);
            return (
              <button
                key={systemId}
                role="menuitem"
                className="shield-edit-picker__item"
                onClick={() => { setEditingSystemId(systemId); setPickerOpen(false); }}
              >
                <span className="shield-edit-picker__slot">{label}</span>
                <span className={`shield-edit-picker__name status-${sys?.effective_status ?? sys?.status ?? 'offline'}`}>
                  {sys?.name ?? systemId}
                </span>
              </button>
            );
          })}
          <button className="shield-edit-picker__cancel" onClick={() => setPickerOpen(false)}>
            Cancel
          </button>
        </div>
      )}

      {/* PlayerEditModal for the selected system */}
      {editingSystemId && (() => {
        const editSys = systemStates.get(editingSystemId) ?? null;
        return (
          <PlayerEditModal
            isOpen={true}
            dataType="systemStates"
            record={editSys}
            permissions={systemPermissions}
            onSave={(data: Partial<SystemState>) =>
              updateSystemState.mutate(
                { id: editingSystemId, data },
                { onSuccess: () => setEditingSystemId(null) },
              )
            }
            onCancel={() => setEditingSystemId(null)}
            title={`Edit ${editSys?.name ?? 'System'}`}
            isLoading={updateSystemState.isPending}
            error={updateSystemState.error?.message}
            visibleFields={['status']}
          />
        );
      })()}

      <svg
        className="shield-display-widget__svg"
        width={width}
        height={height}
        aria-label="Shield status display"
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={imageR} />
          </clipPath>

          {/* Label arc paths for textPath (multi-segment only) */}
          {!isFullRing && showLabels && segmentArcs.map((arc, i) => {
            const seg = activeSegments[i];
            if (!seg) return null;
            const cw = arcIsTopHalf(arc.startDeg, arc.endDeg);
            // For CW top arcs: text extends outward (away from center) from baseline.
            // For CCW bottom arcs: text extends inward (toward center) from baseline.
            // Use opposite path offsets so the visible text body always lands in the intended ring.
            const primaryLabelR = cw
              ? outerR + 2                      // top: cap at outerR + LABEL_FONT_SIZE + 2
              : outerR + LABEL_FONT_SIZE + 2;   // bottom: cap (inward) at outerR + 2
            const secondaryLabelR = cw
              ? secondaryR - arcThickness / 2 - LABEL_FONT_SIZE - 2  // top: cap at inner_edge - 2
              : secondaryR - arcThickness / 2 - 2;                    // bottom: cap (inward) at inner_edge - LABEL_FONT_SIZE - 2
            return (
              <g key={i}>
                <path
                  id={`shield-tp-p-${instance.id}-${i}`}
                  d={buildLabelArcPath(cx, cy, primaryLabelR, arc.startDeg, arc.endDeg, halfGapDeg, cw)}
                />
                {seg.secondary_id && (
                  <path
                    id={`shield-tp-s-${instance.id}-${i}`}
                    d={buildLabelArcPath(cx, cy, secondaryLabelR, arc.startDeg, arc.endDeg, halfGapDeg, cw)}
                  />
                )}
              </g>
            );
          })}
        </defs>

        {/* Faint reference ring */}
        <circle
          cx={cx}
          cy={cy}
          r={outerR}
          className="shield-display-widget__ring-bg"
          fill="none"
        />

        {/* Full-ring: single segment rendered as circles */}
        {isFullRing && activeSegments[0] && (() => {
          const seg = activeSegments[0];
          const primarySystem = seg.primary_id ? systemStates.get(seg.primary_id) : null;
          const secondarySystem = seg.secondary_id ? systemStates.get(seg.secondary_id) : null;
          const pStatus = primarySystem?.effective_status ?? primarySystem?.status ?? 'offline';
          const sStatus = secondarySystem?.effective_status ?? secondarySystem?.status ?? 'offline';

          return (
            <g>
              <circle
                cx={cx} cy={cy} r={primaryR}
                fill="none"
                stroke={STATUS_COLORS[pStatus] ?? STATUS_COLORS.offline}
                strokeWidth={arcThickness}
                className={`shield-arc shield-arc--${pStatus}`}
              />
              {secondarySystem && (
                <circle
                  cx={cx} cy={cy} r={secondaryR}
                  fill="none"
                  stroke={STATUS_COLORS[sStatus] ?? STATUS_COLORS.offline}
                  strokeWidth={arcThickness}
                  className={`shield-arc shield-arc--${sStatus}`}
                />
              )}
            </g>
          );
        })()}

        {/* Multi-segment arcs — pass 1: all arc paths */}
        {!isFullRing && segmentArcs.map((arc, i) => {
          const seg = activeSegments[i];
          if (!seg) return null;

          const primarySystem = seg.primary_id ? systemStates.get(seg.primary_id) : null;
          const secondarySystem = seg.secondary_id ? systemStates.get(seg.secondary_id) : null;
          const pStatus = primarySystem?.effective_status ?? primarySystem?.status ?? 'offline';
          const sStatus = secondarySystem?.effective_status ?? secondarySystem?.status ?? 'offline';

          const pPath = buildArcStroke(cx, cy, primaryR, arc.startDeg, arc.endDeg, halfGapDeg);
          const sPath = secondarySystem
            ? buildArcStroke(cx, cy, secondaryR, arc.startDeg, arc.endDeg, halfGapDeg)
            : null;

          return (
            <g key={i}>
              <path
                d={pPath}
                fill="none"
                stroke={STATUS_COLORS[pStatus] ?? STATUS_COLORS.offline}
                strokeWidth={arcThickness}
                strokeLinecap="round"
                className={`shield-arc shield-arc--${pStatus}`}
              />
              {sPath && (
                <path
                  d={sPath}
                  fill="none"
                  stroke={STATUS_COLORS[sStatus] ?? STATUS_COLORS.offline}
                  strokeWidth={arcThickness}
                  strokeLinecap="round"
                  className={`shield-arc shield-arc--${sStatus}`}
                />
              )}
            </g>
          );
        })}

        {/* Multi-segment labels — pass 2: textPath labels rendered after all arcs */}
        {!isFullRing && showLabels && segmentArcs.map((arc, i) => {
          const seg = activeSegments[i];
          if (!seg) return null;

          const primarySystem = seg.primary_id ? systemStates.get(seg.primary_id) : null;
          const secondarySystem = seg.secondary_id ? systemStates.get(seg.secondary_id) : null;
          const primaryLabel = seg.label ?? (primarySystem?.name ?? arc.label);
          const secondaryLabel = secondarySystem?.name ?? '';

          return (
            <g key={i}>
              <text className="shield-display-widget__label shield-display-widget__label--primary">
                <textPath
                  href={`#shield-tp-p-${instance.id}-${i}`}
                  startOffset="50%"
                  textAnchor="middle"
                >
                  {primaryLabel}
                </textPath>
              </text>
              {secondarySystem && (
                <text className="shield-display-widget__label shield-display-widget__label--secondary">
                  <textPath
                    href={`#shield-tp-s-${instance.id}-${i}`}
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    {secondaryLabel}
                  </textPath>
                </text>
              )}
            </g>
          );
        })}

        {/* Full-ring label */}
        {isFullRing && showLabels && (() => {
          const seg = activeSegments[0];
          const sys = seg?.primary_id ? systemStates.get(seg.primary_id) : null;
          const label = seg?.label ?? sys?.name;
          if (!label) return null;
          return (
            <text
              x={cx}
              y={cy + primaryR * 0.6}
              className="shield-display-widget__label shield-display-widget__label--primary"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {label}
            </text>
          );
        })()}

        {/* Ship center — uploaded image or default triangle */}
        {shipImageUrl ? (
          <image
            href={shipImageUrl}
            x={cx - imageR}
            y={cy - imageR}
            width={imageR * 2}
            height={imageR * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid meet"
            className="shield-display-widget__ship-image"
          />
        ) : (
          <g transform={`translate(${cx}, ${cy})`}>
            <path
              d={trianglePath(iconR * 0.65)}
              className="shield-display-widget__ship"
            />
          </g>
        )}

        {/* Unbound state */}
        {count === 0 && (
          <text
            x={cx}
            y={cy}
            className="shield-display-widget__unbound"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            UNBOUND
          </text>
        )}
      </svg>
    </div>
  );
}
