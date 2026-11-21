/**
 * Teste de renderização: percorre todas as telas do painel como PROPRIETÁRIO e
 * como BARBEIRO, com a rede interceptada por fixtures. Falha se qualquer página
 * lançar erro de runtime ou ficar em branco.
 */
import pw from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFileSync } from 'node:fs';
import { TABLES, OWNER, BARBER_PROFILE } from './fixtures.mjs';

/* O supabase-js deriva a chave de sessão do hostname do projeto
   (sb-<ref>-auth-token). Lemos o .env para o teste acompanhar qualquer
   troca de projeto em vez de depender de uma chave fixa. */
function storageKey() {
  let url = 'http://localhost:54321';
  for (const f of ['.env', '.env.production']) {
    try {
      const m = /^VITE_SUPABASE_URL=(.+)$/m.exec(readFileSync(new URL(f, import.meta.url).pathname.replace('/e2e/', '/'), 'utf8'));
      if (m) { url = m[1].trim(); break; }
    } catch { /* arquivo ausente: usa o padrão */ }
  }
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
}
const SB_KEY = storageKey();

const BASE = 'http://localhost:4178';
const OWNER_ROUTES = [
  ['/', 'Dashboard'], ['/agenda', 'Agenda'], ['/caixa', 'Caixa'], ['/comandas', 'Comandas'],
  ['/clientes', 'Clientes'], ['/servicos', 'Serviços'], ['/profissionais', 'Profissionais'],
  ['/pacotes', 'Pacotes'], ['/comissoes', 'Comissões'], ['/fiados', 'Fiados'],
  ['/despesas', 'Despesas'], ['/relatorios', 'Relatórios'], ['/estoque', 'Produtos'],
  ['/fornecedores', 'Fornecedores'], ['/config', 'Configurações'],
];
const BARBER_ROUTES = [
  ['/', 'Resumo'], ['/minha-agenda', 'Minha agenda'], ['/meus-clientes', 'Meus clientes'],
  ['/minhas-comissoes', 'Minhas comissões'], ['/disponibilidade', 'Disponibilidade'],
];

function session(profile) {
  return {
    access_token: 'fixture-token', token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fixture-refresh',
    user: { id: profile.id, aud: 'authenticated', role: 'authenticated', email: profile.email,
            app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
}

/** Responde como o PostgREST: filtra por id/eq quando a query pede. */
function handleRest(url, headers, who) {
  const path = url.pathname.replace('/rest/v1/', '');
  const [table] = path.split('?');
  let rows = TABLES[table] ? [...TABLES[table]] : [];

  for (const [key, raw] of url.searchParams.entries()) {
    if (['select', 'order', 'limit', 'offset', 'or'].includes(key)) continue;
    const m = /^(eq|in|gte|lte|neq|not|is)\.(.*)$/.exec(raw);
    if (!m) continue;
    const [, op, val] = m;
    if (op === 'eq') rows = rows.filter((r) => String(r[key]) === val);
    if (op === 'neq') rows = rows.filter((r) => String(r[key]) !== val);
    if (op === 'in') {
      const set = val.replace(/[()]/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
      rows = rows.filter((r) => set.includes(String(r[key])));
    }
  }
  if (table === 'profiles' && who) rows = rows.filter((r) => r.id === who.id);

  const wantsObject = (headers['accept'] ?? '').includes('vnd.pgrst.object');
  if (wantsObject) return rows[0] ?? null;
  return rows;
}

async function run(profile, routes, tag, viewport, shots) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: viewport.width < 700, hasTouch: viewport.width < 700 });
  const sess = session(profile);
  // navigator.locks fica DISPONÍVEL de propósito: o app agora usa trava própria
  // (src/lib/supabase.ts) e não pode mais depender dessa API para não travar.
  await ctx.addInitScript(([key, value]) => {
    try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
  }, [SB_KEY, JSON.stringify(sess)]);

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${tag} PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (t.includes('favicon') || t.includes('Failed to load resource')) return;
    errors.push(`${tag} CONSOLE: ${t}`);
  });

  await page.route('**/auth/v1/**', async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith('/user')) {
      return route.fulfill({ json: sess.user });
    }
    return route.fulfill({ json: sess });
  });
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() !== 'GET') return route.fulfill({ json: [{ id: 'novo' }] });
    const body = handleRest(u, req.headers(), profile);
    return route.fulfill({ status: 200, json: body });
  });

  const results = [];
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  for (const [path, name] of routes) {
    await page.evaluate((h) => { window.location.hash = h; }, `#${path}`);
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const root = document.getElementById('root');
      const main = document.querySelector('.content');
      return {
        text: (main?.innerText ?? '').trim().length,
        title: (document.querySelector('.topbar h1')?.textContent ?? '').trim(),
        denied: (root?.innerText ?? '').includes('Sem permissão'),
        spinner: !!document.querySelector('.spin'),
        hash: window.location.hash,
      };
    });
    results.push({ path, name, ...info });
    if (shots) {
      const file = `${shots}/${tag}-${path.replace(/\//g, '') || 'home'}.png`;
      await page.screenshot({ path: file, fullPage: false });
    }
  }
  await browser.close();
  return { results, errors };
}

const shots = process.argv[2] ?? null;
let fail = 0;
for (const [profile, routes, tag, vp] of [
  [OWNER, OWNER_ROUTES, 'dono', { width: 1440, height: 900 }],
  [BARBER_PROFILE, BARBER_ROUTES, 'barbeiro', { width: 1440, height: 900 }],
  [OWNER, OWNER_ROUTES.slice(0, 6), 'mobile', { width: 390, height: 844 }],
]) {
  const { results, errors } = await run(profile, routes, tag, vp, shots);
  console.log(`\n═══ ${tag.toUpperCase()} (${vp.width}px) ═══`);
  for (const r of results) {
    const ok = r.text > 60 && !r.denied && !r.spinner && r.title.toLowerCase() === r.name.toLowerCase();
    if (!ok) fail++;
    console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${r.name.padEnd(16)} ${String(r.text).padStart(5)} chars  titulo="${r.title}"${r.denied ? ' [SEM PERMISSÃO]' : ''}${r.spinner ? ' [CARREGANDO]' : ''}`);
  }
  for (const e of errors) { console.log(`  \x1b[31m! ${e}\x1b[0m`); fail++; }
}
console.log(fail ? `\n\x1b[31m${fail} problema(s)\x1b[0m` : '\n\x1b[32mTodas as telas renderizaram sem erro\x1b[0m');
process.exit(fail ? 1 : 0);
