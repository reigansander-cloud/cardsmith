import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { toRows, copyFiles, importRows, BASE44_URL_RE } from '@/lib/base44Import';
import { LEGACY_ASSET_URLS } from '@/lib/legacyAssets';

// One-time page: loads the cardsmith-export.json made on the old Base44 site.
export default function AdminImport() {
  const { user, checkUserAuth } = useAuth();
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const say = (line) => setLog((l) => [...l, line]);
  const sayProgress = (label) => (n, total) => setLog((l) => {
    const next = [...l];
    const text = `${label}: ${n} / ${total}`;
    if (next.length && next[next.length - 1].startsWith(`${label}:`)) next[next.length - 1] = text; else next.push(text);
    return next;
  });

  async function run(exp) {
    setBusy(true); setDone(false); setLog([]);
    try {
      let rows = toRows(exp);
      const counts = {};
      rows.forEach((r) => { counts[r.entity] = (counts[r.entity] || 0) + 1; });
      say(`Read ${rows.length} records: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);

      say('Copying the built-in images and font…');
      const assets = await copyFiles(supabase, LEGACY_ASSET_URLS, 'app-assets', sayProgress('Built-in files'));
      if (assets.failed.length) say(`  ${assets.failed.length} built-in files could not be copied.`);

      let text = JSON.stringify(rows);
      const urls = text.match(BASE44_URL_RE) || [];
      say(`Copying ${new Set(urls).size} files you uploaded on Base44…`);
      const files = await copyFiles(supabase, urls, 'imported', sayProgress('Your files'));
      if (files.failed.length) say(`  ${files.failed.length} files could not be copied (their links were left as they were).`);
      text = text.replace(BASE44_URL_RE, (u) => files.map[u] || u);
      rows = JSON.parse(text);

      say('Saving records…');
      const n = await importRows(supabase, rows, sayProgress('Records'));
      say(`Done: ${n} records imported.`);
      if (exp.problems?.length) say(`Note: the export reported problems with: ${exp.problems.join('; ')}`);
      window.__cardsmithImportResult = { ok: true, records: n, assetFailures: assets.failed, fileFailures: files.failed };
      setDone(true);
      checkUserAuth();
    } catch (err) {
      say(`Stopped: ${err.message || err}`);
      window.__cardsmithImportResult = { ok: false, error: err.message || String(err) };
    }
    setBusy(false);
  }

  // Lets the import be started from a script as well as the file picker.
  window.cardsmithImport = run;

  // The old site (opened as window.opener, or opening this page) can hand
  // its export over directly: it waits for "ready", then posts the data.
  // Only accepted from the old CardSmith site, and only by an admin.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (user?.role !== 'admin') return undefined;
    const onMessage = (e) => {
      if (!/^https:\/\/[a-z0-9-]+\.base44\.app$/.test(e.origin)) return;
      if (e.data?.type === 'cardsmith-export' && e.data.payload?.entities) runRef.current(e.data.payload);
    };
    window.addEventListener('message', onMessage);
    try { window.opener?.postMessage({ type: 'cardsmith-import-ready' }, '*'); } catch { /* no opener */ }
    return () => window.removeEventListener('message', onMessage);
  }, [user?.role]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { run(JSON.parse(await file.text())); }
    catch { say('That file is not a CardSmith export (cardsmith-export.json).'); }
  }

  if (user?.role !== 'admin') {
    return <div className="p-8 text-foreground">Only an admin can import data.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-2">Import from Base44</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose the cardsmith-export.json file downloaded from the old site. Records keep their ids, so
        running it again updates instead of duplicating.
      </p>
      <input type="file" accept=".json,application/json" onChange={onFile} disabled={busy} className="mb-6 block" />
      <pre className="text-xs bg-muted p-4 rounded whitespace-pre-wrap min-h-[6rem]">{log.join('\n') || 'Waiting for a file…'}</pre>
      {done && <Button asChild className="mt-6"><Link to="/clans">Open Clans</Link></Button>}
    </div>
  );
}
