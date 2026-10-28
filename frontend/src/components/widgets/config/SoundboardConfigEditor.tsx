import { useState } from 'react';
import type { SoundboardWidgetConfig, WidgetConfigEditorProps } from '../../../types';
import { SOUNDBOARD_DEFAULTS } from '../../../types';
import { TextField } from './fields';

export function SoundboardConfigEditor({ config, onChange }: WidgetConfigEditorProps<SoundboardWidgetConfig>) {
  // Keep the raw text while typing; store the trimmed title (blank → default)
  const [title, setTitle] = useState(config.title ?? SOUNDBOARD_DEFAULTS.title);
  return (
    <TextField
      label="Title"
      value={title}
      onChange={(raw) => {
        setTitle(raw);
        onChange({ title: raw.trim() || SOUNDBOARD_DEFAULTS.title });
      }}
      placeholder={SOUNDBOARD_DEFAULTS.title}
      hint="Header title displayed above the sound buttons"
    />
  );
}
