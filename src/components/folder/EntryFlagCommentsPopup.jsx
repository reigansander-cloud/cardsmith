import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, LogIn, X } from 'lucide-react';
import moment from 'moment';

// Hover-style comments popup triggered by right-clicking a flagged entry's
// flag button in edit mode. Wider than the similarity / unused-name popups
// (w-96) and never truncates comment text.
export default function EntryFlagCommentsPopup({ entry, onClose }) {
  const { isAuthenticated, navigateToLogin, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const listRef = useRef(null);

  const load = async () => {
    if (!entry) { setComments([]); setLoading(false); return; }
    setLoading(true);
    try {
      const list = await base44.entities.EntryComment.filter({ entry_id: entry.id }, 'created_date', 500);
      setComments(list || []);
    } catch {
      setComments([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [entry?.id]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments, loading]);

  const post = async () => {
    const t = text.trim();
    if (!t || !isAuthenticated || posting) return;
    const author = user?.full_name || user?.email || 'Anonymous';
    setPosting(true);
    try {
      const created = await base44.entities.EntryComment.create({
        entry_id: entry.id,
        text: t,
        author_name: author,
        entry_owner_id: entry.created_by_id,
      });
      setComments((prev) => [...prev, created]);
      setText('');
    } catch {}
    setPosting(false);
  };

  return (
    <div className="w-96 max-h-[60vh] flex flex-col rounded-md border border-border bg-popover shadow-xl">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="text-xs font-semibold text-foreground">
          Review comments ({comments.length})
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="Close">
          <X size={14} />
        </button>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 p-2.5">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{c.author_name || 'Anonymous'}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{moment(c.created_date).format('MMM D, h:mm A')}</span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{c.text}</p>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border p-2.5">
        {isAuthenticated ? (
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
              placeholder="Write a comment…"
              className="h-9 text-sm"
            />
            <Button size="sm" className="h-9 px-3" onClick={post} disabled={!text.trim() || posting}>
              <Send size={14} />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={navigateToLogin}>
            <LogIn size={14} className="mr-2" /> Log in to comment
          </Button>
        )}
      </div>
    </div>
  );
}