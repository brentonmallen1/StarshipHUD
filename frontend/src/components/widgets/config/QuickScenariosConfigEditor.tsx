import type { QuickScenariosConfig, WidgetConfigEditorProps } from '../../../types';
import { QUICK_SCENARIOS_DEFAULTS } from '../../../types';
import { CheckboxField, NumberField } from './fields';

export function QuickScenariosConfigEditor({ config, onChange }: WidgetConfigEditorProps<QuickScenariosConfig>) {
  const c = { ...QUICK_SCENARIOS_DEFAULTS, ...config };
  return (
    <>
      <NumberField
        label="Scenarios Shown"
        min={1}
        max={50}
        step={1}
        fallback={QUICK_SCENARIOS_DEFAULTS.maxVisible}
        value={c.maxVisible}
        onChange={(n) => onChange({ maxVisible: Math.min(50, Math.round(n)) })}
        hint="Maximum number of scenario buttons listed"
      />
      <CheckboxField
        label="Show descriptions"
        checked={c.showDescriptions}
        onChange={(showDescriptions) => onChange({ showDescriptions })}
        hint="Display each scenario's description under its name"
      />
    </>
  );
}
