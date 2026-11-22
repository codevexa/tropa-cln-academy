/**
 * Orçamento de desempenho do painel.
 *
 * Roda contra o build (`npm run build` e depois `npm run preview`), num
 * celular simulado com Slow 4G e CPU 4x mais lenta — não na máquina de quem
 * desenvolve, com fibra e desktop, onde tudo parece rápido.
 *
 *   node e2e/desempenho.mjs [url]
 *
 * Sai com código 1 se algum limite for estourado, para poder entrar em CI.
 * Os limites abaixo têm folga sobre o que foi medido quando foram escritos;
 * se um deles estourar, é porque alguma coisa regrediu de verdade.
 *
 * Para medir também as telas internas, defina QA_EMAIL e QA_SENHA de um
 * usuário de teste. Sem isso, mede só a tela de login e o tamanho do pacote.
 */
import pw from '/opt/node-tools/node_modules/playwright/index.js';

const { chromium } = pw;
const URL_BASE = process.argv[2] ?? 'http://localhost:4173';
const EMAIL = process.env.QA_EMAIL;
const SENHA = process.env.QA_SENHA;

const LIMITES = {
  jsCriticoKB: 110,   // JS baixado antes de qualquer interação
  lcpMs: 2000,
  clsMax: 0.02,
  tbtMs: 300,
  segundaVisitaMs: 600, // voltar a uma tela já vista deve vir do cache
};

let falhas = 0;
function conferir(nome, valor, limite, unidade = '') {
  const ok = valor <= limite;
  if (!ok) falhas++;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nome.padEnd(34)} ` +
              `${String(valor).padStart(7)}${unidade}  (limite ${limite}${unidade})`);
}

const navegador = await chromium.launch({ args: ['--no-sandbox'] });
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
});
const pagina = await contexto.newPage();
const cdp = await contexto.newCDPSession(pagina);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await pagina.addInitScript(() => {
  window.__m = {};
  const obs = (type, fn) => {
    try { new PerformanceObserver((l) => fn(l.getEntries())).observe({ type, buffered: true }); } catch { /* sem suporte */ }
  };
  obs('largest-contentful-paint', (es) => { for (const e of es) window.__m.lcp = Math.round(e.startTime); });
  let c = 0;
  obs('layout-shift', (es) => {
    for (const e of es) if (!e.hadRecentInput) c += e.value;
    window.__m.cls = Math.round(c * 10000) / 10000;
  });
  let t = 0;
  obs('longtask', (es) => { for (const e of es) t += e.duration - 50; window.__m.tbt = Math.round(t); });
});

console.log(`\n═══ ORÇAMENTO DE DESEMPENHO — ${URL_BASE} ═══`);
console.log('    celular, Slow 4G (150 ms de latência, 1,6 Mbps), CPU 4x mais lenta\n');

await pagina.goto(URL_BASE + '/', { waitUntil: 'load' });
await pagina.waitForTimeout(6000);

const m = await pagina.evaluate(() => {
  const recursos = performance.getEntriesByType('resource');
  return {
    ...window.__m,
    jsKB: Math.round(recursos.filter((r) => /\.js(\?|$)/.test(r.name))
      .reduce((a, r) => a + r.transferSize, 0) / 1024),
  };
});

console.log('TELA DE LOGIN');
conferir('JS no caminho crítico', m.jsKB, LIMITES.jsCriticoKB, 'KB');
conferir('LCP', m.lcp ?? 99999, LIMITES.lcpMs, 'ms');
conferir('CLS', m.cls ?? 0, LIMITES.clsMax);
conferir('tempo bloqueando a thread', m.tbt ?? 0, LIMITES.tbtMs, 'ms');

if (EMAIL && SENHA) {
  await pagina.fill('input[type=email]', EMAIL);
  await pagina.fill('input[type=password]', SENHA);
  await pagina.click('.login-card .btn');
  const entrou = await pagina.waitForSelector('.shell', { timeout: 40000 })
    .then(() => true).catch(() => false);
  if (!entrou) {
    console.log('\n  \x1b[31m✗\x1b[0m o login de teste não entrou no painel');
    falhas++;
  } else {
    console.log('\nVOLTA A UMA TELA JÁ VISITADA (deve sair do cache)');
    for (const rota of ['/agenda', '/clientes', '/comandas']) {
      for (const volta of [false, true]) {
        await pagina.evaluate(() => { window.location.hash = '#/__limpa'; });
        await pagina.waitForTimeout(400);
        const t0 = Date.now();
        await pagina.evaluate((h) => { window.location.hash = h; }, '#' + rota);
        let ms = null;
        for (let i = 0; i < 48; i++) {
          await pagina.waitForTimeout(200);
          const st = await pagina.evaluate(() => ({
            carregando: !!document.querySelector('.spin') || !!document.querySelector('.sk'),
            n: (document.querySelector('.content')?.innerText ?? '').trim().length,
          }));
          if (!st.carregando && st.n > 30) { ms = Date.now() - t0; break; }
        }
        if (volta) conferir(rota, ms ?? 99999, LIMITES.segundaVisitaMs, 'ms');
      }
    }
  }
} else {
  console.log('\n  (defina QA_EMAIL e QA_SENHA para medir também as telas internas)');
}

await navegador.close();
console.log(falhas
  ? `\n\x1b[31m${falhas} limite(s) estourado(s)\x1b[0m\n`
  : '\n\x1b[32mTodos os limites respeitados\x1b[0m\n');
process.exit(falhas ? 1 : 0);
