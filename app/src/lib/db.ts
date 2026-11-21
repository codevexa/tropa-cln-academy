import { supabase } from './supabase';
import { isoDay } from './format';
import type { PaymentMethod } from './types';

/** Erro do PostgREST/Postgres em português legível para a interface. */
export function dbError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (m.includes('no_overlap_per_barber')) return 'Este profissional já tem atendimento nesse horário.';
  if (m.includes('uniq_open_cash')) return 'Já existe um caixa aberto.';
  if (m.includes('uniq_item_per_appointment')) return 'Este atendimento já foi lançado em uma comanda.';
  if (m.includes('commissions_ticket_item_id_key')) return 'A comissão deste item já foi gerada.';
  if (m.includes('clients_phone_key')) return 'Já existe um cliente com este telefone.';
  if (m.includes('services_name_key')) return 'Já existe um serviço com este nome.';
  if (m.includes('row-level security')) return 'Seu perfil não tem permissão para esta ação.';
  if (m.includes('violates foreign key')) return 'Registro vinculado a outros dados; não é possível excluir.';
  return m;
}

export async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(dbError(error));
  return data as T;
}

export interface Period { from: Date; to: Date }

export interface DashboardData {
  revenue: number;
  revenueToday: number;
  revenueMonth: number;
  revenueYear: number;
  appointments: number;
  ticketAvg: number;
  expenses: number;
  commissionsPending: number;
  commissionsPaid: number;
  profit: number;
  newClients: number;
  returningClients: number;
  byDay: { day: string; receita: number }[];
  byBarber: { name: string; receita: number }[];
  byService: { name: string; qtd: number; receita: number }[];
  byMethod: { name: string; valor: number }[];
  byMonth: { mes: string; receita: number; despesa: number }[];
}

const sum = (rows: { amount: number | string }[]) =>
  rows.reduce((a, r) => a + Number(r.amount), 0);

