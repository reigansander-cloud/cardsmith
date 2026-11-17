// =============================================================================
// Step 1 of moving off Base44: download all your data.
//
// 1. Open your CURRENT CardSmith site (the Base44 one) and log in as an admin.
// 2. Open the browser console: F12 (or Cmd+Option+J on a Mac) -> "Console".
// 3. Paste this whole file and press Enter. (Chrome may ask you to type
//    "allow pasting" first.)
// 4. Wait. It lists each table as it goes and then downloads
//    cardsmith-export.json. Put that file in the project's migration/ folder.
//
// It only READS your data; nothing on Base44 is changed.
// =============================================================================
(async () => {
  const ENTITIES = [
    'User', 'Folder', 'FolderSupertype', 'FolderIcon', 'FolderIconWord', 'FolderKeyword',
    'FolderCapitalized', 'FolderName', 'FolderStat', 'CardEntry', 'Card', 'CardVersion',
    'CardComment', 'EntryComment', 'CommentRead', 'CostSymbol', 'DatabaseCard', 'Deck',
    'DeckSetting', 'DeletedEntry', 'Font', 'Game', 'Icon', 'RulesDoc', 'SevenWondersAbilityIcon',
    'SevenWondersBanner', 'SevenWondersBase', 'SevenWondersColor', 'SevenWondersCostIcon',
    'TacticalIcon', 'Tag', 'UploadedIcon', 'EditLock',
  ];
  const PAGE = 500;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let appId = localStorage.getItem('base44_app_id');
  if (!appId) appId = prompt('Could not find the app id automatically. Paste your Base44 app id:');
  const token = localStorage.getItem('base44_access_token') || localStorage.getItem('token');
  if (!appId) { console.error('No app id, stopping.'); return; }
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  async function getPage(entity, skip) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await fetch(`/api/apps/${appId}/entities/${entity}?sort=created_date&limit=${PAGE}&skip=${skip}`, { headers });
      if (res.ok) return res.json();
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      throw new Error(`${entity}: HTTP ${res.status} ${await res.text().catch(() => '')}`);
    }
    throw new Error(`${entity}: kept getting rate-limited, try again in a minute`);
  }

  const out = { exported_at: new Date().toISOString(), app_id: appId, entities: {}, problems: [] };
  for (const entity of ENTITIES) {
    const rows = [];
    try {
      for (let skip = 0; ; skip += PAGE) {
        const page = await getPage(entity, skip);
        if (!Array.isArray(page)) throw new Error(`${entity}: unexpected response`);
        rows.push(...page);
        if (page.length < PAGE) break;
        await sleep(300);
      }
      console.log(`%c${entity}: ${rows.length}`, 'color:#d4a017');
    } catch (err) {
      console.warn(`Problem with ${entity}:`, err.message);
      out.problems.push(`${entity}: ${err.message}`);
    }
    out.entities[entity] = rows;
    await sleep(300);
  }

  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cardsmith-export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  const total = Object.values(out.entities).reduce((n, r) => n + r.length, 0);
  console.log(`%cDone: ${total} records downloaded as cardsmith-export.json`, 'font-weight:bold;color:#d4a017');
  if (out.problems.length) console.warn('Some tables had problems (see above):', out.problems);
})();
