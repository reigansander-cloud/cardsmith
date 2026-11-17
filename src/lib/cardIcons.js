// Card icon library - using custom uploaded icons
export const CARD_ICONS = [
  {
    key: 'candle',
    label: 'Candle',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/e723cacf98_0bcfae148_candle-light.svg'
  },
  {
    key: 'shield',
    label: 'Shield',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/78bf8b9f3b_269950ad0_crenulated-shield.svg'
  },
  {
    key: 'apple',
    label: 'Apple',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/33f5d040e9_e1683eac2_shiny-apple.svg'
  },
  {
    key: 'bread',
    label: 'Bread',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/b6a5c8a03c_dec18e3a9_sliced-bread.svg'
  },
  {
    key: 'stiletto',
    label: 'Stiletto',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/41a1594b1f_c8f114a18_stiletto.svg'
  },
  {
    key: 'shot',
    label: 'Shot',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/442f92448b_101162454_high-shot.svg'
  },
  {
    key: 'crown',
    label: 'Crown',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/952b0a04c2_3fcf16056_crown.svg'
  },
  {
    key: 'helm',
    label: 'Helm',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/7f389caacf_28c3a2bc3_visored-helm.svg'
  },
  {
    key: 'flag',
    label: 'Flag',
    url: 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/6dfaf621cf_1e03ac797_flying-flag.svg'
  }
];

// Attribute icons - smaller set for attribute display
export const ATTRIBUTE_ICONS = [
  {
    key: 'attr_sword',
    label: 'Attack',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/></svg>`
  },
  {
    key: 'attr_shield',
    label: 'Defense',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
  },
  {
    key: 'attr_heart',
    label: 'Health',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`
  },
  {
    key: 'attr_bolt',
    label: 'Speed',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
  },
  {
    key: 'attr_star',
    label: 'Special',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  },
  {
    key: 'attr_flame',
    label: 'Power',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`
  },
  {
    key: 'attr_eye',
    label: 'Range',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
  },
  {
    key: 'attr_gem',
    label: 'Cost',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>`
  }
];

export function getIconByKey(key) {
  if (typeof key === 'string' && /^https?:\/\//.test(key)) return { key, label: '', url: key };
  return [...CARD_ICONS, ...ATTRIBUTE_ICONS].find(i => i.key === key);
}

// Returns true if the icon uses an image URL rather than inline SVG
export function isUrlIcon(icon) {
  return !!icon?.url;
}