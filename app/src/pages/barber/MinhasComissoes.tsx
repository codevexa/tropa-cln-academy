import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { must } from '../../lib/db';
import { useAuth } from '../../auth/AuthProvider';
import { money, dateBR, label, isoDay, startOfMonth } from '../../lib/format';
import { Kpi, Badge, Loading, ErrorBox, Empty, useAsync, Banner } from '../../ui/kit';
import type { CommissionFull } from '../../lib/types';

export default function MinhasComissoes() {
  const { barber } = useAuth();
  const [from, setFrom] = useState(isoDay(startOfMonth(new Date())));
  const [to, setTo] = useState(isoDay(new Date()));

  const list = useAsync(async () => {
    if (!barber) return [];
    return must(supabase.from('commissions')
      .select('*, barbers(id,display_name), ticket_items(description)')
      .eq('barber_id', barber.id)
      .gte('generated_at', from + 'T00:00:00')
      .lte('generated_at', to + 'T23:59:59')
      .order('generated_at', { ascending: false })) as Promise<CommissionFull[]>;
  }, [barber?.id ?? '', from, to]);

  if (!barber) return <Banner tone="warn">Login sem barbeiro vinculado.</Banner>;

  const rows = list.data ?? [];
  const pend = rows.filter((c) => c.status === 'pendente').reduce((a, c) => a + Number(c.amount), 0);
  const paid = rows.filter((c) => c.status === 'paga').reduce((a, c) => a + Number(c.amount), 0);
  const base = rows.reduce((a, c) => a + Number(c.base_amount), 0);

  return (
    <>
      <div className="grid g4 mb16">
        <Kpi label="Serviços no período" value={String(rows.length)} />
        <Kpi label="Faturado por mim" value={money(base)} hint="valor dos serviços" />
        <Kpi label="A receber" value={money(pend)} tone="gold" />
        <Kpi label="Já recebido" value={money(paid)} tone="ok" />
      </div>

      <div className="row gap8 wrap mb16">
        <input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 170 }} />
        <span className="mut2">até</span>
        <input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 170 }} />
      </div>

      {list.loading && <Loading />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !rows.length && <Empty msg="Nenhuma comissão no período." />}

      {!!rows.length && (
        <div className="tw">
          <table>
            <thead>
              <tr><th>Data</th><th>Serviço</th><th className="num">Valor do serviço</th>
                  <th>Regra</th><th className="num">Minha comissão</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{dateBR(c.generated_at)}</td>
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
    </>
  );
}
