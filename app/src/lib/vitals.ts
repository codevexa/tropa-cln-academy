/**
 * Coleta das métricas de experiência (Web Vitals), sem dependência nova.
 *
 * A biblioteca `web-vitals` do Google resolve casos de borda que aqui não
 * pesam (bfcache, atribuição de INP, janelas de sessão do CLS). Para o que o
 * painel precisa — saber se uma tela ficou lenta e quanto — as APIs nativas
 * do navegador bastam, e assim não entra pacote novo no build.
 *
 * NÃO há servidor para onde mandar isto. Os números ficam no console e em
 * `window.__diamondVitals`, para quem abrir as ferramentas do navegador. Se
 * um dia fizer sentido acompanhar isso ao longo do tempo, é aqui que entra o
 * envio — e aí vale decidir para onde, porque guardar no próprio Supabase
 * significa uma escrita por carregamento de página.
 */

export interface Vitais {
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  inp?: number;
}

declare global {
  interface Window {
    __diamondVitals?: Vitais;
  }
}

const arredonda = (n: number) => Math.round(n * 1000) / 1000;

export function medirVitais() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  if (window.__diamondVitals) return; // já instalado

  const v: Vitais = {};
  window.__diamondVitals = v;

  const observa = (type: string, fn: (e: PerformanceEntry[]) => void) => {
    try {
      new PerformanceObserver((lista) => fn(lista.getEntries())).observe({ type, buffered: true });
    } catch {
      /* navegador sem suporte a este tipo: segue sem ele */
    }
  };

  // tempo até o primeiro byte
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav) v.ttfb = arredonda(nav.responseStart - nav.requestStart);

  observa('paint', (es) => {
    for (const e of es) if (e.name === 'first-contentful-paint') v.fcp = arredonda(e.startTime);
  });

  observa('largest-contentful-paint', (es) => {
    for (const e of es) v.lcp = arredonda(e.startTime);
  });

  let cls = 0;
  observa('layout-shift', (es) => {
    for (const e of es) {
      const ls = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
      if (!ls.hadRecentInput) cls += ls.value;
    }
    v.cls = arredonda(cls);
  });

  // INP aproximado: a pior interação observada
  let pior = 0;
  observa('event', (es) => {
    for (const e of es) {
      const ev = e as PerformanceEntry & { interactionId?: number };
      if (ev.interactionId && e.duration > pior) {
        pior = e.duration;
        v.inp = arredonda(pior);
      }
    }
  });

  /* Relata uma vez quando a aba sai de vista, que é quando os números já
     estão fechados. `visibilitychange` é mais confiável que `unload`. */
  const relatar = () => {
    if (document.visibilityState !== 'hidden') return;
    document.removeEventListener('visibilitychange', relatar);
    // eslint-disable-next-line no-console
    console.info('[Diamond] métricas desta visita:', { ...v });
  };
  document.addEventListener('visibilitychange', relatar);
}
