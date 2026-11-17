import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const injected = new Set();

export function injectFontFace(name, url) {
  if (!name || !url || injected.has(name)) return;
  injected.add(name);
  const style = document.createElement('style');
  style.id = `custom-font-${name.replace(/\s+/g, '_')}`;
  style.textContent = `@font-face { font-family: "${name}"; src: url("${url}"); }`;
  document.head.appendChild(style);
}

export function removeFontFace(name) {
  if (!name) return;
  injected.delete(name);
  const el = document.getElementById(`custom-font-${name.replace(/\s+/g, '_')}`);
  if (el) el.remove();
}

// Module-level shared store so every useCustomFonts() instance (font dropdowns,
// font manager, etc.) stays in sync — uploading a font in one place updates all.
let fonts = [];
const listeners = new Set();
let loaded = false;
let loading = null;

function emit() {
  listeners.forEach((l) => l(fonts));
}

export function getCustomFonts() {
  return fonts;
}

export function subscribeCustomFonts(cb) {
  listeners.add(cb);
  cb(fonts);
  return () => listeners.delete(cb);
}

export function refreshCustomFonts() {
  loading = base44.entities.Font.list()
    .then((list) => {
      fonts = Array.isArray(list) ? list : [];
      fonts.forEach((f) => injectFontFace(f.name, f.url));
      emit();
    })
    .catch(() => {})
    .finally(() => { loading = null; });
  return loading;
}

export function addCustomFont(font) {
  fonts = [...fonts, font];
  injectFontFace(font.name, font.url);
  emit();
}

export function removeCustomFont(id) {
  const removed = fonts.find((f) => f.id === id);
  fonts = fonts.filter((f) => f.id !== id);
  if (removed) removeFontFace(removed.name);
  emit();
}

export function useCustomFonts() {
  const [state, setState] = useState(fonts);
  useEffect(() => {
    if (!loaded && !loading) {
      loaded = true;
      refreshCustomFonts();
    }
    return subscribeCustomFonts(setState);
  }, []);
  return { fonts: state, refresh: refreshCustomFonts };
}