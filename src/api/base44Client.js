// The app's data/auth client. It used to be the Base44 SDK; it is now Supabase
// behind the same `base44.*` calls (see ./compat.js), so nothing else in the
// app had to change. Settings come from .env (see .env.example).
import { createClient } from '@supabase/supabase-js';
import { createBase44Compat } from './compat';
import { appUrl } from '@/lib/appUrl';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config';

const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

if (!url || !key) {
  // Shown in the browser console if the build was made without the settings.
  console.error('CardSmith: the Supabase URL / anon key are not set (src/config.js or .env.local).');
}

export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  realtime: { params: { eventsPerSecond: 20 } },
});

export const base44 = createBase44Compat(supabase, { appUrl });
