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

/**
 * Trava de sessão própria, no lugar da Web Locks API.
 *
 * Por padrão o supabase-js serializa as operações de auth com
 * `navigator.locks`. Se um detentor da trava some sem liberá-la — aba fechada
 * no meio de um refresh, navegador em modo restrito, webview embutida — a
 * promessa de `getSession()` nunca resolve e o aplicativo fica preso na tela
 * de carregamento, sem erro nenhum no console.
 *
 * Esta fila serializa igual dentro da aba, mas não depende de uma API externa
 * nem trava entre abas: cada operação espera a anterior terminar, e uma falha
 * não bloqueia as seguintes.
 */
let fila: Promise<unknown> = Promise.resolve();
function travaLocal<R>(_nome: string, _tempoLimite: number, fn: () => Promise<R>): Promise<R> {
  const execucao = fila.then(fn, fn);
  fila = execucao.then(() => undefined, () => undefined);
  return execucao;
}

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  key ?? 'anon-key-ausente',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: travaLocal,
    },
  }
);
