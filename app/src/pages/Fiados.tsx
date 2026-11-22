import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, dateBR, phoneBR, label } from '../lib/format';
import { Modal, Field, Badge, Kpi, ErrorBox, Empty, useAsync, useSubmit, SkeletonTabela } from '../ui/kit';
import { IcPlus } from '../ui/icons';
import type { DebtFull, Client, PaymentMethod } from '../lib/types';

export default function Fiados() {
  const [filter, setFilter] = useState<'abertos' | 'quitados'>('abertos');
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<DebtFull | null>(null);
  const [history, setHistory] = useState<DebtFull | null>(null);

  const list = useAsync(async () => {
    const q = supabase.from('debts').select('*, clients(id,name,phone)')
      .order('origin_date', { ascending: false }).limit(300);
    return must(filter === 'abertos' ? q.in('status', ['pendente', 'parcial']) : q.eq('status', 'quitado')) as Promise<DebtFull[]>;
  }, [filter]);

  const rows = list.data ?? [];
  const aberto = rows.reduce((a, d) => a + (Number(d.original_amount) - Number(d.paid_amount)), 0);

  return (
    <>
      <div className="grid g4 mb16">
        <Kpi label={filter === 'abertos' ? 'Total em aberto' : 'Total quitado'}
             value={money(filter === 'abertos' ? aberto : rows.reduce((a, d) => a + Number(d.original_amount), 0))}
             tone={filter === 'abertos' ? 'bad' : 'ok'} />
        <Kpi label="Registros" value={String(rows.length)} />
        <Kpi label="Clientes" value={String(new Set(rows.map((r) => r.client_id)).size)} />
        <div className="kpi">
          <p>Ação</p>
          <button className="btn pri block" style={{ marginTop: 4 }} onClick={() => setCreating(true)}>
            <IcPlus />Registrar fiado
          </button>
        </div>
      </div>

      <div className="seg mb16">
        <button className={filter === 'abertos' ? 'on' : ''} onClick={() => setFilter('abertos')}>Em aberto</button>
        <button className={filter === 'quitados' ? 'on' : ''} onClick={() => setFilter('quitados')}>Quitados</button>
      </div>

      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !rows.length && <Empty msg="Nenhum fiado neste filtro." />}

      {!!rows.length && (
        <div className="tw">
          <table>
            <thead>
              <tr><th>Cliente</th><th>Telefone</th><th>Origem</th>
                  <th className="num">Valor</th><th className="num">Pago</th>
                  <th className="num">Saldo</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td>{d.clients?.name ?? '—'}</td>
                  <td className="mut">{phoneBR(d.clients?.phone)}</td>
                  <td>{dateBR(d.origin_date)}</td>
                  <td className="num">{money(d.original_amount)}</td>
                  <td className="num">{money(d.paid_amount)}</td>
                  <td className="num">{money(Number(d.original_amount) - Number(d.paid_amount))}</td>
                  <td><Badge value={d.status} text={label(d.status)} /></td>
                  <td className="num">
                    <div className="row gap4" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" onClick={() => setHistory(d)}>Histórico</button>
                      {d.status !== 'quitado' && (
                        <button className="btn sm" onClick={() => setPaying(d)}>Receber</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <NewDebt onClose={() => setCreating(false)} onDone={() => { setCreating(false); list.reload(); }} />}
      {paying && <PayDebt debt={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); list.reload(); }} />}
      {history && <DebtHistory debt={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function NewDebt({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useSubmit();
  const clients = useAsync(
    () => must(supabase.from('clients').select('id,name').order('name').limit(500)) as Promise<Client[]>, []
  );

  const save = () => run(null, async () => {
    const v = Number(amount.replace(',', '.'));
    if (!clientId) throw new Error('Escolha o cliente.');
    if (!v || v <= 0) throw new Error('Informe um valor maior que zero.');
    const { error: e } = await supabase.from('debts')
      .insert({ client_id: clientId, original_amount: v, origin_date: date, notes: notes.trim() || null });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title="Registrar fiado" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Registrar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Cliente" full>
          <select className="inp" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecione</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Valor (R$)">
          <input className="inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Data de origem">
          <input className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Observações" full>
          <textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function PayDebt({ debt, onClose, onDone }: { debt: DebtFull; onClose: () => void; onDone: () => void }) {
  const saldo = Number(debt.original_amount) - Number(debt.paid_amount);
  const [amount, setAmount] = useState(saldo.toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>('dinheiro');
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    const v = Number(amount.replace(',', '.'));
    if (!v || v <= 0) throw new Error('Informe um valor maior que zero.');
    const { error: e } = await supabase.from('debt_payments')
      .insert({ debt_id: debt.id, amount: v, method });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={`Receber — ${debt.clients?.name ?? 'Cliente'}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Registrando…' : 'Registrar recebimento'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Valor" hint={`Saldo em aberto: ${money(saldo)}`}>
          <input className="inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Forma">
          <select className="inp" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(['dinheiro', 'pix', 'credito', 'debito'] as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>{label(m)}</option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function DebtHistory({ debt, onClose }: { debt: DebtFull; onClose: () => void }) {
  const pays = useAsync(
    () => must(supabase.from('debt_payments').select('id,amount,method,paid_at').eq('debt_id', debt.id)
      .order('paid_at', { ascending: false })) as Promise<
        { id: string; amount: number; method: PaymentMethod; paid_at: string }[]>, [debt.id]
  );
  return (
    <Modal title={`Histórico — ${debt.clients?.name ?? 'Cliente'}`} onClose={onClose} footer={
      <button className="btn ghost" onClick={onClose}>Fechar</button>
    }>
      <div className="grid g3 mb16" style={{ gap: 10 }}>
        <Kpi label="Original" value={money(debt.original_amount)} />
        <Kpi label="Pago" value={money(debt.paid_amount)} tone="ok" />
        <Kpi label="Saldo" value={money(Number(debt.original_amount) - Number(debt.paid_amount))} tone="bad" />
      </div>
      {debt.notes && <p className="hint mb16">{debt.notes}</p>}
      {pays.loading && <SkeletonTabela />}
      {!pays.loading && !(pays.data ?? []).length && <Empty msg="Nenhum pagamento registrado." />}
      {!!(pays.data ?? []).length && (
        <div className="tw">
          <table>
            <thead><tr><th>Data</th><th>Forma</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {(pays.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{dateBR(p.paid_at)}</td>
                  <td><Badge text={label(p.method)} tone="info" /></td>
                  <td className="num">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
