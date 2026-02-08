import { useMemo, useState } from 'react';
import { Pie } from '@visx/shape';
import { Group } from '@visx/group';
import { useContainerDimensions } from '../../hooks/useContainerDimensions';
import { useUpdateSystemState } from '../../hooks/useMutations';
import { useDataPermissions } from '../../hooks/usePermissions';
import { EditButton } from '../controls/EditButton';
import { PlayerEditModal } from '../modals/PlayerEditModal';
import type { WidgetRendererProps, SystemState } from '../../types';
import { STATUS_COLORS } from './arcUtils';
import './ArcGaugeWidget.css';

interface ArcGaugeConfig {
  sweep?: 180 | 270;
  show_ticks?: boolean;
  title?: string;
  unit?: string;
}

interface DisplaySegment {
  value: number;
  color: string;
  lit: boolean;
}

// Status band boundaries: [0,40) critical, [40,60) compromised, [60,80) operational, [80,100] optimal
const BAND_THRESHOLDS = [
  { start: 0, color: STATUS_COLORS.critical },
  { start: 40, color: STATUS_COLORS.compromised },
  { start: 60, color: STATUS_COLORS.operational },
  { start: 80, color: STATUS_COLORS.optimal },
];

const SEGMENT_COUNT = 20;
const SEGMENT_SIZE = 100 / SEGMENT_COUNT; // 5% each

function getSegmentColor(pctStart: number): string {
  for (let i = BAND_THRESHOLDS.length - 1; i >= 0; i--) {
    if (pctStart >= BAND_THRESHOLDS[i].start) return BAND_THRESHOLDS[i].color;
  }
  return BAND_THRESHOLDS[0].color;
}

/** Build discrete gauge segments — each is either lit (solid) or unlit (outline). */
function buildSegments(percentage: number): DisplaySegment[] {
  const pct = Math.max(0, Math.min(100, percentage));
  const segments: DisplaySegment[] = [];

  for (let i = 0; i < SEGMENT_COUNT; i++) {
    const segStart = i * SEGMENT_SIZE;
    segments.push({
      value: SEGMENT_SIZE,
      color: getSegmentColor(segStart),
      lit: pct > segStart,
    });
  }

  return segments;
}

