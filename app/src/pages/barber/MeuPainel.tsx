import { supabase } from '../../lib/supabase';
import { must } from '../../lib/db';
import { useAuth } from '../../auth/AuthProvider';
import { money, num, dateBR, timeBR, label, startOfDay, endOfDay, startOfMonth } from '../../lib/format';
import { Kpi, Badge, Loading, ErrorBox, Empty, useAsync, Banner } from '../../ui/kit';
import type { AppointmentFull, Commission, CommissionRule } from '../../lib/types';

export default function MeuPainel() {
  const { barber, profile } = useAuth();

  const data = useAsync(async () => {
    if (!barber) return null;
    const now = new Date();
    const [next, todayDone, monthComm, rule, payouts] = await Promise.all([
      must(supabase.from('appointments')
        .select('*, clients(id,name,phone), barbers(id,display_name), services(id,name,duration_min,price)')
        .eq('barber_id', barber.id).in('status', ['aguardando', 'confirmado', 'em_atendimento'])
        .gte('starts_at', now.toISOString()).order('starts_at').limit(8)) as Promise<AppointmentFull[]>,
      must(supabase.from('appointments').select('id, price')
        .eq('barber_id', barber.id).eq('status', 'concluido')
        .gte('starts_at', startOfDay(now).toISOString())
        .lte('starts_at', endOfDay(now).toISOString())) as Promise<{ id: string; price: number }[]>,
      must(supabase.from('commissions').select('amount, status, generated_at')
        .eq('barber_id', barber.id)
        .gte('generated_at', startOfMonth(now).toISOString())) as Promise<Commission[]>,
      must(supabase.from('barber_commission_rules').select('*')
        .eq('barber_id', barber.id).maybeSingle()) as Promise<CommissionRule | null>,
      must(supabase.from('commission_payouts').select('id, amount, paid_at, method')
        .eq('barber_id', barber.id).order('paid_at', { ascending: false }).limit(5)) as Promise<
          { id: string; amount: number; paid_at: string; method: string | null }[]>,
    ]);
    return { next, todayDone, monthComm, rule, payouts };
  }, [barber?.id ?? '']);

  if (!barber) {
    return (
      <Banner tone="warn">
        <b>Login sem barbeiro vinculado.</b> Peça ao proprietário para vincular este acesso a um
        profissional em Profissionais → Acessos.
      </Banner>
    );
  }

  const d = data.data;
  const pending = (d?.monthComm ?? []).filter((c) => c.status === 'pendente');
  const paid = (d?.monthComm ?? []).filter((c) => c.status === 'paga');
  const sum = (a: { amount: number }[]) => a.reduce((x, c) => x + Number(c.amount), 0);

  return (
    <>
      <h2 className="mb16">Olá, {barber.display_name || profile?.full_name}</h2>

      {data.loading && <Loading />}
      {data.error && <ErrorBox msg={data.error} />}

      {d && (
        <>
          <div className="grid g4 mb16">
            <Kpi label="Atendimentos hoje" value={num(d.todayDone.length)} hint="concluídos" />
            <Kpi label="Próximos" value={num(d.next.length)} hint="ainda nesta agenda" />
            <Kpi label="Comissões a receber" value={money(sum(pending))} tone="gold" hint="no mês" />
            <Kpi label="Comissões recebidas" value={money(sum(paid))} tone="ok" hint="no mês" />
          </div>

          <div className="grid g2 mb16">
            <div className="card">
              <div className="card-h"><h3>Próximos atendimentos</h3></div>
              {!d.next.length ? <Empty msg="Nenhum atendimento agendado." /> : (
                <div className="tw">
                  <table>
                    <thead><tr><th>Data</th><th>Hora</th><th>Cliente</th><th>Serviço</th><th>Status</th></tr></thead>
                    <tbody>
                      {d.next.map((a) => (
                        <tr key={a.id}>
                          <td>{dateBR(a.starts_at)}</td>
                          <td className="tnum">{timeBR(a.starts_at)}</td>
                          <td>{a.clients?.name ?? a.client_name ?? '—'}</td>
                          <td className="mut">{a.services?.name ?? '—'}</td>
                          <td><Badge value={a.status} text={label(a.status)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-h"><h3>Minha regra de comissão</h3></div>
              {d.rule ? (
                <>
                  <Kpi label={d.rule.basis === 'percent' ? 'Percentual por serviço' : 'Valor fixo por serviço'}
                       value={d.rule.basis === 'percent' ? `${d.rule.value}%` : money(d.rule.value)} tone="gold" />
                  <p className="hint mt16">
                    A comissão é gerada automaticamente quando a comanda do cliente é quitada.
                    Apenas o proprietário altera esta regra.
                  </p>
                </>
              ) : (
                <Banner tone="warn">
                  Sua regra de comissão ainda não foi definida pelo proprietário.
                </Banner>
              )}

              <h3 className="mt24 mb16">Últimos repasses</h3>
              {!d.payouts.length ? <Empty msg="Nenhum repasse registrado." /> : (
                d.payouts.map((p) => (
                  <div className="list-row" key={p.id}>
                    <span className="grow">{dateBR(p.paid_at)}</span>
                    <span className="mut">{label(p.method ?? '')}</span>
                    <b className="tnum">{money(p.amount)}</b>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
