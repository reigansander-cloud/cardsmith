import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { renderType } from '@/lib/folderPreview';

const PRIMARY = 'hsl(38 80% 55%)';

// Custom tooltip: shows the bucket name, total count, and the individual
// cards (with copy counts) that fall under the hovered bar.
function StatsTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border p-2 text-xs shadow max-w-[220px]" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--popover))' }}>
      <p className="font-semibold text-foreground">{p.name}</p>
      <p className="text-muted-foreground">Count: {p.count}</p>
      {p.cards && p.cards.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {p.cards.map((c, i) => (
            <div key={i} className="text-muted-foreground truncate">{c.name} x{c.copies}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Popup showing the deck's distribution: a cost-value bar graph (excluding
// income/battlefield formats) and a supertype bar graph (all formats).
export default function DeckStatsDialog({ open, onOpenChange, deckEntries, supertypes, folderSpecificNames }) {
  const costData = useMemo(() => {
    const buckets = {};
    (deckEntries || []).forEach((d) => {
      if (!d.entry) return;
      if (folderSpecificNames && folderSpecificNames.has(d.entry.supertype)) return;
      if (d.entry.supertype === 'token' || ['income', 'battlefield'].includes(renderType(d.entry, supertypes))) return;
      const c = d.entry.cost || 0;
      const key = c >= 10 ? '10+' : String(c);
      if (!buckets[key]) buckets[key] = { name: key, count: 0, cards: [] };
      buckets[key].count += (d.copies || 0);
      buckets[key].cards.push({ name: d.entry.name || 'Untitled', copies: d.copies || 0 });
    });
    const order = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];
    return order.filter((k) => buckets[k]).map((k) => buckets[k]);
  }, [deckEntries, supertypes, folderSpecificNames]);

  const supertypeData = useMemo(() => {
    const buckets = {};
    (deckEntries || []).forEach((d) => {
      if (!d.entry) return;
      const k = d.entry.supertype || 'unknown';
      if (!buckets[k]) buckets[k] = { name: k, count: 0, cards: [] };
      buckets[k].count += (d.copies || 0);
      buckets[k].cards.push({ name: d.entry.name || 'Untitled', copies: d.copies || 0 });
    });
    return Object.values(buckets);
  }, [deckEntries]);

  const influenceData = useMemo(() => {
    const buckets = {};
    (deckEntries || []).forEach((d) => {
      if (!d.entry) return;
      if ((d.entry.supertype || '').toLowerCase() !== 'unit') return;
      const inf = (d.entry.influence || '').trim();
      let key;
      if (inf === '' || inf.toLowerCase() === 'x') {
        key = 'X';
      } else {
        const n = Number(inf);
        key = isNaN(n) ? inf : String(n);
      }
      if (!buckets[key]) buckets[key] = { name: key, count: 0, cards: [] };
      buckets[key].count += (d.copies || 0);
      buckets[key].cards.push({ name: d.entry.name || 'Untitled', copies: d.copies || 0 });
    });
    const numericKeys = Object.keys(buckets).filter((k) => k !== 'X' && !isNaN(Number(k))).map(Number).sort((a, b) => a - b);
    const otherKeys = Object.keys(buckets).filter((k) => k !== 'X' && isNaN(Number(k)));
    const order = [...numericKeys.map(String), ...otherKeys, ...(buckets['X'] ? ['X'] : [])];
    return order.map((k) => buckets[k]);
  }, [deckEntries]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deck Stats</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold mb-2">Cost distribution</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={costData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<StatsTooltip />} />
                <Bar dataKey="count" fill={PRIMARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {costData.length === 0 && <p className="text-xs text-muted-foreground">No cost-bearing cards.</p>}
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Supertype distribution</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={supertypeData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<StatsTooltip />} />
                <Bar dataKey="count" fill={PRIMARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {supertypeData.length === 0 && <p className="text-xs text-muted-foreground">No cards in deck.</p>}
          </div>
          <div>
            <p className="text-sm font-semibold mb-2">Influence distribution (Unit)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={influenceData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<StatsTooltip />} />
                <Bar dataKey="count" fill={PRIMARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {influenceData.length === 0 && <p className="text-xs text-muted-foreground">No Unit cards with influence.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}