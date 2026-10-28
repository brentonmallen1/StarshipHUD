import type { GifDisplayConfig, WidgetConfigEditorProps } from '../../../types';
import { GIF_DISPLAY_DEFAULTS } from '../../../types';
import { CheckboxField, SelectField } from './fields';
import { HideBorderField } from './FxFields';

export function GifDisplayConfigEditor({ config, onChange }: WidgetConfigEditorProps<GifDisplayConfig>) {
  const c = { ...GIF_DISPLAY_DEFAULTS, ...config };
  return (
    <>
      <SelectField
        label="Image Fit"
        value={c.object_fit}
        options={[
          { value: 'contain', label: 'Contain (fit within)' },
          { value: 'cover', label: 'Cover (fill, may crop)' },
          { value: 'fill', label: 'Fill (stretch)' },
        ]}
        onChange={(object_fit) => onChange({ object_fit })}
        hint="How the image fills the widget area"
      />
      <CheckboxField
        label="Dim based on system status"
        checked={c.status_dim}
        onChange={(status_dim) => onChange({ status_dim })}
        hint="Uses the system binding above to modulate opacity and saturation based on health"
      />
      <HideBorderField checked={c.hide_border} onChange={(hide_border) => onChange({ hide_border })} />
    </>
  );
}
