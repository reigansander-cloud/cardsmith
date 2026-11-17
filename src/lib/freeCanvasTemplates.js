const KEY = 'freeCanvasTemplates';

export function getTemplates() {
  try {
    const data = localStorage.getItem(KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    }
  } catch {}
  return [];
}

export function saveTemplate(name, data, icons) {
  const templates = getTemplates();
  const trimmed = (name || '').trim();
  const existingIdx = templates.findIndex(t => t.name === trimmed);
  const entry = { name: trimmed, data, icons: Array.isArray(icons) ? icons : [], savedAt: Date.now() };
  if (existingIdx >= 0) templates[existingIdx] = entry;
  else templates.push(entry);
  try { localStorage.setItem(KEY, JSON.stringify(templates)); } catch {}
  return templates;
}

export function deleteTemplate(name) {
  const templates = getTemplates().filter(t => t.name !== name);
  try { localStorage.setItem(KEY, JSON.stringify(templates)); } catch {}
  return templates;
}