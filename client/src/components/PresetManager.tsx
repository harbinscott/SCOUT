import type { Preset, SavedState } from '../../../shared/types';

interface Props {
  presets: Preset[];
  state: SavedState;
  onChange: (presets: Preset[]) => void;
  onLoad: (state: SavedState) => void;
}

export function PresetManager({ presets, state, onChange, onLoad }: Props) {
  const create = () => {
    const name = window.prompt('Preset name', `Commute plan ${presets.length + 1}`)?.trim();
    if (!name) return;
    onChange([...presets, { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), state }]);
  };

  const rename = (preset: Preset) => {
    const name = window.prompt('Rename preset', preset.name)?.trim();
    if (name) onChange(presets.map((item) => item.id === preset.id ? { ...item, name } : item));
  };

  return (
    <div className="preset-row">
      <button className="secondary-button" type="button" onClick={create}>Save preset</button>
      {presets.length > 0 && (
        <label className="preset-select">
          <span className="sr-only">Saved presets</span>
          <select defaultValue="" onChange={(event) => {
            const preset = presets.find((item) => item.id === event.target.value);
            if (preset) onLoad(preset.state);
            event.target.value = '';
          }}>
            <option value="" disabled>Load preset…</option>
            {presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
          </select>
        </label>
      )}
      {presets.length > 0 && (
        <details className="preset-menu">
          <summary aria-label="Manage presets">•••</summary>
          <div>
            {presets.map((preset) => (
              <span key={preset.id}>
                <b>{preset.name}</b>
                <button type="button" onClick={() => rename(preset)}>Rename</button>
                <button type="button" onClick={() => onChange(presets.filter((item) => item.id !== preset.id))}>Delete</button>
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
