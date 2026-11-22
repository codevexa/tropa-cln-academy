import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, dateBR, label } from '../lib/format';
import { Modal, Badge, Kpi, ErrorBox, Empty, useAsync, useSubmit, Banner, Field, SkeletonTabela } from '../ui/kit';
import type { CommissionFull, Barber, PaymentMethod } from '../lib/types';

export default function Comissoes() {
  const [barberId, setBarberId] = useState('');
  const [status, setStatus] = useState<'pendente' | 'paga'>('pendente');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);

  const barbers = useAsync(
    () => must(supabase.from('barbers').select('id,profile_id,display_name,specialty,bio,photo_url,active,order_index').order('order_index')) as Promise<Barber[]>, []
  );
  const list = useAsync(async () => {
    let q = supabase.from('commissions')
      .select('*, barbers(id,display_name), ticket_items(description)')
      .eq('status', status).order('generated_at', { ascending: false }).limit(300);
    if (barberId) q = q.eq('barber_id', barberId);
    return must(q) as Promise<CommissionFull[]>;
  }, [barberId, status]);

  const rows = list.data ?? [];
  const total = rows.reduce((a, c) => a + Number(c.amount), 0);
  const pickedRows = rows.filter((r) => picked.has(r.id));
  const pickedTotal = pickedRows.reduce((a, c) => a + Number(c.amount), 0);
  const pickedBarbers = new Set(pickedRows.map((r) => r.barber_id));

  const toggle = (id: string) => setPicked((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  return (
    <>
      <div className="grid g4 mb16">
        <Kpi label={status === 'pendente' ? 'Pendente no filtro' : 'Pago no filtro'}
             value={money(total)} tone={status === 'pendente' ? 'gold' : 'ok'} />
        <Kpi label="Lançamentos" value={String(rows.length)} />
        <Kpi label="Selecionado" value={money(pickedTotal)} hint={`${pickedRows.length} item(ns)`} />
        <div className="kpi">
          <p>Ação</p>
          <button className="btn gold block" style={{ marginTop: 4 }}
                  disabled={!pickedRows.length || pickedBarbers.size !== 1}
                  onClick={() => setPaying(true)}>
            Registrar repasse
          </button>
          {pickedBarbers.size > 1 && <small>Selecione um profissional por vez.</small>}
        </div>
      </div>

      <div className="row-b wrap mb16">
        <div className="seg">
          <button className={status === 'pendente' ? 'on' : ''} onClick={() => { setStatus('pendente'); setPicked(new Set()); }}>Pendentes</button>
          <button className={status === 'paga' ? 'on' : ''} onClick={() => { setStatus('paga'); setPicked(new Set()); }}>Pagas</button>
        </div>
        <select className="inp" style={{ maxWidth: 240 }} value={barberId}
                onChange={(e) => { setBarberId(e.target.value); setPicked(new Set()); }}>
          <option value="">Todos os profissionais</option>
          {(barbers.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.display_name}</option>)}
        </select>
      </div>

      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !rows.length && (
        <Empty msg={status === 'pendente' ? 'Nenhuma comissão pendente.' : 'Nenhuma comissão paga ainda.'} />
      )}

      {!!rows.length && (
        <div className="tw">
          <table>
            <thead>
              <tr>
                {status === 'pendente' && <th style={{ width: 36 }} />}
                <th>Data</th><th>Profissional</th><th>Serviço</th>
                <th className="num">Base</th><th>Regra</th>
                <th className="num">Comissão</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  {status === 'pendente' && (
                    <td><input type="checkbox" checked={picked.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  )}
                  <td>{dateBR(c.generated_at)}</td>
                  <td>{c.barbers?.display_name ?? '—'}</td>
                  <td className="mut">{c.ticket_items?.description ?? '—'}</td>
                  <td className="num">{money(c.base_amount)}</td>
                  <td className="mut">{c.basis === 'percent' ? `${c.value}%` : money(c.value)}</td>
                  <td className="num">{money(c.amount)}</td>
                  <td><Badge value={c.status} text={label(c.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paying && pickedBarbers.size === 1 && (
        <PayoutModal barberId={[...pickedBarbers][0]} ids={pickedRows.map((r) => r.id)} total={pickedTotal}
                     onClose={() => setPaying(false)}
                     onDone={() => { setPaying(false); setPicked(new Set()); list.reload(); }} />
      )}
    </>
  );
}

function PayoutModal({ barberId, ids, total, onClose, onDone }: {
  barberId: string; ids: string[]; total: number; onClose: () => void; onDone: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [notes, setNotes] = useState('');
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    const { error: e } = await supabase.rpc('pay_commissions', {
      p_barber: barberId, p_ids: ids, p_method: method, p_notes: notes.trim() || null,
    });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title="Registrar repasse de comissão" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>
          {busy ? 'Registrando…' : `Pagar ${money(total)}`}
        </button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <Banner>
        {ids.length} comissão(ões) somando <b>{money(total)}</b>. Depois de repassadas, elas não
        podem ser estornadas pelo cancelamento do pagamento da comanda.
      </Banner>
      <div className="form-grid mt16">
        <Field label="Forma do repasse">
          <select className="inp" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(['dinheiro', 'pix', 'credito', 'debito'] as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>{label(m)}</option>
            ))}
          </select>
        </Field>
        <Field label="Observações">
          <input className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
