// Fixtures usadas APENAS no teste de renderização (Playwright intercepta a rede).
// Nenhum dado falso entra no código do aplicativo.
const uid = (n) => `${n}`.padEnd(8, '0') + '-0000-0000-0000-000000000000';

export const OWNER = { id: uid('11111111'), role: 'owner', full_name: 'Proprietário', email: 'dono@diamond.test', active: true, permissions: {}, created_at: '2026-01-01T00:00:00Z' };
export const BARBER_PROFILE = { id: uid('33333333'), role: 'barber', full_name: 'Barbeiro Um', email: 'b1@diamond.test', active: true, permissions: {}, created_at: '2026-01-01T00:00:00Z' };

const BARBERS = [
  { id: uid('aaaaaaa1'), profile_id: BARBER_PROFILE.id, display_name: 'Barbeiro Um', specialty: 'Degradê', bio: null, photo_url: null, active: true, order_index: 1, profiles: { id: BARBER_PROFILE.id, full_name: 'Barbeiro Um', email: 'b1@diamond.test', role: 'barber', active: true }, barber_commission_rules: { barber_id: uid('aaaaaaa1'), basis: 'percent', value: 50 } },
  { id: uid('aaaaaaa2'), profile_id: null, display_name: 'Barbeiro Dois', specialty: null, bio: null, photo_url: null, active: true, order_index: 2, profiles: null, barber_commission_rules: null },
];
const SERVICES = [
  { id: uid('5e111111'), name: 'Corte', duration_min: 30, price: 37, category: 'corte', active: true, order_index: 3 },
  { id: uid('5e222222'), name: 'Barba', duration_min: 30, price: 30, category: 'barba', active: true, order_index: 1 },
  { id: uid('5e333333'), name: 'Corte + Barba', duration_min: 60, price: 60, category: 'combo', active: true, order_index: 4 },
];
const CLIENTS = [
  { id: uid('c1111111'), name: 'Cliente A', phone: '51999990001', birthdate: '1990-11-05', notes: null, preferences: 'Degradê baixo', created_at: '2026-10-01T10:00:00Z' },
  { id: uid('c2222222'), name: 'Cliente B', phone: '51999990002', birthdate: null, notes: null, preferences: null, created_at: '2026-11-01T10:00:00Z' },
];
const today = new Date();
const at = (h, m = 0, dayOffset = 0) => {
  const d = new Date(today); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.toISOString();
};
const APPTS = [
  { id: uid('ap111111'), client_id: CLIENTS[0].id, barber_id: BARBERS[0].id, service_id: SERVICES[0].id,
    starts_at: at(10), ends_at: at(10, 30), status: 'confirmado', price: 37, source: 'painel',
    notes: null, client_name: null, client_phone: null, cancelled_at: null, cancel_reason: null,
    clients: { id: CLIENTS[0].id, name: 'Cliente A', phone: '51999990001' },
    barbers: { id: BARBERS[0].id, display_name: 'Barbeiro Um' },
    services: { id: SERVICES[0].id, name: 'Corte', duration_min: 30, price: 37 } },
  { id: uid('ap222222'), client_id: CLIENTS[1].id, barber_id: BARBERS[1].id, service_id: SERVICES[2].id,
    starts_at: at(14), ends_at: at(15), status: 'concluido', price: 60, source: 'site',
    notes: null, client_name: null, client_phone: null, cancelled_at: null, cancel_reason: null,
    clients: { id: CLIENTS[1].id, name: 'Cliente B', phone: '51999990002' },
    barbers: { id: BARBERS[1].id, display_name: 'Barbeiro Dois' },
    services: { id: SERVICES[2].id, name: 'Corte + Barba', duration_min: 60, price: 60 } },
];
const CASH = { id: uid('ca111111'), opened_by: OWNER.id, opened_at: at(8), opening_amount: 100,
               closed_by: null, closed_at: null, closing_amount: null, status: 'aberto', notes: null };
const ITEMS = [
  { id: uid('it111111'), ticket_id: uid('tk111111'), service_id: SERVICES[0].id, product_id: null,
    barber_id: BARBERS[0].id, appointment_id: uid('ap111111'), description: 'Corte', qty: 1,
    unit_price: 37, total: 37, covered_by_package: false, created_at: at(10),
    services: { name: 'Corte' }, barbers: { display_name: 'Barbeiro Um' } },
  { id: uid('it222222'), ticket_id: uid('tk111111'), service_id: SERVICES[2].id, product_id: null,
    barber_id: BARBERS[1].id, appointment_id: null, description: 'Corte + Barba', qty: 1,
    unit_price: 60, total: 60, covered_by_package: false, created_at: at(14),
    services: { name: 'Corte + Barba' }, barbers: { display_name: 'Barbeiro Dois' } },
];
const PAYMENTS = [
  { id: uid('pm111111'), ticket_id: uid('tk111111'), cash_session_id: CASH.id, method: 'pix',
    amount: 60, paid_at: at(14, 30), notes: null, tickets: { code: 1 } },
  { id: uid('pm222222'), ticket_id: uid('tk111111'), cash_session_id: CASH.id, method: 'dinheiro',
    amount: 37, paid_at: at(10, 35), notes: null, tickets: { code: 1 } },
];
const TICKETS = [
  { id: uid('tk111111'), code: 1, client_id: CLIENTS[0].id, barber_id: BARBERS[0].id,
    cash_session_id: CASH.id, status: 'aberta', discount: 0, subtotal: 97, total: 97,
    paid_total: 97, opened_at: at(10), closed_at: null, notes: null,
    clients: { id: CLIENTS[0].id, name: 'Cliente A' },
    barbers: { id: BARBERS[0].id, display_name: 'Barbeiro Um' },
    ticket_items: ITEMS, payments: PAYMENTS },
];
const COMMISSIONS = [
  { id: uid('cm111111'), barber_id: BARBERS[0].id, ticket_item_id: ITEMS[0].id, ticket_id: TICKETS[0].id,
    base_amount: 37, basis: 'percent', value: 50, amount: 18.5, status: 'pendente',
    payout_id: null, generated_at: at(10, 40), paid_at: null,
    barbers: { id: BARBERS[0].id, display_name: 'Barbeiro Um' }, ticket_items: { description: 'Corte' } },
];

