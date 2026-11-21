// Tipos do banco Diamond Barbearia (espelham supabase/migrations).
export type UserRole = 'owner' | 'admin' | 'barber';
export type AppointmentStatus = 'aguardando' | 'confirmado' | 'em_atendimento' | 'concluido' | 'cancelado';
export type PaymentMethod = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'fiado';
export type CommissionBasis = 'percent' | 'fixed';
export type CommissionStatus = 'pendente' | 'paga' | 'cancelada';
export type TicketStatus = 'aberta' | 'fechada' | 'cancelada';
export type CashStatus = 'aberto' | 'fechado';
export type DebtStatus = 'pendente' | 'parcial' | 'quitado';
export type ClientPackageStatus = 'ativo' | 'esgotado' | 'expirado' | 'cancelado';
export type StockMoveType = 'entrada' | 'saida' | 'ajuste';

export type AdminPermission = 'reports' | 'financial' | 'stock' | 'commissions' | 'clients' | 'settings';

export interface Profile {
  id: string; role: UserRole; full_name: string; phone: string | null;
  email: string | null; active: boolean;
  permissions: Partial<Record<AdminPermission, boolean>>;
  created_at: string;
}
export interface Barber {
  id: string; profile_id: string | null; display_name: string;
  specialty: string | null; bio: string | null; photo_url: string | null;
  active: boolean; order_index: number;
}
export interface Service {
  id: string; name: string; duration_min: number; price: number;
  category: string; active: boolean; order_index: number;
}
export interface Client {
  id: string; name: string; phone: string | null; birthdate: string | null;
  notes: string | null; preferences: string | null; created_at: string;
}
export interface ClientStats {
  client_id: string; name: string; phone: string | null; birthdate: string | null;
  visits: number; total_spent: number; last_visit: string | null;
  first_visit: string | null; avg_days_between: number | null;
}
export interface Appointment {
  id: string; client_id: string | null; barber_id: string; service_id: string;
  starts_at: string; ends_at: string; status: AppointmentStatus; price: number;
  source: 'site' | 'painel'; notes: string | null;
  client_name: string | null; client_phone: string | null;
  cancelled_at: string | null; cancel_reason: string | null;
}
export interface AppointmentFull extends Appointment {
  clients: Pick<Client, 'id' | 'name' | 'phone'> | null;
  barbers: Pick<Barber, 'id' | 'display_name'> | null;
  services: Pick<Service, 'id' | 'name' | 'duration_min' | 'price'> | null;
}
export interface CashSession {
  id: string; opened_by: string; opened_at: string; opening_amount: number;
  closed_by: string | null; closed_at: string | null; closing_amount: number | null;
  status: CashStatus; notes: string | null;
}
export interface Ticket {
  id: string; code: number; client_id: string | null; barber_id: string | null;
  cash_session_id: string | null; status: TicketStatus; discount: number;
  subtotal: number; total: number; paid_total: number;
  opened_at: string; closed_at: string | null; notes: string | null;
}
export interface TicketFull extends Ticket {
  clients: Pick<Client, 'id' | 'name'> | null;
  barbers: Pick<Barber, 'id' | 'display_name'> | null;
  ticket_items: TicketItem[];
  payments: Payment[];
}
export interface TicketItem {
  id: string; ticket_id: string; service_id: string | null; product_id: string | null;
  barber_id: string | null; appointment_id: string | null; description: string;
  qty: number; unit_price: number; total: number; covered_by_package: boolean;
}
export interface Payment {
  id: string; ticket_id: string; cash_session_id: string | null;
  method: PaymentMethod; amount: number; paid_at: string; notes: string | null;
}
export interface CommissionRule { barber_id: string; basis: CommissionBasis; value: number }
export interface Commission {
  id: string; barber_id: string; ticket_item_id: string; ticket_id: string;
  base_amount: number; basis: CommissionBasis; value: number; amount: number;
  status: CommissionStatus; payout_id: string | null;
  generated_at: string; paid_at: string | null;
}
export interface CommissionFull extends Commission {
  barbers: Pick<Barber, 'id' | 'display_name'> | null;
  ticket_items: Pick<TicketItem, 'description'> | null;
}
export interface Debt {
  id: string; client_id: string; ticket_id: string | null;
  original_amount: number; paid_amount: number; status: DebtStatus;
  origin_date: string; notes: string | null;
}
export interface DebtFull extends Debt { clients: Pick<Client, 'id' | 'name' | 'phone'> | null }
export interface Package {
  id: string; name: string; description: string | null; price: number;
  uses_total: number; validity_days: number | null; active: boolean;
}
export interface ClientPackage {
  id: string; client_id: string; package_id: string; purchased_at: string;
  expires_at: string | null; uses_total: number; uses_left: number;
  status: ClientPackageStatus;
}
export interface ClientPackageFull extends ClientPackage {
  clients: Pick<Client, 'id' | 'name'> | null;
  packages: Pick<Package, 'id' | 'name'> | null;
}
export interface Supplier { id: string; name: string; phone: string | null; email: string | null; notes: string | null; active: boolean }
export interface Product {
  id: string; name: string; sku: string | null; unit: string;
  stock_qty: number; min_qty: number; cost_price: number; sale_price: number;
  supplier_id: string | null; active: boolean;
}
export interface StockMove {
  id: string; product_id: string; type: StockMoveType; qty: number;
  unit_cost: number | null; reason: string | null; created_at: string;
}
export interface Expense {
  id: string; category_id: string | null; description: string; amount: number;
  due_date: string | null; paid_at: string | null; method: PaymentMethod | null;
}
export interface ExpenseFull extends Expense { expense_categories: { id: string; name: string } | null }
export interface BusinessHour { weekday: number; opens: string | null; closes: string | null; closed: boolean }
export interface BarberSchedule { id: string; barber_id: string; weekday: number; starts: string; ends: string; active: boolean }
export interface BarberTimeOff { id: string; barber_id: string; starts_at: string; ends_at: string; reason: string | null }
