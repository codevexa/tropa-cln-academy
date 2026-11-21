import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { must } from '../../lib/db';
import { useAuth } from '../../auth/AuthProvider';
import { money, dateBR, phoneBR, num } from '../../lib/format';
import { Kpi, Loading, ErrorBox, Empty, useAsync, Banner } from '../../ui/kit';
import { IcSearch } from '../../ui/icons';
import type { AppointmentFull } from '../../lib/types';

interface Row {
  id: string; name: string; phone: string | null;
  visits: number; total: number; last: string;
}

export default function MeusClientes() {
  const { barber } = useAuth();
  const [q, setQ] = useState('');

  const list = useAsync(async () => {
    if (!barber) return [] as Row[];
    const appts = await must(supabase.from('appointments')
      .select('*, clients(id,name,phone), barbers(id,display_name), services(id,name,duration_min,price)')
      .eq('barber_id', barber.id).eq('status', 'concluido')
      .order('starts_at', { ascending: false }).limit(1000)) as AppointmentFull[];

    const map = new Map<string, Row>();
    for (const a of appts) {
      const c = a.clients;
      if (!c) continue;
      const cur = map.get(c.id) ?? { id: c.id, name: c.name, phone: c.phone, visits: 0, total: 0, last: a.starts_at };
      cur.visits += 1;
      cur.total += Number(a.price);
      if (a.starts_at > cur.last) cur.last = a.starts_at;
      map.set(c.id, cur);
    }
    return [...map.values()].sort((x, y) => y.last.localeCompare(x.last));
  }, [barber?.id ?? '']);

  if (!barber) return <Banner tone="warn">Login sem barbeiro vinculado.</Banner>;

  const rows = (list.data ?? []).filter((r) =>
    !q || `${r.name} ${r.phone ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="grid g3 mb16">
        <Kpi label="Clientes atendidos" value={num((list.data ?? []).length)} />
        <Kpi label="Atendimentos" value={num((list.data ?? []).reduce((a, r) => a + r.visits, 0))} />
        <Kpi label="Faturado por mim" value={money((list.data ?? []).reduce((a, r) => a + r.total, 0))} tone="gold" />
      </div>

      <div className="row gap8 mb16" style={{ maxWidth: 420 }}>
        <IcSearch />
        <input className="inp" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {list.loading && <Loading />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !rows.length && <Empty msg="Você ainda não concluiu atendimentos." />}

      {!!rows.length && (
        <div className="tw">
          <table>
            <thead><tr><th>Cliente</th><th>Telefone</th><th className="num">Atendimentos</th>
                       <th className="num">Faturado</th><th>Último</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mut">{phoneBR(r.phone)}</td>
                  <td className="num">{r.visits}</td>
                  <td className="num">{money(r.total)}</td>
                  <td>{dateBR(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt24">
        <Banner>
          Você vê apenas os clientes que atendeu. O cadastro completo e o histórico com outros
          profissionais ficam restritos à administração.
        </Banner>
      </div>
    </>
  );
}