export const TABLES = {
  profiles: [OWNER, BARBER_PROFILE],
  barbers: BARBERS,
  services: SERVICES,
  clients: CLIENTS,
  appointments: APPTS,
  cash_sessions: [CASH],
  tickets: TICKETS,
  ticket_items: ITEMS,
  payments: PAYMENTS,
  commissions: COMMISSIONS,
  commission_payouts: [{ id: uid('po111111'), barber_id: BARBERS[0].id, amount: 120, method: 'pix', paid_at: at(9, 0, -7), paid_by: OWNER.id, notes: null }],
  barber_commission_rules: [{ barber_id: BARBERS[0].id, basis: 'percent', value: 50 }],
  barber_service_commissions: [],
  debts: [{ id: uid('db111111'), client_id: CLIENTS[0].id, ticket_id: null, original_amount: 100,
            paid_amount: 40, status: 'parcial', origin_date: '2026-11-01', notes: 'Fiado da semana',
            clients: { id: CLIENTS[0].id, name: 'Cliente A', phone: '51999990001' } }],
  debt_payments: [{ id: uid('dp111111'), debt_id: uid('db111111'), amount: 40, method: 'dinheiro', paid_at: at(11, 0, -3) }],
  packages: [{ id: uid('pk111111'), name: 'Pacote 4 Cortes', description: 'Quatro cortes.', price: 130, uses_total: 4, validity_days: null, active: true }],
  package_services: [],
  client_packages: [{ id: uid('cp111111'), client_id: CLIENTS[0].id, package_id: uid('pk111111'),
                      purchased_at: at(9, 0, -10), expires_at: null, uses_total: 4, uses_left: 3, status: 'ativo',
                      clients: { id: CLIENTS[0].id, name: 'Cliente A' }, packages: { id: uid('pk111111'), name: 'Pacote 4 Cortes' } }],
  package_uses: [],
  suppliers: [{ id: uid('su111111'), name: 'Distribuidora Sul', phone: '5133334444', email: null, notes: null, active: true }],
  products: [
    { id: uid('pr111111'), name: 'Pomada Modeladora', sku: 'POM-01', unit: 'un', stock_qty: 12, min_qty: 5, cost_price: 18, sale_price: 35, supplier_id: uid('su111111'), active: true, suppliers: { name: 'Distribuidora Sul' } },
    { id: uid('pr222222'), name: 'Óleo para Barba', sku: 'OLE-01', unit: 'un', stock_qty: 2, min_qty: 5, cost_price: 22, sale_price: 45, supplier_id: uid('su111111'), active: true, suppliers: { name: 'Distribuidora Sul' } },
  ],
  stock_moves: [{ id: uid('sm111111'), product_id: uid('pr111111'), type: 'entrada', qty: 12, unit_cost: 18, reason: 'Compra', created_at: at(9, 0, -5) }],
  purchases: [], purchase_items: [],
  expense_categories: [{ id: uid('ec111111'), name: 'Aluguel' }, { id: uid('ec222222'), name: 'Produtos' }],
  expenses: [{ id: uid('ex111111'), category_id: uid('ec111111'), description: 'Aluguel novembro',
               amount: 2500, due_date: '2026-11-10', paid_at: at(9, 0, -11), method: 'pix',
               expense_categories: { id: uid('ec111111'), name: 'Aluguel' } }],
  business_hours: Array.from({ length: 7 }, (_, w) => ({
    weekday: w, opens: w === 0 ? null : '09:00:00', closes: w === 0 ? null : '20:00:00', closed: w === 0 })),
  barber_schedules: [{ id: uid('bs111111'), barber_id: BARBERS[0].id, weekday: 2, starts: '10:00:00', ends: '19:00:00', active: true }],
  barber_time_off: [{ id: uid('bt111111'), barber_id: BARBERS[0].id, starts_at: at(12, 0, 3), ends_at: at(14, 0, 3), reason: 'Consulta' }],
  settings: [{ key: 'business', value: { name: 'Diamond Barbearia', since: 2015, phone: '(51) 98454-6144', address: 'Av. Protásio Alves, 6585', city: 'Porto Alegre', state: 'RS', instagram: null } }],
  v_client_stats: CLIENTS.map((c, i) => ({
    client_id: c.id, name: c.name, phone: c.phone, birthdate: c.birthdate,
    visits: i === 0 ? 5 : 1, total_spent: i === 0 ? 320 : 60,
    last_visit: at(10, 0, i === 0 ? -3 : -90), first_visit: at(10, 0, -200),
    avg_days_between: i === 0 ? 21 : null })),
  v_commission_summary: [{ barber_id: BARBERS[0].id, display_name: 'Barbeiro Um', pending: 18.5, paid: 120, pending_count: 1 }],
};
