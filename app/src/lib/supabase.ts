import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true quando as variáveis de ambiente ainda não foram preenchidas. */
export const supabaseConfigured = Boolean(url && key && !url.includes('SEU-PROJETO'));

if (!supabaseConfigured) {
  console.warn(
    '[Diamond] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. ' +
    'Copie app/.env.example para app/.env e preencha com os dados do projeto.'
  );
}

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  key ?? 'anon-key-ausente',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
);
