// Convert ability markup ([b]..[/b], [i]..[/i], [color:hex]..[/color], [icon:url])
// to/from HTML so the ability editor can render rich text live while keeping the
// compact tag format as the stored value.

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function markupToHtml(content) {
  if (!content) return '';
  let html = escapeHtml(content);
  html = html
    .replace(/\[b\]/g, '<b>')
    .replace(/\[\/b\]/g, '</b>')
    .replace(/\[i\]/g, '<i>')
    .replace(/\[\/i\]/g, '</i>')
    .replace(/\[color:([^\]]+)\]/g, '<span style="color:$1;font-family:CaesarDressing,cursive;font-weight:bold">')
    .replace(/\[\/color\]/g, '</span>')
    .replace(/\[icon:([^\]]+)\]/g, '<img src="$1" alt="" style="height:1.35em;vertical-align:middle;display:inline-block" />');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function rgbToHex(c) {
  if (!c) return c;
  if (c.startsWith('#')) return c;
  const m = c.match(/\d+/g);
  if (!m || m.length < 3) return c;
  return '#' + m.slice(0, 3).map((n) => parseInt(n).toString(16).padStart(2, '0')).join('');
}

export function nodeToMarkup(node) {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out += child.textContent;
    } else if (child.nodeType === 1) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') {
        out += '\n';
      } else if (tag === 'img') {
        out += `[icon:${child.getAttribute('src') || ''}]`;
      } else if (tag === 'b' || tag === 'strong') {
        out += `[b]${nodeToMarkup(child)}[/b]`;
      } else if (tag === 'i' || tag === 'em') {
        out += `[i]${nodeToMarkup(child)}[/i]`;
      } else if (tag === 'span' || tag === 'font') {
        const color = tag === 'span' ? child.style.color : child.getAttribute('color');
        const fw = tag === 'span' ? child.style.fontWeight : '';
        const fst = tag === 'span' ? child.style.fontStyle : '';
        let inner = nodeToMarkup(child);
        const isBold = fw === 'bold' || fw === 'bolder' || (fw && !isNaN(Number(fw)) && Number(fw) >= 600);
        const isItalic = fst === 'italic' || fst === 'oblique';
        if (isBold && !color) inner = `[b]${inner}[/b]`;
        if (isItalic) inner = `[i]${inner}[/i]`;
        if (color) inner = `[color:${rgbToHex(color)}]${inner}[/color]`;
        out += inner;
      } else if (tag === 'div' || tag === 'p') {
        out += '\n' + nodeToMarkup(child);
      } else {
        out += nodeToMarkup(child);
      }
    }
  });
  return out;
}

function escapeRegKw(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Replace any occurrence of an icon-word (outside existing tags) with
// [icon:url]. Runs BEFORE keywords/capitalize so the word is gone before they
// can bold or capitalize it — icon-words take priority.
export function applyIconWordsToAbility(markup, iconWords) {
  if (!markup || !iconWords || !iconWords.length) return markup;
  const normal = iconWords.map((w) => (w.word || '').trim()).filter(Boolean);
  if (!normal.length) return markup;
  const urlFor = {};
  normal.forEach((w) => { urlFor[w.toLowerCase()] = iconWords.find((x) => (x.word || '').trim() === w).icon_url; });
  const re = new RegExp(`\\b(${normal.map(escapeRegKw).join('|')})\\b(:)?`, 'gi');
  const applyIw = (text) => text.replace(re, (m, word, colon) => {
    const icon = `[icon:${urlFor[word.toLowerCase()] || ''}]`;
    return colon ? `${icon}[b]:[/b]` : icon;
  });
  const tagRe = /\[(b|i|\/b|\/i|color:[^\]]+|\/color|icon:[^\]]+)\]/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = tagRe.exec(markup)) !== null) {
    out += applyIw(markup.slice(last, m.index));
    out += m[0];
    last = m.index + m[0].length;
  }
  out += applyIw(markup.slice(last));
  return out;
}