/** Agrega tudo que o painel do proprietário mostra, a partir dos dados reais. */
export async function loadDashboard(p: Period): Promise<DashboardData> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [pay, payToday, payMonth, payYear, appts, exp, comm, items, clientsNew, tickets] =
    await Promise.all([
      must(supabase.from('payments').select('amount, method, paid_at')
        .gte('paid_at', p.from.toISOString()).lte('paid_at', p.to.toISOString())),
      must(supabase.from('payments').select('amount').gte('paid_at', dayStart.toISOString())),
      must(supabase.from('payments').select('amount').gte('paid_at', monthStart.toISOString())),
      must(supabase.from('payments').select('amount, paid_at').gte('paid_at', yearStart.toISOString())),
      must(supabase.from('appointments').select('id, client_id, status')
        .eq('status', 'concluido')
        .gte('starts_at', p.from.toISOString()).lte('starts_at', p.to.toISOString())),
      must(supabase.from('expenses').select('amount, paid_at')
        .not('paid_at', 'is', null)
        .gte('paid_at', yearStart.toISOString())),
      must(supabase.from('commissions').select('amount, status')
        .gte('generated_at', p.from.toISOString()).lte('generated_at', p.to.toISOString())),
      must(supabase.from('ticket_items')
        .select('total, service_id, barber_id, created_at, services(name), barbers(display_name)')
        .gte('created_at', p.from.toISOString()).lte('created_at', p.to.toISOString())),
      must(supabase.from('clients').select('id, created_at')
        .gte('created_at', p.from.toISOString()).lte('created_at', p.to.toISOString())),
      must(supabase.from('tickets').select('id, total, status')
        .eq('status', 'fechada')
        .gte('opened_at', p.from.toISOString()).lte('opened_at', p.to.toISOString())),
    ]);

  const revenue = sum(pay as { amount: number }[]);
  const expensesPeriod = (exp as { amount: number; paid_at: string }[])
    .filter((e) => { const d = new Date(e.paid_at); return d >= p.from && d <= p.to; });
  const expenses = sum(expensesPeriod);
  const cPend = (comm as { amount: number; status: string }[]).filter((c) => c.status === 'pendente');
  const cPaid = (comm as { amount: number; status: string }[]).filter((c) => c.status === 'paga');
  const commissionsPending = sum(cPend);
  const commissionsPaid = sum(cPaid);

  // receita por dia
  const dayMap = new Map<string, number>();
  for (const r of pay as { amount: number; paid_at: string }[]) {
    const k = isoDay(new Date(r.paid_at));
    dayMap.set(k, (dayMap.get(k) ?? 0) + Number(r.amount));
  }
  const byDay = [...dayMap.entries()].sort().map(([day, receita]) => ({
    day: day.slice(8) + '/' + day.slice(5, 7), receita: Number(receita.toFixed(2)),
  }));

  // receita por profissional e ranking de serviços
  type Item = { total: number; services: { name: string } | null; barbers: { display_name: string } | null };
  const barberMap = new Map<string, number>();
  const svcMap = new Map<string, { qtd: number; receita: number }>();
  for (const it of items as unknown as Item[]) {
    const bn = it.barbers?.display_name ?? 'Sem profissional';
    barberMap.set(bn, (barberMap.get(bn) ?? 0) + Number(it.total));
    const sn = it.services?.name ?? 'Outros';
    const cur = svcMap.get(sn) ?? { qtd: 0, receita: 0 };
    svcMap.set(sn, { qtd: cur.qtd + 1, receita: cur.receita + Number(it.total) });
  }
  const byBarber = [...barberMap.entries()]
    .map(([name, receita]) => ({ name, receita: Number(receita.toFixed(2)) }))
    .sort((a, b) => b.receita - a.receita);
  const byService = [...svcMap.entries()]
    .map(([name, v]) => ({ name, qtd: v.qtd, receita: Number(v.receita.toFixed(2)) }))
    .sort((a, b) => b.qtd - a.qtd);

  // formas de pagamento
  const methodLabel: Record<PaymentMethod, string> = {
    dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito', fiado: 'Fiado',
  };
  const mMap = new Map<string, number>();
  for (const r of pay as { amount: number; method: PaymentMethod }[]) {
    const k = methodLabel[r.method] ?? r.method;
    mMap.set(k, (mMap.get(k) ?? 0) + Number(r.amount));
  }
  const byMethod = [...mMap.entries()].map(([name, valor]) => ({ name, valor: Number(valor.toFixed(2)) }));

  // desempenho mensal do ano corrente
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthRev = new Array(12).fill(0);
  const monthExp = new Array(12).fill(0);
  for (const r of payYear as { amount: number; paid_at: string }[])
    monthRev[new Date(r.paid_at).getMonth()] += Number(r.amount);
  for (const e of exp as { amount: number; paid_at: string }[])
    monthExp[new Date(e.paid_at).getMonth()] += Number(e.amount);
  const byMonth = MESES.map((mes, i) => ({
    mes, receita: Number(monthRev[i].toFixed(2)), despesa: Number(monthExp[i].toFixed(2)),
  })).slice(0, now.getMonth() + 1);

  // clientes: novos no período x que já tinham comanda antes
  const apptClients = new Set(
    (appts as { client_id: string | null }[]).map((a) => a.client_id).filter(Boolean) as string[]
  );
  const newIds = new Set((clientsNew as { id: string }[]).map((c) => c.id));
  const returningClients = [...apptClients].filter((id) => !newIds.has(id)).length;

  const closed = tickets as { total: number }[];
  const ticketAvg = closed.length ? closed.reduce((a, t) => a + Number(t.total), 0) / closed.length : 0;

  return {
    revenue,
    revenueToday: sum(payToday as { amount: number }[]),
    revenueMonth: sum(payMonth as { amount: number }[]),
    revenueYear: sum(payYear as { amount: number }[]),
    appointments: (appts as unknown[]).length,
    ticketAvg,
    expenses,
    commissionsPending,
    commissionsPaid,
    profit: revenue - expenses - commissionsPaid - commissionsPending,
    newClients: newIds.size,
    returningClients,
    byDay, byBarber, byService, byMethod, byMonth,
  };
}
