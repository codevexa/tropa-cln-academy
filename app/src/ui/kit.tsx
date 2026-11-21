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
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fn()
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e: unknown) => { if (alive) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload, setData };
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
