// Standard dice pip positions, normalized 0–1 within the dice face.
export const PIP_POSITIONS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]],
};

// Parse [icon:url] tags from text content into tokens (text / icon).
export function parseContentTokens(content) {
  const tokens = [];
  const re = /\[icon:([^\]]+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: content.slice(last, m.index) });
    tokens.push({ type: 'icon', url: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < content.length) tokens.push({ type: 'text', value: content.slice(last) });
  return tokens;
}

// Parse [icon:url] and inline formatting tags ([b]/[/b], [i]/[/i], [u]/[/u]) into
// tokens carrying their active bold/italic/underline state.
export function parseRichTokens(content) {
  const tokens = [];
  const re = /\[icon:([^\]]+)\]|\[\/?[biu]\]/g;
  let last = 0;
  let bold = false, italic = false, underline = false;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: content.slice(last, m.index), bold, italic, underline });
    if (m[1] !== undefined) {
      tokens.push({ type: 'icon', url: m[1].trim(), bold, italic, underline });
    } else if (m[0] === '[b]') bold = true;
    else if (m[0] === '[/b]') bold = false;
    else if (m[0] === '[i]') italic = true;
    else if (m[0] === '[/i]') italic = false;
    else if (m[0] === '[u]') underline = true;
    else if (m[0] === '[/u]') underline = false;
    last = m.index + m[0].length;
  }
  if (last < content.length) tokens.push({ type: 'text', value: content.slice(last), bold, italic, underline });
  return tokens;
}