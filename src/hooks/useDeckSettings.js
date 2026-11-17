import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// Global deck copy limits, shared across all decks. Stored in a single
// DeckSetting record. Two sections: regular cards and battlefields.
export const DEFAULT_LIMITS = {
  regular: { fabled: 1, normal: 3, basic: 6 },
  battlefield: { fabled: 1, normal: 2, basic: 4 },
};

export function useDeckSettings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.DeckSetting.list('-created_date', 1);
        if (list && list.length) {
          setSettings(list[0]);
        } else {
          const created = await base44.entities.DeckSetting.create({ copy_limits: {} });
          setSettings(created);
        }
      } catch {}
    })();
  }, []);

  const updateLimits = useCallback(async (limits) => {
    if (!settings) {
      try {
        const created = await base44.entities.DeckSetting.create({ copy_limits: limits });
        setSettings(created);
      } catch {}
      return;
    }
    setSettings((p) => ({ ...p, copy_limits: limits }));
    try { await base44.entities.DeckSetting.update(settings.id, { copy_limits: limits }); } catch {}
  }, [settings]);

  const limits = {
    regular: { ...DEFAULT_LIMITS.regular, ...(settings?.copy_limits?.regular || {}) },
    battlefield: { ...DEFAULT_LIMITS.battlefield, ...(settings?.copy_limits?.battlefield || {}) },
  };

  return { limits, updateLimits };
}