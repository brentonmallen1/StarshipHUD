/**
 * Widget config editors, one per configurable widget type.
 *
 * Convention: `config/<WidgetName>ConfigEditor.tsx` exports
 * `<WidgetName>ConfigEditor`, typed with that widget's config interface from
 * types/widget-configs.ts and reading defaults from its `*_DEFAULTS` object.
 * The registry loads this barrel lazily so GM authoring code stays out of the
 * player bundle path.
 */
export { ArcGaugeConfigEditor } from './ArcGaugeConfigEditor';
export { AssetDisplayConfigEditor } from './AssetDisplayConfigEditor';
export { CargoBayConfigEditor } from './CargoBayConfigEditor';
export { CrewStatusConfigEditor } from './CrewStatusConfigEditor';
export { DataTableConfigEditor } from './DataTableConfigEditor';
export { GifDisplayConfigEditor } from './GifDisplayConfigEditor';
export { HealthBarConfigEditor } from './HealthBarConfigEditor';
export { HolomapConfigEditor } from './HolomapConfigEditor';
export { NumberDisplayConfigEditor } from './NumberDisplayConfigEditor';
export { PhaseBarsConfigEditor } from './PhaseBarsConfigEditor';
export { PulseConfigEditor } from './PulseConfigEditor';
export { QuickScenariosConfigEditor } from './QuickScenariosConfigEditor';
export { RadarPingConfigEditor } from './RadarPingConfigEditor';
export { ScanLineConfigEditor } from './ScanLineConfigEditor';
export { ShieldDisplayConfigEditor } from './ShieldDisplayConfigEditor';
export { ShipLogConfigEditor } from './ShipLogConfigEditor';
export { SoundboardConfigEditor } from './SoundboardConfigEditor';
export { StatusDisplayConfigEditor } from './StatusDisplayConfigEditor';
export { TicksConfigEditor } from './TicksConfigEditor';
export { TitleConfigEditor } from './TitleConfigEditor';
export { WaveformConfigEditor } from './WaveformConfigEditor';
