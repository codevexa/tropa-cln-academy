import { useEffect, useState, useCallback, type ReactNode, type FormEvent } from 'react';
import { IcX, IcAlert, IcInfo } from './icons';

/* ----------------------------------------------------------- Modal ----- */
export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="ovl" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Fechar"><IcX /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Field ----- */
export function Field({ label, children, full, hint }: {
  label: string; children: ReactNode; full?: boolean; hint?: string;
}) {
  return (
    <div className={'field' + (full ? ' full' : '')}>
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ----------------------------------------------------------- Badge ----- */
const TONE: Record<string, string> = {
  aguardando: '', confirmado: 'info', em_atendimento: 'gold', concluido: 'ok', cancelado: 'bad',
  aberta: 'info', fechada: 'ok', cancelada: 'bad', aberto: 'ok', fechado: '',
  pendente: 'warn', parcial: 'warn', quitado: 'ok', paga: 'ok',
  ativo: 'ok', esgotado: '', expirado: 'bad',
};
export function Badge({ value, text, tone }: { value?: string; text?: string; tone?: string }) {
  const t = tone ?? (value ? TONE[value] ?? '' : '');
  return <span className={'bdg ' + t}><i className="dot" />{text ?? value}</span>;
}

/* ------------------------------------------------------------ KPI ------ */
export function Kpi({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'gold' | 'ok' | 'bad';
}) {
  return (
    <div className={'kpi ' + (tone ?? '')}>
      <p>{label}</p><b className="tnum">{value}</b>{hint && <small>{hint}</small>}
    </div>
  );
}

/* --------------------------------------------------------- feedback ---- */
export const Loading = () => <div className="spin" aria-label="Carregando" />;

/** Esqueleto de lista/tabela: algumas barras no lugar das linhas que vêm. */
export const SkeletonTabela = ({ linhas = 6 }: { linhas?: number }) => (
  <div className="sk-tabela" aria-busy="true" aria-label="Carregando">
    <div className="sk" />
    {Array.from({ length: linhas }, (_, i) => <div className="sk" key={i} />)}
  </div>
);

/** Esqueleto de painel: a faixa de indicadores e um bloco de gráfico. */
export const SkeletonCartoes = ({ cartoes = 4, bloco = true }: { cartoes?: number; bloco?: boolean }) => (
  <div aria-busy="true" aria-label="Carregando">
    <div className="sk-cartoes">
      {Array.from({ length: cartoes }, (_, i) => <div className="sk" key={i} />)}
    </div>
    {bloco && <div className="sk sk-bloco" />}
  </div>
);
export const ErrorBox = ({ msg }: { msg: string }) => <div className="err">{msg}</div>;
export const Empty = ({ msg }: { msg: string }) => <div className="empty">{msg}</div>;

export function Banner({ tone, children }: { tone?: 'warn' | 'bad'; children: ReactNode }) {
  return (
    <div className={'banner' + (tone ? ' ' + tone : '')}>
      {tone ? <IcAlert /> : <IcInfo />}<span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------- data hooks ---- */

/**
 * Cache de leitura compartilhado entre as telas.
 *
 * Antes, `useAsync` não guardava nada: cada montagem era uma busca fria e
 * `setLoading(true)` apagava o que já estava na tela. Trocar a aba de
 * Comandas, mudar o período do Dashboard ou simplesmente voltar para uma
 * tela já vista refazia tudo mostrando um spinner no lugar do conteúdo.
 *
 * A estratégia aqui é stale-while-revalidate com validade zero: o que está
 * em cache aparece na hora E uma nova consulta sempre sai em segundo plano.
 * Então nada fica velho — a diferença em relação a antes é só que o usuário
 * vê o dado anterior enquanto o novo chega, em vez de ver um spinner. Isso
 * também evita precisar invalidar cache depois de gravar: a revalidação de
 * toda montagem já faz esse papel.
 *
 * A chave é o código-fonte da função mais as dependências. Duas telas que
 * fazem exatamente a mesma consulta compartilham a entrada de propósito —
 * é o que tira as buscas repetidas de `barbers` e `services`, pedidas hoje
 * em sete telas diferentes.
 */
interface EntradaCache {
  dados: unknown;
  quando: number;
  voo: Promise<unknown> | null;
}
const cacheLeitura = new Map<string, EntradaCache>();

/**
 * Teto de espera para uma leitura.
 *
 * Sem isto, uma consulta que nunca responde — rede que caiu no meio, conexão
 * presa, banco fora do ar — deixava a tela num esqueleto para sempre, sem
 * erro nenhum. Vinte segundos é folgado para a consulta mais pesada do
 * painel em 4G ruim, e curto o bastante para o usuário saber que deu errado
 * e poder tentar de novo.
 */
const TETO_MS = 20000;

function comTeto<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error('A consulta demorou demais. Verifique sua conexão e tente de novo.')),
      TETO_MS,
    );
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Esquece tudo o que está em cache. Usado no logout. */
export function limparCacheDeLeitura() {
  cacheLeitura.clear();
}

interface EstadoAsync<T> {
  chave: string;
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const chave = fn.toString() + '|' + JSON.stringify(deps);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const inicial = (k: string): EstadoAsync<T> => {
    const g = cacheLeitura.get(k);
    return { chave: k, data: (g?.dados as T) ?? null, loading: g === undefined, error: null };
  };
  const [estado, setEstado] = useState<EstadoAsync<T>>(() => inicial(chave));

  /* Dependências mudaram: reposiciona o estado já neste render, com o que
     houver em cache para a chave nova. É o padrão de estado derivado da
     documentação do React — re-renderiza antes de pintar, sem piscar. */
  let atual = estado;
  if (estado.chave !== chave) {
    atual = inicial(chave);
    setEstado(atual);
  }

  const setData = useCallback((d: T | null) => {
    cacheLeitura.set(chave, { dados: d, quando: Date.now(), voo: null });
    setEstado((e) => (e.chave === chave ? { ...e, data: d, loading: false, error: null } : e));
  }, [chave]);

  useEffect(() => {
    let vivo = true;
    const guardado = cacheLeitura.get(chave);

    // Só mostra spinner quando não há absolutamente nada para mostrar.
    if (guardado === undefined) {
      setEstado((e) => (e.chave === chave && !e.loading ? { ...e, loading: true } : e));
    }

    /* Se já existe uma consulta igual no ar, aproveita a mesma promessa em
       vez de disparar outra — duas telas montando juntas pedem uma vez. */
    const promessa = guardado?.voo ?? comTeto(fn() as Promise<unknown>);
    if (guardado) guardado.voo = promessa;
    else cacheLeitura.set(chave, { dados: undefined, quando: 0, voo: promessa });

    promessa
      .then((d) => {
        const e = cacheLeitura.get(chave);
        if (e) { e.dados = d; e.quando = Date.now(); e.voo = null; }
        if (vivo) setEstado((st) => (st.chave === chave ? { ...st, data: d as T, loading: false, error: null } : st));
      })
      .catch((err: unknown) => {
        const e = cacheLeitura.get(chave);
        if (e) {
          e.voo = null;
          // falha sem nada em cache: tira a entrada vazia para a próxima tentar de novo
          if (e.dados === undefined) cacheLeitura.delete(chave);
        }
        if (vivo) {
          setEstado((st) => (st.chave === chave
            ? { ...st, loading: false, error: err instanceof Error ? err.message : String(err) }
            : st));
        }
      });

    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, nonce]);

  return { data: atual.data, loading: atual.loading, error: atual.error, reload, setData };
}

/** Envolve um submit: trava o botão, captura erro e devolve o estado. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (e: FormEvent | null, job: () => Promise<void>) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try { await job(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }, []);
  return { busy, error, setError, run };
}

/* -------------------------------------------------------- confirmar ---- */
export function Confirm({ title, message, onCancel, onConfirm, danger }: {
  title: string; message: string; onCancel: () => void; onConfirm: () => void; danger?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel} footer={
      <>
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button className={'btn ' + (danger ? 'bad' : 'pri')} onClick={onConfirm}>Confirmar</button>
      </>
    }>
      <p className="mut">{message}</p>
    </Modal>
  );
}
