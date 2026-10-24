import React, { useEffect, useState } from 'react';
import { text } from '../../../i18n';
import {
  applyDisplayPreferencesToDocument,
  readDisplayPreferences,
  writeDisplayPreferences,
  type DisplayDensity,
  type DisplayPreferences,
} from '../../../components/shell/displayPreferences';

/**
 * Preferencias de densidade/contraste (PLANO §7.1 / §8).
 * Scaffold local — nao declara conformidade AA.
 */
const DisplayPreferencesPanel: React.FC = () => {
  const [prefs, setPrefs] = useState<DisplayPreferences>(() => readDisplayPreferences());

  useEffect(() => {
    applyDisplayPreferencesToDocument(prefs);
    writeDisplayPreferences(prefs);
  }, [prefs]);

  const setDensity = (density: DisplayDensity) => {
    setPrefs((prev) => ({ ...prev, density }));
  };

  const setHighContrast = (highContrast: boolean) => {
    setPrefs((prev) => ({ ...prev, highContrast }));
  };

  return (
    <section className="tt-panel space-y-5" aria-labelledby="display-prefs-heading">
      <div>
        <h2 id="display-prefs-heading" className="text-lg font-semibold text-tt-text">
          {text('Apresentação', 'Display')}
        </h2>
        <p className="mt-1 text-sm text-tt-text-muted">
          {text(
            'Densidade confortável por padrão; compacta só reduz espaçamento, sem remover texto essencial.',
            'Comfortable density by default; compact only reduces spacing and never removes essential text.'
          )}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-tt-text">
          {text('Densidade', 'Density')}
        </legend>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex min-h-touch items-center gap-2 text-sm text-tt-text">
            <input
              type="radio"
              name="tt-density"
              checked={prefs.density === 'comfortable'}
              onChange={() => setDensity('comfortable')}
            />
            {text('Confortável', 'Comfortable')}
          </label>
          <label className="inline-flex min-h-touch items-center gap-2 text-sm text-tt-text">
            <input
              type="radio"
              name="tt-density"
              checked={prefs.density === 'compact'}
              onChange={() => setDensity('compact')}
            />
            {text('Compacta', 'Compact')}
          </label>
        </div>
      </fieldset>

      <label className="inline-flex min-h-touch items-center gap-2 text-sm text-tt-text">
        <input
          type="checkbox"
          checked={prefs.highContrast}
          onChange={(event) => setHighContrast(event.target.checked)}
        />
        {text('Contraste elevado (preferência local)', 'High contrast (local preference)')}
      </label>

      <p className="text-xs text-tt-text-muted" role="note">
        {text(
          'Isto não substitui auditoria humana WCAG 2.2 AA.',
          'This does not replace a human WCAG 2.2 AA audit.'
        )}
      </p>
    </section>
  );
};

export default DisplayPreferencesPanel;
