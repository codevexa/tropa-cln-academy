import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, dateTimeBR, label, timeBR } from '../lib/format';
import { Modal, Field, Badge, Kpi, ErrorBox, Empty, useAsync, useSubmit, Banner, SkeletonCartoes, SkeletonTabela } from '../ui/kit';
import type { CashSession, Payment, Ticket } from '../lib/types';

interface SessionDetail {
  session: CashSession | null;
  payments: (Payment & { tickets: { code: number } | null })[];
  openTickets: Ticket[];
}

async function loadCurrent(): Promise<SessionDetail> {
  const s = await must(
    supabase.from('cash_sessions').select('id,opened_by,opened_at,opening_amount,closed_by,closed_at,closing_amount,status,notes').eq('status', 'aberto')
      .order('opened_at', { ascending: false }).limit(1).maybeSingle()
  ) as CashSession | null;
  if (!s) return { session: null, payments: [], openTickets: [] };
  const [payments, openTickets] = await Promise.all([
    must(supabase.from('payments').select('*, tickets(code)')
      .eq('cash_session_id', s.id).order('paid_at', { ascending: false })),
    must(supabase.from('tickets').select('id,code,client_id,barber_id,cash_session_id,status,discount,subtotal,total,paid_total,opened_at,closed_at,notes').eq('cash_session_id', s.id).eq('status', 'aberta')),
  ]);
  return {
    session: s,
    payments: payments as SessionDetail['payments'],
    openTickets: openTickets as Ticket[],
  };
}

