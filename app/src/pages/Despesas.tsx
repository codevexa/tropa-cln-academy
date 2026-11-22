import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, dateBR, label, isoDay, startOfMonth } from '../lib/format';
import { Modal, Field, Badge, Kpi, ErrorBox, Empty, useAsync, useSubmit, SkeletonTabela } from '../ui/kit';
import { IcPlus, IcEdit } from '../ui/icons';
import type { ExpenseFull, Expense, PaymentMethod } from '../lib/types';

export default function Despesas() {
  const [from, setFrom] = useState(isoDay(startOfMonth(new Date())));
  const [to, setTo] = useState(isoDay(new Date()));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const list = useAsync(
    () => must(supabase.from('expenses').select('*, expense_categories(id,name)')
      .or(`and(paid_at.gte.${from}T00:00:00,paid_at.lte.${to}T23:59:59),paid_at.is.null`)
      .order('due_date', { ascending: false, nullsFirst: false })
      .limit(300)) as Promise<ExpenseFull[]>,
    [from, to]
  );

  const rows = list.data ?? [];
  const paid = rows.filter((e) => e.paid_at);
  const open = rows.filter((e) => !e.paid_at);

  return (
    <>
      <div className="grid g4 mb16">
        <Kpi label="Pago no período" value={money(paid.reduce((a, e) => a + Number(e.amount), 0))} tone="bad" />
        <Kpi label="Em aberto" value={money(open.reduce((a, e) => a + Number(e.amount), 0))} tone="gold"
             hint={`${open.length} lançamento(s)`} />
        <Kpi label="Lançamentos" value={String(rows.length)} />
        <div className="kpi">
          <p>Ação</p>
          <button className="btn pri block" style={{ marginTop: 4 }} onClick={() => setCreating(true)}>
            <IcPlus />Nova despesa
          </button>
        </div>
      </div>

      <div className="row gap8 wrap mb16">
        <input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 170 }} />
        <span className="mut2">até</span>
        <input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 170 }} />
      </div>

      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !rows.length && <Empty msg="Nenhuma despesa no período." />}

      {!!rows.length && (
        <div className="tw">
          <table>
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th>
                       <th>Pagamento</th><th className="num">Valor</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{e.description}</td>
                  <td className="mut">{e.expense_categories?.name ?? '—'}</td>
                  <td>{e.due_date ? dateBR(e.due_date) : '—'}</td>
                  <td>{e.paid_at ? dateBR(e.paid_at) : '—'}</td>
                  <td className="num">{money(e.amount)}</td>
                  <td><Badge text={e.paid_at ? 'Paga' : 'Em aberto'} tone={e.paid_at ? 'ok' : 'warn'} /></td>
                  <td className="num"><button className="x" onClick={() => setEditing(e)} title="Editar"><IcEdit /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <ExpenseForm expense={editing} onClose={() => { setCreating(false); setEditing(null); }}
                     onDone={() => { setCreating(false); setEditing(null); list.reload(); }} />
      )}
    </>
  );
}

function ExpenseForm({ expense, onClose, onDone }: {
  expense: Expense | null; onClose: () => void; onDone: () => void;
}) {
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(String(expense?.amount ?? ''));
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? '');
  const [dueDate, setDueDate] = useState(expense?.due_date ?? '');
  const [paid, setPaid] = useState(Boolean(expense?.paid_at));
  const [paidAt, setPaidAt] = useState(expense?.paid_at?.slice(0, 10) ?? isoDay(new Date()));
  const [method, setMethod] = useState<PaymentMethod>(expense?.method ?? 'pix');
  const { busy, error, run } = useSubmit();

  const cats = useAsync(
    () => must(supabase.from('expense_categories').select('*').order('name')) as Promise<{ id: string; name: string }[]>, []
  );

  const save = () => run(null, async () => {
    const v = Number(amount.replace(',', '.'));
    if (description.trim().length < 2) throw new Error('Informe a descrição.');
    if (!v || v <= 0) throw new Error('Informe um valor maior que zero.');
    const payload = {
      description: description.trim(), amount: v,
      category_id: categoryId || null, due_date: dueDate || null,
      paid_at: paid ? new Date(paidAt + 'T12:00:00').toISOString() : null,
      method: paid ? method : null,
    };
    const { error: e } = expense
      ? await supabase.from('expenses').update(payload).eq('id', expense.id)
      : await supabase.from('expenses').insert(payload);
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={expense ? 'Editar despesa' : 'Nova despesa'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Descrição" full>
          <input className="inp" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Valor (R$)">
          <input className="inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Categoria">
          <select className="inp" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Vencimento">
          <input className="inp" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Situação">
          <select className="inp" value={paid ? '1' : '0'} onChange={(e) => setPaid(e.target.value === '1')}>
            <option value="0">Em aberto</option><option value="1">Paga</option>
          </select>
        </Field>
        {paid && (
          <>
            <Field label="Data do pagamento">
              <input className="inp" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
            <Field label="Forma">
              <select className="inp" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(['dinheiro', 'pix', 'credito', 'debito'] as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{label(m)}</option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
