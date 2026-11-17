import React, { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { evaluateCard } from '@/lib/cardEvaluation';

// Parses *word* into bold React nodes. Shared with EntryCommentSection so AI
// overview text and comments bold identically.
const renderBold = (text) => {
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

// Shown above the comments section in the review page. Computes the card's
// evaluation value from its cost icons, influence, stats, and keywords, and
// displays "Ability is valued at X".
export default function CardEvaluationPanel({ entry, iconValueMap, keywordEntries, aiOverview, onDeleteAiOverview }) {
  const value = useMemo(
    () => evaluateCard(entry, iconValueMap, keywordEntries),
    [entry, iconValueMap, keywordEntries]
  );

  if (aiOverview) {
    const displayText = aiOverview.replace(/^\s*AI OVERVIEW\s*:?\s*/i, '').trim();
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 mb-3 flex-shrink-0 group">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] uppercase tracking-wider text-primary">AI Overview</div>
          {onDeleteAiOverview && (
            <button onClick={onDeleteAiOverview} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{renderBold(displayText)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 mb-3 flex-shrink-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Evaluation</div>
      <p className="text-sm font-medium text-foreground">
        Ability is valued at <span className="text-primary font-bold text-base">{value}</span>
      </p>
    </div>
  );
}