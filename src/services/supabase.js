// Cliente Supabase do front-end. Usa SOMENTE a chave anon (pública).
// A service_role nunca deve aparecer aqui — operações privilegiadas usam Edge Functions.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && anonKey);

if (!supabaseConfigurado) {
  console.error(
    '[Nasci Imports] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env (veja .env.example).',
  );
}

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'chave-ausente', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
