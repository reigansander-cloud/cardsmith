// Layout engine for the folder entry preview canvas.
// Builds a list of absolutely-positioned layers from a CardEntry.
//
// Templates:
//   permanent / instant / modifier — portrait 360x504 (the original layout)
//   battlefield                    — landscape 504x360, rotated 90° on print/TTS
//   income                         — portrait 360x504, custom layout
//
// Supertypes are global and user-managed (FolderSupertype with folder_id
// '__global__'), so the render template is resolved from the global supertype
// list via templateTypeFor. Callers pass the `supertypes` array; when it's
// missing, a legacy fallback maps the old fixed supertype names.

export const STAT_COLORS = { Pws: '#b91c1c', PRWS: '#b91c1c', Amr: '#1d4ed8', Dur: '#7e22ce', Atk: '#b91c1c' };
export const STANDARD_STATS = ['Pws', 'Amr', 'Dur'];

// Display label for a stat name. Legacy entries stored with 'PRWS' or 'Atk' render as 'Pws'.
export function statLabel(name) {
  return name === 'PRWS' || name === 'Atk' ? 'Pws' : name;
}

const FONTS = {
  caesar: 'CaesarDressing, cursive',
  albert: '"Albert Sans", sans-serif',
};

// The 3 fixed type symbols available on Income entries.
export const INCOME_SYMBOLS = [
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/d691541a0f_a8ee39bd4_scissors.png',
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/2d9976c138_1273fa2ca_paper.png',
  'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/00f05be2d4_22405d936_rock.png',
];

// Legacy supertype names → template type (for entries created before supertypes
// were user-managed). 'fortification' shared the permanent layout.
const LEGACY_TEMPLATE = {
  permanent: 'permanent',
  fortification: 'permanent',
  instant: 'instant',
  modifier: 'modifier',
  battlefield: 'battlefield',
  income: 'income',
};