// Wrap any occurrence of a folder keyword (outside existing [b]..[/b]) in
// [b]..[/b] so it becomes bolded once the user exits the entry.
export function applyKeywordsToAbility(markup, keywords) {
  if (!markup || !keywords || !keywords.length) return markup;
  // A keyword ending in " ?" is a number-pattern keyword: the "?" is a
  // placeholder for a number. "Armored ?" matches "Armored 3" and bolds the
  // whole "Armored 3" (word + following number). Plain keywords still bold
  // the bare word.
  const normal = [];
  const patterns = [];
  keywords.forEach((kw) => {
    if (/\s\?$/.test(kw)) {
      const base = kw.replace(/\s\?$/, '').trim();
      if (base) patterns.push(base);
    } else if (kw.trim()) {
      normal.push(kw);
    }
  });
  const hasPattern = patterns.length > 0;
  const hasNormal = normal.length > 0;
  if (!hasPattern && !hasNormal) return markup;
  // Single combined pass so a pattern match and a bare-word match can't both
  // fire on the same span (which would double-wrap). Only non-empty
  // alternatives are included — an empty `()` alternative would match
  // whitespace+digits and, being falsy, route the replacement to an undefined
  // normal-word group, corrupting numbers into "[b]undefined[/b]".
  const alts = [];
  if (hasPattern) alts.push(`(${patterns.map(escapeRegKw).join('|')})\\s+(\\d+)`);
  if (hasNormal) alts.push(`(${normal.map(escapeRegKw).join('|')})`);
  const combinedRe = new RegExp(`\\b(?:${alts.join('|')})\\b`, 'gi');
  const normalIdx = hasPattern ? 2 : 0;
  const applyKws = (text) =>
    text.replace(combinedRe, (match, ...args) => {
      const groups = args.slice(0, -2);
      if (hasPattern && groups[0] != null) {
        return `[b]${groups[0]} ${groups[1]}[/b]`;
      }
      return `[b]${groups[normalIdx]}[/b]`;
    });
  const re = /\[(b|i|\/b|\/i|color:[^\]]+|\/color|icon:[^\]]+)\]/g;
  let out = '';
  let last = 0;
  let m;
  let bold = false;
  while ((m = re.exec(markup)) !== null) {
    const text = markup.slice(last, m.index);
    out += bold ? text : applyKws(text);
    out += m[0];
    const tag = m[1];
    if (tag === 'b') bold = true;
    else if (tag === '/b') bold = false;
    last = m.index + m[0].length;
  }
  const tail = markup.slice(last);
  out += bold ? tail : applyKws(tail);
  return out;
}

// Capitalize the first letter of every capitalized word (outside tag tokens)
// in the ability text. Idempotent: an already-capitalized first letter is a
// no-op, so it is safe to run repeatedly (including inside [b]/[color] spans).
export function applyCapitalizedToAbility(markup, words) {
  if (!markup || !words || !words.length) return markup;
  const normal = words.map((w) => (w || '').trim()).filter(Boolean);
  if (!normal.length) return markup;
  const re = new RegExp(`\\b(${normal.map(escapeRegKw).join('|')})\\b`, 'gi');
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const applyCaps = (text) => text.replace(re, (m) => cap(m));
  const tagRe = /\[(b|i|\/b|\/i|color:[^\]]+|\/color|icon:[^\]]+)\]/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = tagRe.exec(markup)) !== null) {
    out += applyCaps(markup.slice(last, m.index));
    out += m[0];
    last = m.index + m[0].length;
  }
  out += applyCaps(markup.slice(last));
  return out;
}

// Bold every colon in visible text (outside tags and outside existing
// [b]..[/b] spans). Idempotent: a colon already inside [b]:[/b] is left alone,
// and colons inside tag tokens ([color:#hex], [icon:url]) are never touched.
export function boldColonsInAbility(markup) {
  if (!markup) return markup;
  const tagRe = /\[(b|i|\/b|\/i|color:[^\]]+|\/color|icon:[^\]]+)\]/g;
  let out = '';
  let last = 0;
  let bold = false;
  let m;
  while ((m = tagRe.exec(markup)) !== null) {
    const text = markup.slice(last, m.index);
    out += bold ? text : text.replace(/:/g, '[b]:[/b]');
    out += m[0];
    const tag = m[1];
    if (tag === 'b') bold = true;
    else if (tag === '/b') bold = false;
    last = m.index + m[0].length;
  }
  const tail = markup.slice(last);
  out += bold ? tail : tail.replace(/:/g, '[b]:[/b]');
  return out;
}