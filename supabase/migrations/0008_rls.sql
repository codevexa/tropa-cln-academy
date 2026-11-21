-- ============================================================================
-- DIAMOND BARBEARIA — 0008 Row Level Security
-- PROPRIETÁRIO: tudo. ADMIN: operação + o que a permissão liberar.
-- BARBEIRO: só o que é dele. Nunca o financeiro da casa nem dados dos colegas.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','barbers','services','clients','business_hours','barber_schedules',
    'barber_time_off','appointments','appointment_history','cash_sessions','tickets',
    'ticket_items','payments','barber_commission_rules','barber_service_commissions',
    'commissions','commission_payouts','debts','debt_payments','packages',
    'package_services','client_packages','package_uses','suppliers','products',
    'stock_moves','purchases','purchase_items','expense_categories','expenses',
    'audit_log','settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ------------------------------------------------------------- profiles ----
create policy profiles_self_read on profiles for select to authenticated
  using (id = auth.uid() or is_staff());
create policy profiles_owner_write on profiles for all to authenticated
  using (is_owner()) with check (is_owner());
create policy profiles_self_update on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from profiles p where p.id = auth.uid()));

-- ------------------------------------------------------------- barbeiros ---
-- Todo mundo logado enxerga a lista (a agenda precisa do nome).
create policy barbers_read on barbers for select to authenticated using (true);
create policy barbers_write on barbers for all to authenticated
  using (is_owner()) with check (is_owner());

-- -------------------------------------------------------------- serviços ---
create policy services_read on services for select to authenticated using (true);
create policy services_write on services for all to authenticated
  using (is_staff()) with check (is_staff());

-- -------------------------------------------------------------- clientes ---
-- O barbeiro só vê os clientes que ele próprio atendeu.
create policy clients_staff on clients for all to authenticated
  using (is_staff()) with check (is_staff());
create policy clients_barber_read on clients for select to authenticated
  using (
    app_role() = 'barber' and exists (
      select 1 from appointments a
       where a.client_id = clients.id and a.barber_id = current_barber_id())
  );

-- ----------------------------------------------------------- agenda/horas --
create policy hours_read on business_hours for select to authenticated using (true);
create policy hours_write on business_hours for all to authenticated
  using (is_owner()) with check (is_owner());

create policy sched_read on barber_schedules for select to authenticated using (true);
create policy sched_staff on barber_schedules for all to authenticated
  using (is_staff()) with check (is_staff());
-- O barbeiro administra a própria disponibilidade.
create policy sched_own on barber_schedules for all to authenticated
  using (barber_id = current_barber_id()) with check (barber_id = current_barber_id());

create policy off_read on barber_time_off for select to authenticated using (true);
create policy off_staff on barber_time_off for all to authenticated
  using (is_staff()) with check (is_staff());
create policy off_own on barber_time_off for all to authenticated
  using (barber_id = current_barber_id()) with check (barber_id = current_barber_id());

-- -------------------------------------------------------- agendamentos -----
create policy appt_staff on appointments for all to authenticated
  using (is_staff()) with check (is_staff());
create policy appt_barber_read on appointments for select to authenticated
  using (barber_id = current_barber_id());
-- O barbeiro move o status do próprio atendimento, mas não reatribui para outro.
create policy appt_barber_update on appointments for update to authenticated
  using (barber_id = current_barber_id())
  with check (barber_id = current_barber_id());

create policy appt_hist_read on appointment_history for select to authenticated
  using (is_staff() or exists (
    select 1 from appointments a
     where a.id = appointment_history.appointment_id and a.barber_id = current_barber_id()));
create policy appt_hist_insert on appointment_history for insert to authenticated with check (true);

-- -------------------------------------------------------- caixa (fechado) --
-- Barbeiro não acessa o caixa da barbearia.
create policy cash_staff on cash_sessions for all to authenticated
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------- comandas -------
create policy tickets_staff on tickets for all to authenticated
  using (is_staff()) with check (is_staff());
