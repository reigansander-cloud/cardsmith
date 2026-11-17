import React from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

export default function CardGrid({ cards, onOpen, onDelete }) {
  if (!cards || cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">No cards in this tab yet.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => onOpen(card)}
          className="group relative rounded-lg overflow-hidden border border-border bg-card hover:border-primary transition-colors cursor-pointer"
        >
          <div className="aspect-[2.5/3.5] bg-muted/30 flex items-center justify-center overflow-hidden">
            {card.png_url ? (
              <img src={card.png_url} alt={card.name} loading="lazy" className="w-full h-full object-contain" draggable={false} />
            ) : (
              <span className="text-xs text-muted-foreground">No preview</span>
            )}
          </div>
          <div className="p-2">
            <p className="text-xs font-medium truncate">{card.name}</p>
            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {card.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] bg-muted text-muted-foreground border border-border">{t}</span>
                ))}
              </div>
            )}
          </div>
          {card.needs_review && (
            <div className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground rounded-full p-1" title="Needs review">
              <AlertCircle size={12} />
            </div>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(card); }}
              className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
              title="Delete card"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}