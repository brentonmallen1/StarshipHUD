import type { TitleConfig, WidgetConfigEditorProps } from '../../../types';
import { TITLE_DEFAULTS } from '../../../types';
import { TextField } from './fields';

export function TitleConfigEditor({ config, onChange }: WidgetConfigEditorProps<TitleConfig>) {
  const c = { ...TITLE_DEFAULTS, ...config };
  return (
    <TextField
      label="Title Text"
      value={c.text}
      onChange={(text) => onChange({ text })}
      placeholder="Enter title text"
      hint="The text displayed in this title widget. {{ship_name}} is replaced with the ship's name."
    />
  );
}
