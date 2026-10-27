import type { StatusDisplayConfig, WidgetConfigEditorProps } from '../../../types';
import { STATUS_DISPLAY_DEFAULTS } from '../../../types';
import { CheckboxField, SelectField, ORIENTATION_OPTIONS, ORIENTATION_HINT } from './fields';

export function StatusDisplayConfigEditor({ config, onChange }: WidgetConfigEditorProps<StatusDisplayConfig>) {
  const c = { ...STATUS_DISPLAY_DEFAULTS, ...config };
  return (
    <>
      <SelectField
        label="Orientation"
        value={c.orientation}
        options={ORIENTATION_OPTIONS}
        onChange={(orientation) => onChange({ orientation })}
        hint={ORIENTATION_HINT}
      />
      {c.orientation === 'vertical' && (
        <CheckboxField
          label="Show abbreviated status label"
          checked={c.showLabel}
          onChange={(showLabel) => onChange({ showLabel })}
          hint="Display a short status code (OPR, DGR, CRT, etc.) below the icon"
        />
      )}
    </>
  );
}
