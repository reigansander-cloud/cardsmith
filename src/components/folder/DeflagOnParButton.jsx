import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { FlagOff, Loader2 } from 'lucide-react';

// De-flags every entry whose most recent AI review says "About On Par" in its
// first line. The work happens server-side (all comments are scanned across
// folders), then the review list is reloaded.
export default function DeflagOnParButton({ onDone }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('DeflagOnParReviews', {});
      const updated = res.data?.updated || 0;
      toast({
        description: updated === 0
          ? 'No flagged entries say "About On Par".'
          : `De-flagged ${updated} ${updated === 1 ? 'entry' : 'entries'} saying "About On Par".`,
      });
      await onDone?.();
    } catch {
      toast({ description: 'Could not de-flag those entries. Try again.' });
    }
    setBusy(false);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      onClick={run}
      disabled={busy}
      title='De-flag every entry whose AI review says "About On Par"'
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <FlagOff size={14} />}
      De-flag "About On Par"
    </Button>
  );
}