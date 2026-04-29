import { createClient } from '@supabase/supabase-js';

const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://neccpdfhmfnvyjgyrysy.supabase.co';
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_KTTgVO3mROxubE_A9OQ7Kg_aRrnzPVT';

export const supabase = createClient(SUPA_URL, SUPA_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
