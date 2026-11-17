import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, LogIn, Trash2 } from 'lucide-react';
import moment from 'moment';

// Comment thread for an entry. Public to read; posting requires login.
// Comments starting with "AI OVERVIEW" are intercepted: they are stored as
// EntryComment records for persistence but filtered from the comment list,
// and their text is surfaced via onAiOverviewChange to replace the evaluation
// panel above.
const AI_PREFIX = 'AI OVERVIEW';
const isAiOverview = (t) => (t || '').trim().toUpperCase().startsWith(AI_PREFIX);

// Renders comment text with *word* → bold. Returns React nodes (no
// dangerouslySetInnerHTML) so user input can't inject markup.
const renderCommentText = (text) => {
  const parts = [];
  const regex = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<strong key={key++} className="font-bold text-foreground">{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : text;
};

export default function EntryCommentSection({ entry, onAiOverviewChange }) {
  const { isAuthenticated, navigateToLogin, user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!entry) { setComments([]); setLoading(false); onAiOverviewChange?.(null); return; }
    setLoading(true);
    try {
      const list = await base44.entities.EntryComment.filter({ entry_id: entry.id }, 'created_date', 500);
      const visible = (list || []).filter((c) => !isAiOverview(c.text));
      setComments(visible);
      const aiOnes = (list || []).filter((c) => isAiOverview(c.text));
      onAiOverviewChange?.(aiOnes.length > 0 ? { id: aiOnes[aiOnes.length - 1].id, text: aiOnes[aiOnes.length - 1].text } : null);
    } catch {
      setComments([]);
      onAiOverviewChange?.(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [entry?.id]);

  const post = async () => {
    const t = text.trim();
    if (!t || !isAuthenticated) return;
    const author = user?.full_name || user?.email || 'Anonymous';
    try {
      const created = await base44.entities.EntryComment.create({
        entry_id: entry.id,
        text: t,
        author_name: author,
        entry_owner_id: entry.created_by_id,
      });
      if (isAiOverview(t)) {
        onAiOverviewChange?.({ id: created.id, text: created.text });
      } else {
        setComments((prev) => [...prev, created]);
      }
      setText('');
    } catch {}
  };

  const deleteComment = async (commentId) => {
    try {
      await base44.entities.EntryComment.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {}
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-medium text-foreground mb-3">Comments ({comments.length})</h3>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-2.5 group">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-foreground">{c.author_name || 'Anonymous'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{moment(c.created_date).format('MMM D, h:mm A')}</span>
                  <button onClick={() => deleteComment(c.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{renderCommentText(c.text)}</p>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border pt-3">
        {isAuthenticated ? (
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
              placeholder="Write a comment…"
              className="h-9 text-sm"
            />
            <Button size="sm" className="h-9" onClick={post} disabled={!text.trim()}>
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