-- O barbeiro vê as comandas em que ele tem itens — sem poder alterá-las.
create policy tickets_barber_read on tickets for select to authenticated
  using (exists (select 1 from ticket_items ti
                  where ti.ticket_id = tickets.id and ti.barber_id = current_barber_id()));

create policy items_staff on ticket_items for all to authenticated
  using (is_staff()) with check (is_staff());
create policy items_barber_read on ticket_items for select to authenticated
  using (barber_id = current_barber_id());

-- Pagamentos: exclusivo do owner/admin. O barbeiro nunca vê o caixa da casa.
create policy payments_staff on payments for all to authenticated
  using (is_staff()) with check (is_staff());

-- ---------------------------------------------------------- comissões ------
-- Regra de comissão: owner configura; cada barbeiro vê apenas a SUA regra.
create policy comm_rule_owner on barber_commission_rules for all to authenticated
  using (is_owner()) with check (is_owner());
create policy comm_rule_own_read on barber_commission_rules for select to authenticated
  using (barber_id = current_barber_id());

create policy comm_svc_owner on barber_service_commissions for all to authenticated
  using (is_owner()) with check (is_owner());
create policy comm_svc_own_read on barber_service_commissions for select to authenticated
  using (barber_id = current_barber_id());

create policy comm_owner on commissions for all to authenticated
  using (is_owner()) with check (is_owner());
create policy comm_admin_read on commissions for select to authenticated
  using (app_role() = 'admin' and has_permission('commissions'));
create policy comm_own_read on commissions for select to authenticated
  using (barber_id = current_barber_id());

create policy payout_owner on commission_payouts for all to authenticated
  using (is_owner()) with check (is_owner());
create policy payout_own_read on commission_payouts for select to authenticated
  using (barber_id = current_barber_id());

-- ------------------------------------------------------------- fiados ------
create policy debts_staff on debts for all to authenticated
  using (is_staff()) with check (is_staff());
create policy debtpay_staff on debt_payments for all to authenticated
  using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------ pacotes ------
create policy pkg_read on packages for select to authenticated using (true);
create policy pkg_write on packages for all to authenticated
  using (is_staff()) with check (is_staff());
create policy pkgsvc_read on package_services for select to authenticated using (true);
create policy pkgsvc_write on package_services for all to authenticated
  using (is_staff()) with check (is_staff());

create policy cpkg_staff on client_packages for all to authenticated
  using (is_staff()) with check (is_staff());
create policy cpkg_barber_read on client_packages for select to authenticated
  using (app_role() = 'barber' and exists (
    select 1 from appointments a
     where a.client_id = client_packages.client_id and a.barber_id = current_barber_id()));

create policy pkguse_staff on package_uses for all to authenticated
  using (is_staff()) with check (is_staff());
create policy pkguse_own_read on package_uses for select to authenticated
  using (barber_id = current_barber_id());

-- --------------------------------------------- estoque / compras / despesas --
-- Área administrativa: barbeiro não entra.
create policy sup_rw on suppliers for all to authenticated
  using (has_permission('stock')) with check (has_permission('stock'));
create policy prod_read on products for select to authenticated
  using (has_permission('stock'));
create policy prod_rw on products for all to authenticated
  using (has_permission('stock')) with check (has_permission('stock'));
create policy moves_rw on stock_moves for all to authenticated
  using (has_permission('stock')) with check (has_permission('stock'));
create policy purch_rw on purchases for all to authenticated
  using (has_permission('stock')) with check (has_permission('stock'));
create policy purchit_rw on purchase_items for all to authenticated
  using (has_permission('stock')) with check (has_permission('stock'));

create policy expcat_rw on expense_categories for all to authenticated
  using (has_permission('financial')) with check (has_permission('financial'));
create policy exp_rw on expenses for all to authenticated
  using (has_permission('financial')) with check (has_permission('financial'));

-- ---------------------------------------------------- auditoria / config ---
create policy audit_read on audit_log for select to authenticated using (is_owner());
create policy audit_insert on audit_log for insert to authenticated with check (true);

create policy settings_read on settings for select to authenticated using (true);
create policy settings_write on settings for all to authenticated
  using (is_owner()) with check (is_owner());