export function statColor(name, stored) {
  if (stored) return stored;
  return STAT_COLORS[name] || '#9ca3af';
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Resolve the render template type for an entry from the folder's supertypes.
export function templateTypeFor(entry, supertypes) {
  const list = supertypes || [];
  if (entry.supertype === 'token') {
    const t = list.find((s) => s.name === entry.token_type);
    if (t) return t.template_type;
    return LEGACY_TEMPLATE[entry.token_type] || 'permanent';
  }
  const t = list.find((s) => s.name === entry.supertype);
  if (t) return t.template_type;
  return LEGACY_TEMPLATE[entry.supertype] || 'permanent';
}

export function supertypeLabel(entry) {
  const prefix = entry.fabled ? 'Fabled ' : entry.basic ? 'Basic ' : '';
  if (entry.supertype === 'token') {
    return `${prefix}Token ${cap(entry.token_type || 'permanent')}`;
  }
  return `${prefix}${cap(entry.supertype)}`;
}

export function subtypeText(entry) {
  const label = supertypeLabel(entry);
  return entry.subtype ? `${label} - ${entry.subtype}` : label;
}

// The render type: for tokens it's the chosen token_type's template, otherwise
// the supertype's template.
export function renderType(entry, supertypes = []) {
  return templateTypeFor(entry, supertypes);
}

export function isStructureEntry(entry, supertypes = []) {
  if (!entry) return false;
  if (renderType(entry, supertypes) === 'battlefield') return true;
  const supertypeName = entry.supertype === 'token' ? entry.token_type : entry.supertype;
  const lower = (supertypeName || '').toLowerCase();
  return lower === 'structure' || lower === 'condition';
}

export function hasInfluence(entry, supertypes = []) {
  const rt = renderType(entry, supertypes);
  return rt !== 'instant' && rt !== 'income';
}

// Canvas dimensions for a template. Battlefield is landscape; all others are
// portrait (360x504).
export function canvasSizeFor(entry, supertypes = []) {
  return renderType(entry, supertypes) === 'battlefield'
    ? { w: 504, h: 360 }
    : { w: 360, h: 504 };
}

// Split cost icons into (bar1, bar2) for the Income dual cost bar.
// <=3: all in bar1. 4-6: 3 in bar1, rest in bar2. >=7: 4 in bar1, rest in bar2.
export function splitIncomeCost(icons) {
  const n = (icons || []).length;
  if (n <= 3) return [icons || [], []];
  const first = n >= 7 ? 4 : 3;
  return [(icons || []).slice(0, first), (icons || []).slice(first)];
}

export function buildLayers(entry, supertypes = []) {
  const rt = renderType(entry, supertypes);
  if (rt === 'battlefield') return buildBattlefieldLayers(entry);
  if (rt === 'income') return buildIncomeLayers(entry);
  return buildStandardLayers(entry, rt);
}

// permanent / instant / modifier — the original portrait layout.
function buildStandardLayers(entry, rt) {
  const layers = [];
  const stats = entry.stats || [];
  const n = stats.length;

  const subW = n >= 1 ? 291 - 62 * (n - 1) : 291;
  const subY = n >= 3 ? 443 : 470;
  const subH = n >= 3 ? 51 : 24;

  // Influence
  if (rt !== 'instant') {
    const infBlank = !entry.influence || String(entry.influence).trim() === '';
    if (rt === 'modifier') {
      if (!infBlank) {
        layers.push({ type: 'text', x: 0, y: -23, w: 135, h: 198, fontSize: 135, fontFamily: FONTS.caesar, align: 'center', italic: false, color: '#000000', content: String(entry.influence), shrinkToFit: true, isInfluence: true });
      }
      // blank modifier influence -> hidden
    } else {
      layers.push({ type: 'text', x: 0, y: -23, w: 135, h: 198, fontSize: 150, fontFamily: FONTS.caesar, align: 'center', italic: false, color: '#000000', content: infBlank ? 'X' : String(entry.influence), shrinkToFit: true, isInfluence: true });
    }
  }

  // Name + cost geometry
  let nameX, nameW, costX, costW;
  if (rt === 'instant') {
    nameX = 15; nameW = 327; costX = 15; costW = 327;
  } else if (rt === 'modifier') {
    const infBlank = !entry.influence || String(entry.influence).trim() === '';
    if (infBlank) { nameX = 15; nameW = 327; costX = 15; costW = 327; }
    else { nameX = 144; nameW = 198; costX = 144; costW = 198; }
  } else {
    nameX = 126; nameW = 216; costX = 126; costW = 216;
  }

  layers.push({ type: 'text', x: nameX, y: 27, w: nameW, h: 81, fontSize: 26, fontFamily: FONTS.caesar, align: 'center', italic: false, color: '#000000', content: (entry.name || '').toUpperCase(), shrinkToFit: true });
  layers.push({ type: 'costbar', x: costX, y: 94, w: costW, h: 42, fontSize: 25, align: 'center', costIcons: entry.cost_icons || [], costQuestion: entry.cost_question || [] });
  // Flavor text shortens the ability box by ~1/5 and fills that strip with the
  // flavor text at 1/3 the ability font size, italics, same font.
  const hasFlavor = !!(entry.flavor_text && String(entry.flavor_text).trim());
  const abilityH = hasFlavor ? 195 : 244;
  layers.push({ type: 'text', x: 15, y: 167, w: 327, h: abilityH, fontSize: 23, fontFamily: FONTS.albert, align: 'center', italic: false, color: '#000000', content: entry.ability || '', shrinkToFit: true });
  if (hasFlavor) {
    layers.push({ type: 'text', x: 15, y: 167 + abilityH, w: 327, h: 244 - abilityH, fontSize: 23 * 2 / 3, fontFamily: FONTS.albert, align: 'center', italic: true, color: '#000000', content: entry.flavor_text, shrinkToFit: true, valign: 'top' });
  }
  layers.push({ type: 'text', x: 7, y: subY, w: subW, h: subH, fontSize: 18, fontFamily: FONTS.caesar, align: 'left', italic: true, color: '#000000', content: subtypeText(entry).toUpperCase(), shrinkToFit: true, valign: 'bottom' });

  stats.forEach((s, i) => {
    const val = String(s.value || '');
    const sx = 289 - 62 * i - (val.length > 1 ? 8 : 0);
    layers.push({ type: 'text', x: sx, y: 403, w: 71, h: 101, fontSize: 72, fontFamily: FONTS.caesar, align: 'center', italic: false, color: statColor(s.name, s.color), content: val, shrinkToFit: true });
  });

  return layers;
}

// Battlefield — landscape 504x360. No subtype, no stats.
function buildBattlefieldLayers(entry) {
  const layers = [];
  const infBlank = !entry.influence || String(entry.influence).trim() === '';
  layers.push({ type: 'text', x: 13, y: 17, w: 478, h: 68, fontSize: 40, fontFamily: FONTS.caesar, align: 'center', valign: 'top', color: '#000000', content: (entry.name || '').toUpperCase(), shrinkToFit: true });
  layers.push({ type: 'text', x: 20, y: 70, w: 161, h: 247, fontSize: 190, fontFamily: FONTS.caesar, align: 'center', valign: 'top', color: '#000000', content: infBlank ? 'X' : String(entry.influence), shrinkToFit: true, isInfluence: true });
  layers.push({ type: 'text', x: 186, y: 107, w: 305, h: 106, fontSize: 26, fontFamily: FONTS.albert, align: 'center', valign: 'center', color: '#000000', content: entry.ability || '', shrinkToFit: true });
  layers.push({ type: 'costbar', x: 186, y: 239, w: 305, h: 60, costIcons: entry.cost_icons || [], costQuestion: entry.cost_question || [] });
  return layers;
}

// Income — portrait 360x504, custom layout. Title always "INCOME"; no influence,
// no subtype, no stats. Has a type symbol, dual cost bars, a bonus box.
function buildIncomeLayers(entry) {
  const layers = [];
  const costIcons = entry.cost_icons || [];

  // Title — always "INCOME"
  layers.push({ type: 'text', x: 58, y: 8, w: 164, h: 67, fontSize: 50, fontFamily: FONTS.caesar, align: 'left', valign: 'top', color: '#000000', content: 'INCOME', shrinkToFit: true });

  // Type symbol
  if (entry.income_symbol) {
    layers.push({ type: 'image', x: 233, y: 8, w: 61, url: entry.income_symbol });
  }

  // Cost bars (split across two bars when > 3 icons)
  const [bar1, bar2] = splitIncomeCost(costIcons);
  const costQuestion = entry.cost_question || [];
  const splitIdx = costIcons.length <= 3 ? costIcons.length : (costIcons.length >= 7 ? 4 : 3);
  const q1 = costQuestion.slice(0, splitIdx);
  const q2 = costQuestion.slice(splitIdx);
  if (bar1.length) layers.push({ type: 'costbar', x: 25, y: 80, w: 310, h: 83, costIcons: bar1, costQuestion: q1, fit: true });
  if (bar2.length) layers.push({ type: 'costbar', x: 25, y: 169, w: 310, h: 83, costIcons: bar2, costQuestion: q2, fit: true });

  // Ability — Y shifts up when there is no second cost bar (<= 3 icons)
  const abilityY = costIcons.length > 3 ? 260 : 177;
  layers.push({ type: 'text', x: 16, y: abilityY, w: 327, h: 68, fontSize: 26, fontFamily: FONTS.albert, align: 'center', valign: 'top', color: '#000000', content: entry.ability || '', shrinkToFit: true });

  // Bonus box: rectangle + "BONUS" header
  layers.push({ type: 'rect', x: 16, y: 345, w: 327, h: 141, stroke: '#000000', strokeWidth: 3 });
  layers.push({ type: 'text', x: 77, y: 345, w: 206, h: 40, fontSize: 31, fontFamily: FONTS.caesar, align: 'center', valign: 'top', color: '#000000', content: 'BONUS' });

  // Bonus section: cost bar or second ability
  if (entry.bonus_mode === 'ability') {
    layers.push({ type: 'text', x: 25, y: 394, w: 310, h: 83, fontSize: 24, fontFamily: FONTS.albert, align: 'center', valign: 'center', color: '#000000', content: entry.bonus_ability || '', shrinkToFit: true });
  } else if ((entry.bonus_cost_icons || []).length) {
    layers.push({ type: 'costbar', x: 25, y: 394, w: 310, h: 83, costIcons: entry.bonus_cost_icons, fit: true });
  }

  return layers;
}