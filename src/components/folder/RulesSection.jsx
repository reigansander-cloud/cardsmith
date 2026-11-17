import React, { useRef, useEffect } from 'react';
import { Trash2, Lock } from 'lucide-react';
import { sanitizeRulesHtml } from '@/lib/rulesSanitizer';

// A single editable rules section. Saves its innerHTML live (debounced via
// onChange) and syncs from other users. Reports focus upward so the shared
// toolbar can target it. While another user is editing this section it is
// locked: the surface becomes read-only and shows who is editing.
export default function RulesSection({ doc, lockedBy, active, onActivate, onChange, onFocusSection, onBlurSection, onDelete }) {
  const ref = useRef(null);
  const lastLocalRef = useRef('');
  // Only gate at the moment of entering a section — same as card entries.
  // Once we're the one actively editing it, a later lock event never yanks
  // editability out from under us mid-keystroke.
  const locked = !!lockedBy && !active;

  // initialise innerHTML on mount / when the section record is first loaded
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = doc.content || '';
      lastLocalRef.current = doc.content || '';
    }
     
  }, [doc.id]);

  // apply remote content changes, but never reset the DOM for our own local edits
  useEffect(() => {
    if (!ref.current) return;
    if (doc.content === lastLocalRef.current) return;
    ref.current.innerHTML = doc.content || '';
    lastLocalRef.current = doc.content || '';
  }, [doc.content]);

  const sync = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastLocalRef.current = html;
    onChange(doc.id, html);
  };

  const handleFocus = () => {
    // someone else already holds this section — refuse to enter edit mode,
    // same as clicking a locked card entry does nothing.
    if (lockedBy) { ref.current?.blur(); return; }
    onActivate(ref.current, sync);
    onFocusSection(doc.id);
  };

  const handleBlur = () => {
    onBlurSection(doc.id);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const html = e.clipboardData?.getData('text/html');
    const text = e.clipboardData?.getData('text/plain') || '';
    if (html) {
      document.execCommand('insertHTML', false, sanitizeRulesHtml(html));
    } else if (text) {
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      document.execCommand('insertHTML', false, escaped);
    }
  };

  return (
    <div className="relative group">
      {locked && (
        <div className="mb-2 p-2 rounded-md bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
          <Lock size={12} />
          <span>{lockedBy.userName} is editing this section</span>
        </div>
      )}
      <div
        ref={ref}
        contentEditable={!locked}
        suppressContentEditableWarning
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={sync}
        onPaste={handlePaste}
        className={`min-h-[40vh] bg-[#fafaf7] border border-black/10 rounded-lg p-6 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-ring leading-relaxed text-base ${locked ? 'opacity-60' : ''}`}
        style={{ wordBreak: 'break-word' }}
      />
      <button
        onClick={() => onDelete(doc.id)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-black/5 rounded p-1 transition-opacity"
        title="Delete section"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}