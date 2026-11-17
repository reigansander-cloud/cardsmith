import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// Builds a genuine .xlsx spreadsheet of every card in the folder. Icons are
// reverted to their corresponding words where a mapping exists: in-text
// [icon:url] markers use the folder's icon-words, cost-bar / income / bonus
// icons use the folder icon names. Falls back to the icon name, then blank.

// Plain-text version of an ability: [icon:url] -> word (or icon name, or ''),
// markup tags stripped, newlines collapsed to spaces.
function abilityToText(markup, wordByUrl, nameByUrl) {
  if (!markup) return '';
  let out = markup.replace(/\[icon:([^\]]+)\]/g, (m, url) => wordByUrl[url] || nameByUrl[url] || '');
  out = out
    .replace(/\[\/?(b|i|color:[^\]]+)\]/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return out;
}

function iconLabel(url, nameByUrl) {
  if (!url) return '';
  return nameByUrl[url] || '';
}

function statCell(stats) {
  if (!stats || !stats.length) return '';
  return stats.map((s) => `${s.name || ''} ${s.value || ''}`.trim()).join(', ');
}

function counterpartCell(counterparts) {
  if (!counterparts || !counterparts.length) return '';
  return counterparts.map((cp, i) => cp.name || `Face ${i + 1}`).join(' | ');
}

const HEADERS = [
  'Name', 'Supertype', 'Subtype', 'Cost', 'Cost Icons', 'Influence',
  'Ability', 'Flavor Text', 'Stats', 'Fabled', 'Basic',
  'Income Symbol', 'Bonus', 'Counterparts',
];

export default function ExportFactionButton({ folderId, folderName }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      // Reverse maps for reverting icons to words.
      const [icons, iconWords, entries] = await Promise.all([
        base44.entities.FolderIcon.filter({ folder_id: folderId }, '-created_date', 500),
        base44.entities.FolderIconWord.filter({ folder_id: folderId }, '-created_date', 500),
        loadAllEntries(folderId),
      ]);
      const nameByUrl = {};
      (icons || []).forEach((i) => { if (i.url && !(i.url in nameByUrl)) nameByUrl[i.url] = i.name; });
      const wordByUrl = {};
      (iconWords || []).forEach((iw) => { if (iw.icon_url && !(iw.icon_url in wordByUrl)) wordByUrl[iw.icon_url] = iw.word; });

      const rows = (entries || []).map((e) => [
        e.name || '',
        e.supertype || '',
        e.subtype || '',
        e.cost != null ? Number(e.cost) : '',
        (e.cost_icons || []).map((u) => iconLabel(u, nameByUrl)).filter(Boolean).join(', '),
        e.influence || '',
        abilityToText(e.ability, wordByUrl, nameByUrl),
        e.flavor_text || '',
        statCell(e.stats),
        e.fabled ? 'Yes' : '',
        e.basic ? 'Yes' : '',
        iconLabel(e.income_symbol, nameByUrl),
        e.bonus_mode === 'ability'
          ? abilityToText(e.bonus_ability, wordByUrl, nameByUrl)
          : (e.bonus_cost_icons || []).map((u) => iconLabel(u, nameByUrl)).filter(Boolean).join(', '),
        counterpartCell(e.counterparts),
      ]);

      const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
      ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(10, h.length + 2) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Faction');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(folderName || 'faction').replace(/[^\w\-]+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ description: `Exported ${rows.length} card${rows.length === 1 ? '' : 's'} to Excel.` });
    } catch (err) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="h-8" onClick={run} disabled={busy} title="Download an Excel spreadsheet of every card in this folder">
      {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Download size={14} className="mr-2" />}
      {busy ? 'Exporting…' : 'Export Faction'}
    </Button>
  );
}

// Page through every entry in the folder (cursor form returns a page object).
async function loadAllEntries(folderId) {
  const all = [];
  let cursor;
  while (true) {
    const page = await base44.entities.CardEntry.filter(
      { folder_id: folderId },
      { sort: '-created_date', limit: 500, cursor }
    );
    (page?.items || []).forEach((e) => all.push(e));
    if (!page?.has_more || !page?.next_cursor) break;
    cursor = page.next_cursor;
  }
  return all;
}