// Sanitizes contentEditable HTML for rules sections, keeping only basic
// formatting (alignment, font size, bold/italics/underline) and stripping
// everything else — Word/Docs junk, inline colors, font-families, classes,
// data attributes, scripts, and empty wrapper elements. Images (inserted
// icons) are preserved with their display styles intact.

const BLOCK_TAGS = new Set(['DIV', 'P', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const DROP_TAGS = new Set(['STYLE', 'SCRIPT', 'META', 'LINK', 'HEAD', 'NOSCRIPT', 'TITLE']);
const UNWRAP_TAGS = new Set(['O:P', 'FONT']);

export function sanitizeRulesHtml(html) {
  if (!html || typeof html !== 'string' || html.trim() === '') return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

function cleanNode(node) {
  const children = [...node.childNodes];
  for (const child of children) {
    if (child.nodeType === Node.COMMENT_NODE) { node.removeChild(child); continue; }
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) { node.removeChild(child); continue; }

    const tag = child.tagName;
    if (DROP_TAGS.has(tag)) { node.removeChild(child); continue; }

    // Recurse first so unwrapped children are already clean
    cleanNode(child);

    const keep = stripAttrs(child);
    if (!keep) {
      unwrap(child);
    } else if (isEmpty(child)) {
      node.removeChild(child);
    }
  }
}

function stripAttrs(el) {
  const tag = el.tagName;

  // Tags to unwrap (keep children, drop the tag itself)
  if (UNWRAP_TAGS.has(tag)) {
    while (el.attributes.length) el.removeAttribute(el.attributes[0].name);
    return false;
  }

  const keep = {};
  for (const attr of el.attributes) {
    const name = attr.name.toLowerCase();
    if (tag === 'IMG' && (name === 'src' || name === 'alt' || name === 'style')) {
      keep[attr.name] = attr.value;
    } else if (name === 'style') {
      const filtered = filterStyle(el.style);
      if (filtered) keep.style = filtered;
    } else if (name === 'align') {
      const v = attr.value.toLowerCase();
      if (BLOCK_TAGS.has(tag) && ['left', 'center', 'right', 'justify'].includes(v)) {
        const existing = keep.style ? keep.style + '; ' : '';
        keep.style = existing + `text-align: ${v}`;
      }
    }
    // All other attributes (class, data-*, color, face, size, etc.) are dropped
  }

  while (el.attributes.length) el.removeAttribute(el.attributes[0].name);
  for (const [k, v] of Object.entries(keep)) el.setAttribute(k, v);

  // Unwrap spans that have no remaining allowed style
  if (tag === 'SPAN' && !el.getAttribute('style')) return false;

  return true;
}

function filterStyle(style) {
  const parts = [];
  const align = style.textAlign;
  if (align && ['left', 'center', 'right', 'justify'].includes(align)) {
    parts.push(`text-align: ${align}`);
  }
  const fontSize = style.fontSize;
  if (fontSize) parts.push(`font-size: ${fontSize}`);
  return parts.join('; ');
}

function unwrap(el) {
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function isEmpty(el) {
  // A <br> or <img> itself has no text or descendants, but it's a meaningful
  // element (line break / icon) — don't strip it. querySelector only checks
  // descendants, so without this a standalone <br> gets removed and separate
  // lines collapse into the previous one.
  if (el.tagName === 'BR' || el.tagName === 'IMG') return false;
  if (el.querySelector('img, br')) return false;
  return el.textContent.trim() === '';
}