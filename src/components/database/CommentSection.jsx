import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { markCardRead } from '@/lib/databaseApi';

export default function CommentSection({ cardId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const listRef = useRef(null);

  const load = async () => {
    const list = await base44.entities.CardComment.filter({ card_id: cardId }, '-created_date', 200);
    setComments(list || []);
    setLoading(false);
    await markCardRead(cardId);
  };

  useEffect(() => {
    setLoading(true);
    load();
    const unsub = base44.entities.CardComment.subscribe((event) => {
      if (event && event.data && event.data.card_id === cardId) {
        load();
      }
    });
    return unsub;
     
  }, [cardId]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await base44.entities.CardComment.create({ card_id: cardId, text: trimmed });
      setText('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px] max-h-[400px]">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Start the discussion.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-muted/30 p-2">
              <p className="text-xs text-muted-foreground mb-0.5">
                {c.created_by_name || 'User'} · {new Date(c.created_date).toLocaleString()}
              </p>
              <p className="text-sm whitespace-pre-wrap break-words">{c.text}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Write a comment…"
          className="bg-muted/30 border-border h-9"
        />
        <Button size="sm" onClick={submit} disabled={posting || !text.trim()}>
          <Send size={14} />
        </Button>
      </div>
    </div>
  );
}