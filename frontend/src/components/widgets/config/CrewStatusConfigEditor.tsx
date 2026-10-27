import type { CrewStatusConfig, WidgetConfigEditorProps } from '../../../types';
import { CREW_STATUS_DEFAULTS } from '../../../types';
import { CheckboxField, SelectField } from './fields';

type CrewFilter = 'all' | 'pc' | 'npc';

export function CrewStatusConfigEditor({ config, onChange }: WidgetConfigEditorProps<CrewStatusConfig>) {
  const c = { ...CREW_STATUS_DEFAULTS, ...config };
  // The widget checks showNpcOnly first, so mirror that precedence here
  const filter: CrewFilter = c.showNpcOnly ? 'npc' : c.showPcOnly ? 'pc' : 'all';
  return (
    <>
      <SelectField<CrewFilter>
        label="Crew Shown"
        value={filter}
        options={[
          { value: 'all', label: 'Everyone' },
          { value: 'pc', label: 'Player characters only' },
          { value: 'npc', label: 'NPCs only' },
        ]}
        onChange={(next) => onChange({ showPcOnly: next === 'pc', showNpcOnly: next === 'npc' })}
        hint="Limit the roster to player characters or NPCs"
      />
      <CheckboxField
        label="Compact mode"
        checked={c.compactMode}
        onChange={(compactMode) => onChange({ compactMode })}
        hint="Tighter rows for small widgets"
      />
      <CheckboxField
        label="Show heartbeat animation"
        checked={c.showHeartbeat}
        onChange={(showHeartbeat) => onChange({ showHeartbeat })}
        hint="Display a heartbeat indicator for each crew member based on their status"
      />
    </>
  );
}