export default function Caixa() {
  const cur = useAsync(loadCurrent, []);
  const hist = useAsync(
    () => must(supabase.from('cash_sessions').select('id,opened_by,opened_at,opening_amount,closed_by,closed_at,closing_amount,status,notes').eq('status', 'fechado')
      .order('closed_at', { ascending: false }).limit(30)) as Promise<CashSession[]>, []
  );
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);

  const d = cur.data;
  const totals = (d?.payments ?? []).reduce((acc, p) => {
    acc.total += Number(p.amount);
    acc.byMethod[p.method] = (acc.byMethod[p.method] ?? 0) + Number(p.amount);
    return acc;
  }, { total: 0, byMethod: {} as Record<string, number> });
  const expected = Number(d?.session?.opening_amount ?? 0) + (totals.byMethod['dinheiro'] ?? 0);

  return (
    <>
      {cur.loading && <SkeletonCartoes cartoes={4} bloco={false} />}
      {cur.error && <ErrorBox msg={cur.error} />}

      {!cur.loading && !d?.session && (
        <div className="card center" style={{ padding: 40 }}>
          <h2 className="mb16">Caixa fechado</h2>
          <p className="mut mb16">Abra o caixa para registrar atendimentos e pagamentos do dia.</p>
          <button className="btn pri" onClick={() => setOpenModal(true)}>Abrir caixa</button>
        </div>
      )}

      {d?.session && (
        <>
          <div className="row-b wrap mb16">
            <div className="row gap8">
              <Badge value="aberto" text="Caixa aberto" />
              <span className="mut" style={{ fontSize: '.82rem' }}>
                desde {dateTimeBR(d.session.opened_at)}
              </span>
            </div>
            <button className="btn gold" onClick={() => setCloseModal(true)}>Fechar caixa</button>
          </div>

          <div className="grid g4 mb16">
            <Kpi label="Abertura" value={money(d.session.opening_amount)} />
            <Kpi label="Recebido" value={money(totals.total)} tone="gold" />
            <Kpi label="Dinheiro em caixa" value={money(expected)} hint="abertura + dinheiro recebido" />
            <Kpi label="Comandas abertas" value={String(d.openTickets.length)}
                 tone={d.openTickets.length ? 'bad' : undefined}
                 hint={d.openTickets.length ? 'feche antes de encerrar o caixa' : 'tudo fechado'} />
          </div>

          <div className="grid g2 mb16">
            <div className="card">
              <div className="card-h"><h3>Por forma de pagamento</h3></div>
              {Object.keys(totals.byMethod).length === 0
                ? <Empty msg="Nenhum pagamento ainda." />
                : Object.entries(totals.byMethod).map(([m, v]) => (
                    <div className="list-row" key={m}>
                      <span className="grow">{label(m)}</span>
                      <b className="tnum">{money(v)}</b>
                    </div>
                  ))}
            </div>
            <div className="card">
              <div className="card-h"><h3>Comandas abertas</h3></div>
              {d.openTickets.length === 0
                ? <Empty msg="Nenhuma comanda aberta." />
                : d.openTickets.map((t) => (
                    <div className="list-row" key={t.id}>
                      <span className="grow">Comanda #{t.code}</span>
                      <b className="tnum">{money(t.total)}</b>
                    </div>
                  ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Movimento do caixa</h3></div>
            {d.payments.length === 0 ? <Empty msg="Nenhum pagamento registrado." /> : (
              <div className="tw">
                <table>
                  <thead><tr><th>Hora</th><th>Comanda</th><th>Forma</th><th className="num">Valor</th></tr></thead>
                  <tbody>
                    {d.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="tnum">{timeBR(p.paid_at)}</td>
                        <td>#{p.tickets?.code ?? '—'}</td>
                        <td><Badge text={label(p.method)} tone="info" /></td>
                        <td className="num">{money(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div className="card mt24">
        <div className="card-h"><h3>Fechamentos anteriores</h3></div>
        {hist.loading && <SkeletonTabela />}
        {!hist.loading && !(hist.data ?? []).length && <Empty msg="Nenhum caixa fechado ainda." />}
        {!!(hist.data ?? []).length && (
          <div className="tw">
            <table>
              <thead><tr><th>Abertura</th><th>Fechamento</th><th className="num">Inicial</th><th className="num">Contado</th><th>Obs.</th></tr></thead>
              <tbody>
                {(hist.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{dateTimeBR(s.opened_at)}</td>
                    <td>{dateTimeBR(s.closed_at)}</td>
                    <td className="num">{money(s.opening_amount)}</td>
                    <td className="num">{money(s.closing_amount ?? 0)}</td>
                    <td className="mut">{s.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openModal && <OpenModal onClose={() => setOpenModal(false)}
                               onDone={() => { setOpenModal(false); cur.reload(); }} />}
      {closeModal && d?.session && (
        <CloseModal session={d.session} expected={expected} blocked={d.openTickets.length}
                    onClose={() => setCloseModal(false)}
                    onDone={() => { setCloseModal(false); cur.reload(); hist.reload(); }} />
      )}
    </>
  );
}

function OpenModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('0');
  const { busy, error, run } = useSubmit();
  const save = () => run(null, async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error: e } = await supabase.from('cash_sessions')
      .insert({ opened_by: u.user?.id, opening_amount: Number(amount.replace(',', '.')) || 0 });
    if (e) throw new Error(dbError(e));
    onDone();
  });
  return (
    <Modal title="Abrir caixa" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Abrindo…' : 'Abrir caixa'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <Field label="Valor em dinheiro na abertura" hint="Troco inicial da gaveta.">
        <input className="inp" inputMode="decimal" value={amount}
               onChange={(e) => setAmount(e.target.value)} />
      </Field>
    </Modal>
  );
}

function CloseModal({ session, expected, blocked, onClose, onDone }: {
  session: CashSession; expected: number; blocked: number; onClose: () => void; onDone: () => void;
}) {
  const [counted, setCounted] = useState(expected.toFixed(2));
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useSubmit();
  const diff = Number(counted.replace(',', '.')) - expected;

  const save = () => run(null, async () => {
    const { error: e } = await supabase.rpc('close_cash_session', {
      p_session: session.id,
      p_counted: Number(counted.replace(',', '.')) || 0,
      p_notes: notes.trim() || null,
    });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title="Fechar caixa" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy || blocked > 0}>
          {busy ? 'Fechando…' : 'Confirmar fechamento'}
        </button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      {blocked > 0 && (
        <div className="mb16">
          <Banner tone="bad">
            <b>{blocked} comanda(s) ainda aberta(s).</b> Finalize-as em Comandas antes de fechar o caixa.
          </Banner>
        </div>
      )}
      <div className="grid g2 mb16" style={{ gap: 12 }}>
        <Kpi label="Esperado em dinheiro" value={money(expected)} />
        <Kpi label="Diferença" value={money(diff)} tone={Math.abs(diff) < 0.01 ? 'ok' : 'bad'} />
      </div>
      <Field label="Valor contado na gaveta">
        <input className="inp" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} />
      </Field>
      <div className="mt16">
        <Field label="Observações">
          <textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Sangria, quebra de caixa, troca de turno…" />
        </Field>
      </div>
    </Modal>
  );
}
