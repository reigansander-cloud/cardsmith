import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { applyKeywordsToAbility, applyCapitalizedToAbility } from '@/lib/abilityMarkup';
import { STAT_COLORS } from '@/lib/folderPreview';

// Splits pasted text into entries (separated by 2+ blank lines) and each
// entry into sections (separated by a single blank line). Within a section,
// newlines are preserved (e.g. multi-line ability text).
function splitEntries(text) {
  const lines = text.split('\n');
  const entries = [];
  let entry = [];
  let section = [];
  let blankCount = 0;
  const flushSection = () => {
    if (section.length) {
      entry.push(section.join('\n').trim());
      section = [];
    }
  };
  const flushEntry = () => {
    flushSection();
    if (entry.length) { entries.push(entry); entry = []; }
  };
  for (const line of lines) {
    if (line.trim() === '') {
      flushSection();
      blankCount++;
      if (blankCount >= 2) flushEntry();
    } else {
      blankCount = 0;
      section.push(line);
    }
  }
  flushEntry();
  return entries;
}

// Parses one entry's sections into a CardEntry payload.
// Section order: Influence, Name, Ability, Amr stat, Subtype.
// If the first section is 4+ characters, it's treated as the card name and
// influence is left blank (useful for instants).
function parseEntry(sections, activeTab, tokenType, folderId, keywords, capitalized) {
  if (sections.length < 2) return null;
  let influence = '';
  let name = '';
  let rest;
  if (sections[0].trim().length >= 4) {
    name = sections[0].trim();
    rest = sections.slice(1);
  } else {
    influence = sections[0].trim();
    name = sections[1] ? sections[1].trim() : '';
    rest = sections.slice(2);
  }
  let ability = '';
  let strStat = '';
  let subtype = '';
  let fabled = false;
  if (rest.length >= 1) {
    ability = rest[0].trim();
    let i = 1;
    // A would-be stat longer than 2 characters is just more ability text that
    // happened to be separated by a blank line; keep absorbing those until we
    // reach a real stat candidate or the final section (which may be the subtype).
    while (i < rest.length - 1 && rest[i].trim().length > 2) {
      ability += '\n\n' + rest[i].trim();
      i++;
    }
    if (i < rest.length) {
      const cur = rest[i].trim();
      if (cur.length > 0 && cur.length <= 2) {
        strStat = cur;
        i++;
        if (i < rest.length) subtype = rest[i].trim();
      } else {
        subtype = cur;
      }
    }
  }
  // "Fabled" anywhere in the subtype line toggles the fabled flag.
  if (subtype && /\bfabled\b/i.test(subtype)) {
    fabled = true;
    subtype = subtype.replace(/\bfabled\b/i, '').replace(/^[-\s]+|[-\s]+$/g, '').trim();
  }
  subtype = subtype.includes('-') ? subtype.split('-').slice(1).join('-').trim() : '';
  ability = applyKeywordsToAbility(ability, keywords);
  ability = applyCapitalizedToAbility(ability, capitalized);
  const stats = strStat ? [{ name: 'Amr', value: strStat, color: STAT_COLORS.Amr }] : [];
  return {
    folder_id: folderId,
    name: name || '',
    cost: 0,
    cost_icons: [],
    influence,
    ability,
    subtype,
    supertype: activeTab === 'token' ? 'token' : activeTab,
    token_type: activeTab === 'token' ? tokenType : 'permanent',
    stats,
    fabled,
    needs_review: false,
  };
}

export function parseBulkEntries(text, activeTab, tokenType, folderId, keywords, capitalized) {
  const entries = splitEntries(text);
  return entries.map((s) => parseEntry(s, activeTab, tokenType, folderId, keywords, capitalized)).filter(Boolean);
}

export default function BulkEntryDialog({ open, onOpenChange, activeTab, tokenType, folderId, keywords, capitalized, onConvert }) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);

  const handleConvert = () => {
    const entries = parseBulkEntries(text, activeTab, tokenType, folderId, keywords, capitalized);
    if (!entries.length) return;
    onConvert(entries);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk add entries</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Separate each section (Influence, Name, Ability, Amr stat, Subtype) with a blank line,
          and separate multiple entries with two blank lines. If the first line is 4+ characters
          it's treated as the card name with no influence (good for instants). The part before the
          dash in the subtype is dropped (the current tab's supertype replaces it). Include
          "Fabled" anywhere in the subtype line to mark the entry as Fabled. Ability text can span
          multiple paragraphs — a would-be stat longer than 2 characters is treated as more
          ability text, and the next section is checked for the stat instead.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Influence\n\nName\n\nAbility\n\nAmr stat\n\nSupertype - Subtype'}
          className="min-h-[260px] font-mono text-sm"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConvert} disabled={!text.trim()}>Convert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}