import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import RulesToolbar from './RulesToolbar';
import RulesSection from './RulesSection';
import { useLiveRules } from '@/hooks/useLiveRules';
import { useEditLocks } from '@/hooks/useEditLocks';
import EditingUsersBar from '@/components/folder/EditingUsersBar';

// Rules page with multiple editable sections. The toolbar targets whichever
// section currently has the selection. A plus button at the bottom adds a new
// (empty) section. Sections save live (debounced) and sync across users; a
// section another user is editing is locked (read-only) for everyone else.
export default function RulesEditor({ folderId, backTo }) {
  const { sections, selectedId, selectSection, deselect, updateSection, flushSection, addSection, deleteSection } = useLiveRules(folderId);
  const { toast } = useToast();
  const [icons, setIcons] = useState([]);
  const [saving, setSaving] = useState(false);
  const activeEditor = useRef(null);
  const activeSync = useRef(null);
  const savedRange = useRef(null);
  const savingTimer = useRef(null);
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;

  const onLostLock = useCallback((itemId, userName) => {
    if (selectedIdRef.current === itemId) {
      activeEditor.current?.blur();
      toast({ description: `${userName} took over editing this section` });
    }
  }, [toast]);
  const { isLockedByOther, acquire, release } = useEditLocks(folderId, onLostLock);

  useEffect(() => {
    (async () => {
      try {
        const list = folderId === '__global__'
          ? await base44.entities.FolderIcon.list('-created_date', 500)
          : await base44.entities.FolderIcon.filter({ folder_id: folderId }, '-created_date', 500);
        setIcons(list || []);
      } catch {
        setIcons([]);
      }
    })();
  }, [folderId]);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (sel.rangeCount && activeEditor.current && activeEditor.current.contains(sel.anchorNode)) {
        savedRange.current = sel.getRangeAt(0).cloneRange();
      }
    };
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  // When the page is hidden (tab backgrounded) or unloaded, blur the active
  // section. Its blur handler then flushes the pending save and releases the
  // edit lock — otherwise a tab left open in the background keeps refreshing
  // its lock forever and blocks everyone else from editing that section.
  useEffect(() => {
    const blurActive = () => activeEditor.current?.blur();
    const onVis = () => { if (document.visibilityState === 'hidden') blurActive(); };
    window.addEventListener('pagehide', blurActive);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', blurActive);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const restore = () => {
    activeEditor.current?.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    if (savedRange.current) sel.addRange(savedRange.current);
  };

  const afterExec = () => {
    if (activeSync.current) activeSync.current();
    setSaving(true);
    if (savingTimer.current) clearTimeout(savingTimer.current);
    savingTimer.current = setTimeout(() => setSaving(false), 700);
  };

  const onBold = () => { restore(); document.execCommand('bold'); afterExec(); };
  const onItalic = () => { restore(); document.execCommand('italic'); afterExec(); };
  const onUnderline = () => { restore(); document.execCommand('underline'); afterExec(); };
  const onAlign = (cmd) => {
    restore();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !activeEditor.current) {
      document.execCommand(cmd);
      afterExec();
      return;
    }
    const alignment = cmd === 'justifyLeft' ? 'left' : cmd === 'justifyCenter' ? 'center' : cmd === 'justifyRight' ? 'right' : 'justify';
    // Find the nearest block-level ancestor containing the selection
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    while (node && node !== activeEditor.current && node.nodeType === 1) {
      const tag = node.tagName;
      if (['DIV', 'P', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) break;
      node = node.parentNode;
    }
    if (node && node.nodeType === 1) {
      node.style.textAlign = alignment;
    }
    afterExec();
  };
  const onColor = (c) => { restore(); document.execCommand('foreColor', false, c); afterExec(); };
  const onSetSize = (px) => {
    restore();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) {
      toast({ description: 'Select some text first to change its size.' });
      return;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = px + 'px';
    try {
      range.surroundContents(span);
    } catch {
      // range crosses element boundaries (e.g. spans part of two paragraphs) —
      // surroundContents can't wrap that directly, so lift the selected
      // fragment out and re-insert it inside the span instead.
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
    savedRange.current = newRange.cloneRange();
    afterExec();
  };
  const onInsertIcon = (url, name) => {
    restore();
    document.execCommand('insertHTML', false, `<img src="${url}" alt="${name}" style="height:1.4em;vertical-align:middle" />`);
    afterExec();
  };

  const onActivate = (el, sync) => {
    activeEditor.current = el;
    activeSync.current = sync;
  };

  const handleSectionFocus = async (docId) => {
    if (selectedIdRef.current && selectedIdRef.current !== docId) {
      flushSection(selectedIdRef.current);
      release('rules', selectedIdRef.current);
    }
    selectSection(docId);
    // Don't let someone edit without holding the lock — e.g. when their own
    // user record hasn't loaded yet (acquire no-ops) or another user just took
    // the lock. Blur back out so they don't type into an unprotected section.
    const ok = await acquire('rules', docId);
    if (!ok) {
      activeEditor.current?.blur();
      toast({ description: "Couldn't start editing this section — it may be open elsewhere. Try again." });
    }
  };
  const handleSectionBlur = (docId) => {
    // Only deselect if this section is still the active one. Focus on a new
    // section can fire before blur on the old one; unconditionally deselecting
    // here would clobber the just-selected section, drop its edit lock, and
    // leave it unprotected from remote clobbers.
    if (selectedIdRef.current === docId) deselect();
    release('rules', docId);
    flushSection(docId);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link to={backTo} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-bold font-heading text-foreground flex-shrink-0">Rules</h1>
          <EditingUsersBar />
          <div className="ml-auto">
            <RulesToolbar onBold={onBold} onItalic={onItalic} onUnderline={onUnderline} onSetSize={onSetSize} onColor={onColor} onAlign={onAlign} icons={icons} onInsertIcon={onInsertIcon} />
          </div>
          {saving && <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">Saving…</span>}
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {sections.map((doc) => (
          <RulesSection
            key={doc.id}
            doc={doc}
            lockedBy={isLockedByOther(doc.id)}
            active={doc.id === selectedId}
            onActivate={onActivate}
            onChange={updateSection}
            onFocusSection={handleSectionFocus}
            onBlurSection={handleSectionBlur}
            onDelete={deleteSection}
          />
        ))}
        <button
          onClick={addSection}
          className="w-full h-12 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center"
          title="Add a new rules section"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}