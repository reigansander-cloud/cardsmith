import React, { useRef, useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Bold, Italic, ImagePlus, Palette } from 'lucide-react';
import { STAT_COLORS, STANDARD_STATS } from '@/lib/folderPreview';
import { markupToHtml, nodeToMarkup, applyIconWordsToAbility, applyKeywordsToAbility, applyCapitalizedToAbility, boldColonsInAbility } from '@/lib/abilityMarkup';

// Ability editor that renders bold/italic/color/icons live (contentEditable)
// while serializing back to the compact [b]..[/b] tag format for storage.
export default function AbilityEditor({ value, onChange, icons, folderStats, keywords, capitalized, iconWords, autoFormat = true }) {
  const ref = useRef(null);
  const lastSerialized = useRef('');
  const savedRange = useRef(null);
  const [iconOpen, setIconOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    if (ref.current && value !== lastSerialized.current) {
      ref.current.innerHTML = markupToHtml(value);
      lastSerialized.current = value;
    }
  }, [value]);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (sel.rangeCount && ref.current && ref.current.contains(sel.anchorNode) && document.activeElement === ref.current) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  const serialize = () => {
    if (!ref.current) return;
    const markup = nodeToMarkup(ref.current).replace(/^\n/, '').replace(/\n$/, '');
    lastSerialized.current = markup;
    onChange(markup);
  };

  const handleBlur = () => {
    if (!ref.current) return;
    let markup = nodeToMarkup(ref.current).replace(/^\n/, '').replace(/\n$/, '');
    if (autoFormat) {
      const iw = iconWords && iconWords.length ? iconWords : null;
      const kw = keywords && keywords.length ? keywords.map((k) => k.word || k).filter(Boolean) : null;
      const caps = capitalized && capitalized.length ? capitalized.map((c) => c.word || c).filter(Boolean) : null;
      if (iw && iw.length) markup = applyIconWordsToAbility(markup, iw);
      if (kw && kw.length) markup = applyKeywordsToAbility(markup, kw);
      if (caps && caps.length) markup = applyCapitalizedToAbility(markup, caps);
      markup = boldColonsInAbility(markup);
      ref.current.innerHTML = markupToHtml(markup);
    }
    lastSerialized.current = markup;
    onChange(markup);
  };

  const restore = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    if (savedRange.current) sel.addRange(savedRange.current);
  };

  const exec = (cmd, val) => { restore(); document.execCommand(cmd, false, val); serialize(); };
  const insertIcon = (url) => {
    restore();
    document.execCommand('insertHTML', false, `<img src="${url}" alt="" style="height:1.35em;vertical-align:middle;display:inline-block" />`);
    serialize();
    setIconOpen(false);
  };
  const applyColor = (hex) => {
    restore();
    const sel = window.getSelection();
    if (!sel.rangeCount) { setColorOpen(false); return; }
    const range = sel.getRangeAt(0);
    if (range.collapsed) { setColorOpen(false); return; }
    const span = document.createElement('span');
    span.style.color = hex;
    span.style.fontFamily = 'CaesarDressing, cursive';
    span.style.fontWeight = 'bold';
    span.appendChild(range.extractContents());
    range.insertNode(span);
    sel.removeAllRanges();
    serialize();
    setColorOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); exec('bold'); }
      else if (k === 'i') { e.preventDefault(); exec('italic'); }
    }
  };

  // Strip all formatting from pasted content so it adopts the editor's uniform
  // font size and never inherits a black color span (which would render as
  // bold + CaesarDressing). Only the explicit black color changer does that.
  const onPaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    const sel = window.getSelection();
    if (!sel.rangeCount || !ref.current) return;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const frag = document.createDocumentFragment();
    text.split('\n').forEach((line, i) => {
      if (i > 0) frag.appendChild(document.createElement('br'));
      frag.appendChild(document.createTextNode(line));
    });
    const last = frag.lastChild;
    range.insertNode(frag);
    const newRange = document.createRange();
    newRange.setStartAfter(last);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    serialize();
  };

  const colors = [
    { name: 'Black', color: '#000000' },
    ...STANDARD_STATS.map((n) => ({ name: n, color: STAT_COLORS[n] })),
    ...folderStats.map((s) => ({ name: s.name, color: s.color })),
  ];

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1 text-neutral-700">
        <Label className="text-xs">Ability</Label>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} title="Bold (Ctrl+B)"><Bold size={14} /></Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} title="Italic (Ctrl+I)"><Italic size={14} /></Button>
        <Popover open={iconOpen} onOpenChange={setIconOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onMouseDown={(e) => e.preventDefault()} title="Insert icon"><ImagePlus size={14} /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" onOpenAutoFocus={(e) => e.preventDefault()}>
            {icons.length === 0 ? (
              <p className="text-xs text-muted-foreground">No icons in this folder. Add some via Icons &amp; Stats.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {icons.map((ic) => (
                  <button key={ic.id} onMouseDown={(e) => e.preventDefault()} onClick={() => insertIcon(ic.url)} className="w-10 h-10 rounded-md border border-border bg-muted/30 flex items-center justify-center hover:border-primary" title={ic.name}>
                    <img src={ic.url} alt={ic.name} className="w-8 h-8 object-contain" />
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onMouseDown={(e) => e.preventDefault()} title="Text color (from stats)"><Palette size={14} /></Button>
          </PopoverTrigger>
          <PopoverContent className="w-40" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => (
                <button key={c.name} onMouseDown={(e) => e.preventDefault()} onClick={() => applyColor(c.color)} className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform" style={{ background: c.color }} title={c.name} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={serialize}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        className="w-full min-h-[96px] bg-white/60 border border-black/10 rounded-md px-2 py-1.5 text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}