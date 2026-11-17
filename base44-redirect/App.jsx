// =============================================================================
// LAST step, after the new site works and your data is imported:
// replace src/App.jsx in the OLD Base44 project with this file (paste it in
// the Base44 code editor, or push it to the repo Base44 syncs with), and set
// NEW_SITE below. Anyone opening the old address (including links to a
// specific folder, deck or game) is sent to the same page on the new site.
// =============================================================================
import React, { useEffect } from 'react';

const NEW_SITE = 'https://YOUR-GITHUB-NAME.github.io/cardsmith'; // no trailing slash

// Base44 login/session leftovers that mean nothing on the new site.
const DROP_PARAMS = ['access_token', 'clear_access_token', 'app_id', 'app_base_url', 'functions_version', 'from_url'];

function target() {
  const params = new URLSearchParams(window.location.search);
  DROP_PARAMS.forEach((p) => params.delete(p));
  const q = params.toString();
  return `${NEW_SITE}${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`;
}

export default function App() {
  useEffect(() => { window.location.replace(target()); }, []);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0b0f', color: '#e8e1cf', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>CardSmith has moved</h1>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>Taking you to the new site…</p>
        <a href={target()} style={{ color: '#d4a017' }}>{NEW_SITE.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  );
}
