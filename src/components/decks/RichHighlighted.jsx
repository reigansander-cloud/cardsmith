import React from 'react';

// Renders rich text ([b][i][color][icon] markup) with optional search-term
// highlighting (<mark>) on the plain-text segments.
export default function RichHighlighted({ content, highlight, className }) {
  if (!content) return null;
  const re = /\[(b|i|\/b|\/i|color:[^\]]+|\/color|icon:[^\]]+)\]/g;
  const out = [];
  let last = 0;
  let m;
  let key = 0;
  let bold = false;
  let italic = false;
  let color = null;
  const term = highlight && highlight.trim();
  const kwRe = term ? new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null;

  const flush = (text) => {
    if (!text) return;
    const style = { fontWeight: bold ? 'bold' : 'normal', fontStyle: italic ? 'italic' : 'normal', color: color || undefined };
    const nodes = [];
    if (!kwRe) {
      nodes.push(text);
    } else {
      const parts = text.split(kwRe);
      parts.forEach((p, i) => {
        if (i % 2 === 1) nodes.push(<mark key={key++} className="bg-primary/30 text-foreground rounded px-0.5">{p}</mark>);
        else if (p) nodes.push(p);
      });
    }
    out.push(<span key={key++} style={style}>{nodes}</span>);
  };

  while ((m = re.exec(content)) !== null) {
    if (m.index > last) flush(content.slice(last, m.index));
    const tag = m[1];
    if (tag === 'b') bold = true;
    else if (tag === '/b') bold = false;
    else if (tag === 'i') italic = true;
    else if (tag === '/i') italic = false;
    else if (tag.startsWith('color:')) color = tag.slice(6);
    else if (tag === '/color') color = null;
    else if (tag.startsWith('icon:')) {
      out.push(<img key={key++} src={tag.slice(5)} alt="" style={{ height: '1.35em', verticalAlign: 'middle', display: 'inline-block' }} />);
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) flush(content.slice(last));
  return <span className={className}>{out}</span>;
}