export function ArcGaugeWidget({
  instance,
  systemStates,
  isEditing,
  canEditData,
}: WidgetRendererProps) {
  const config = instance.config as ArcGaugeConfig;
  const sweep = config.sweep ?? 270;
  const showGaps = config.show_ticks ?? true;

  const systemId = instance.bindings?.system_state_id as string | undefined;
  const system = systemId ? systemStates.get(systemId) : null;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mutation and permission hooks
  const updateSystemState = useUpdateSystemState();
  const systemPermissions = useDataPermissions('systemStates');

  const canEdit = canEditData && !!systemId && !!system;

  const status = system?.effective_status ?? system?.status ?? 'offline';
  const value = system?.value ?? 0;
  const maxValue = system?.max_value ?? 100;
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const unit = config.unit ?? system?.unit ?? '%';
  const title = config.title ?? system?.name ?? 'UNBOUND';
  const color = STATUS_COLORS[status] || STATUS_COLORS.offline;

  // Responsive sizing
  const { containerRef, width, height, ready } = useContainerDimensions();

  // Arc geometry — computed from container dimensions
  // All layout is expressed in "units of outerR" first, then scaled to fit.
  const geometry = useMemo(() => {
    if (!ready || width === 0 || height === 0) return null;

    const titleSpace = 20;
    const svgWidth = width;
    const svgHeight = height - titleSpace;

    const sweepRad = (sweep * Math.PI) / 180;
    const halfSweep = sweepRad / 2;
    const startAngle = -halfSweep;
    const endAngle = halfSweep;

    // Arc bounds at unit radius (relative to arc center at 0,0)
    // d3/visx convention: angle 0 = top, x = sin(θ), y = -cos(θ)
    const arcTop = -1; // top of arc always at -outerR
    const arcBottom = -Math.cos(halfSweep); // y of arc endpoints
    const arcHalfWidth = Math.sin(halfSweep);

    // Text layout — Y positions as fractions of outerR, relative to arc center
    const innerRatio = 0.72;
    const textStartRel = sweep <= 180 ? 0.15 : innerRatio * 0.2;
    const valueFsRel = 0.28;
    const unitFsRel = 0.11;
    const statusFsRel = 0.09;
    const textEndRel = textStartRel + unitFsRel * 1.6 + statusFsRel * 1.6 + statusFsRel;

    // Total content bounds (in units of outerR, relative to arc center)
    const contentTop = arcTop;
    const contentBottom = Math.max(arcBottom, textEndRel);
    const contentHeight = contentBottom - contentTop;
    const contentWidth = arcHalfWidth * 2;

    // Scale outerR to fit the container
    const padding = 6;
    const maxR_w = (svgWidth - padding * 2) / contentWidth;
    const maxR_h = (svgHeight - padding * 2) / contentHeight;
    const outerR = Math.min(maxR_w, maxR_h);
    const innerR = outerR * innerRatio;

    // Center the content in the SVG
    // contentCenter (in outerR units) = (contentTop + contentBottom) / 2
    // We want that point to map to svgHeight / 2
    const cx = svgWidth / 2;
    const cy = svgHeight / 2 - ((contentTop + contentBottom) / 2) * outerR;

    // Font sizes
    const valueFontSize = Math.max(10, outerR * valueFsRel);
    const unitFontSize = Math.max(7, outerR * unitFsRel);
    const statusFontSize = Math.max(6, outerR * statusFsRel);

    // Text Y positions relative to group center (0,0 in the Group transform)
    const textValueY = textStartRel * outerR;
    const textUnitY = textValueY + unitFontSize * 1.6;
    const textStatusY = textUnitY + statusFontSize * 1.6;

    return {
      svgWidth,
      svgHeight,
      cx,
      cy,
      outerR,
      innerR,
      startAngle,
      endAngle,
      textValueY,
      textUnitY,
      textStatusY,
      valueFontSize,
      unitFontSize,
      statusFontSize,
    };
  }, [ready, width, height, sweep]);

  // Build segments split at the current fill level
  const segments = useMemo(() => buildSegments(percentage), [percentage]);

  // Display value
  const displayValue = Math.round(percentage);

  // Modal handlers
  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleModalSave = (data: Partial<SystemState>) => {
    if (canEdit && systemId) {
      updateSystemState.mutate(
        { id: systemId, data },
        { onSuccess: () => setIsModalOpen(false) }
      );
    }
  };

  if (isEditing) {
    return (
      <div className="arc-gauge-widget arc-gauge-widget--editing">
        <span className="arc-gauge-widget__edit-label">ARC GAUGE</span>
        <span className="arc-gauge-widget__edit-hint">
          {systemId ? 'System bound' : 'No system bound'}
        </span>
      </div>
    );
  }

  return (
    <div className={`arc-gauge-widget status-${status}`} ref={containerRef}>
      {canEdit && <EditButton onClick={handleOpenModal} title="Edit system value" />}

      {canEdit && (
        <PlayerEditModal
          isOpen={isModalOpen}
          dataType="systemStates"
          record={system}
          permissions={systemPermissions}
          onSave={handleModalSave}
          onCancel={handleCloseModal}
          title={`Edit ${title}`}
          isLoading={updateSystemState.isPending}
          error={updateSystemState.error?.message}
          visibleFields={['value']}
        />
      )}

      {geometry && (
        <svg
          className="arc-gauge-widget__svg"
          width={geometry.svgWidth}
          height={geometry.svgHeight}
        >
          <Group top={geometry.cy} left={geometry.cx}>
            <Pie
              data={segments}
              pieValue={(d) => d.value}
              innerRadius={geometry.innerR}
              outerRadius={geometry.outerR}
              startAngle={geometry.startAngle}
              endAngle={geometry.endAngle}
              padAngle={showGaps ? 0.035 : 0}
              cornerRadius={showGaps ? 2 : 0}
              pieSort={null}
              pieSortValues={null}
            >
              {({ arcs, path }) =>
                arcs.map((arc, i) => (
                  <path
                    key={i}
                    d={path(arc) || ''}
                    fill={arc.data.lit ? arc.data.color : 'transparent'}
                    stroke={arc.data.color}
                    strokeWidth={arc.data.lit ? 0 : 0.5}
                    strokeOpacity={arc.data.lit ? 0 : 0.25}
                    className="arc-gauge-widget__band"
                  />
                ))
              }
            </Pie>

            {/* Center readout */}
            <text
              y={geometry.textValueY}
              className="arc-gauge-widget__value"
              style={{ fontSize: geometry.valueFontSize }}
            >
              {displayValue}
            </text>
            <text
              y={geometry.textUnitY}
              className="arc-gauge-widget__unit"
              style={{ fontSize: geometry.unitFontSize }}
            >
              {unit}
            </text>
            <text
              y={geometry.textStatusY}
              className="arc-gauge-widget__status"
              fill={color}
              style={{ fontSize: geometry.statusFontSize }}
            >
              {status.toUpperCase()}
            </text>
          </Group>
        </svg>
      )}

      {/* Title below SVG */}
      <div className="arc-gauge-widget__title">{title.toUpperCase()}</div>
    </div>
  );
}
