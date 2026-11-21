-- ============================================================================
-- DIAMOND BARBEARIA — 0007 Fluxo atendimento→comanda e views de indicadores
-- ============================================================================

-- Abre (ou reaproveita) a comanda do cliente e lança o atendimento nela.
-- O UNIQUE em ticket_items.appointment_id garante lançamento único.
create or replace function bill_appointment(p_appointment uuid, p_ticket uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare a record; v_ticket uuid; v_cash uuid; v_name text;
begin
  select ap.*, s.name as service_name into a
    from public.appointments ap
    join public.services s on s.id = ap.service_id
   where ap.id = p_appointment;
  if a is null then raise exception 'Agendamento não encontrado'; end if;
  if a.status = 'cancelado' then raise exception 'Agendamento cancelado não gera comanda'; end if;

  if exists (select 1 from public.ticket_items ti where ti.appointment_id = p_appointment) then
    select ti.ticket_id into v_ticket from public.ticket_items ti where ti.appointment_id = p_appointment;
    return v_ticket;  -- já faturado: devolve a comanda existente, não duplica
  end if;

  select c.id into v_cash from public.cash_sessions c where c.status = 'aberto' limit 1;
  if v_cash is null then
    raise exception 'Nenhum caixa aberto: abra o caixa antes de lançar atendimentos';
  end if;

  v_ticket := p_ticket;
  if v_ticket is null then
    select t.id into v_ticket from public.tickets t
     where t.status = 'aberta' and t.cash_session_id = v_cash
       and (t.client_id is not distinct from a.client_id)
       and t.barber_id = a.barber_id
     order by t.opened_at desc limit 1;
  end if;

  if v_ticket is null then
    insert into public.tickets (client_id, barber_id, cash_session_id, created_by)
    values (a.client_id, a.barber_id, v_cash, auth.uid())
    returning id into v_ticket;
  end if;

  insert into public.ticket_items
    (ticket_id, service_id, barber_id, appointment_id, description, qty, unit_price, total)
  values (v_ticket, a.service_id, a.barber_id, p_appointment, a.service_name, 1, a.price, a.price);

  return v_ticket;
end $$;

-- Concluir o atendimento lança automaticamente na comanda (regra 2 do briefing).
create or replace function trg_appointment_completed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido' then
    if exists (select 1 from public.cash_sessions c where c.status = 'aberto') then
      perform public.bill_appointment(new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_appt_bill on appointments;
create trigger trg_appt_bill after update on appointments
  for each row execute function trg_appointment_completed();

-- --------------------------------------------------------- fechar caixa ----
create or replace function close_cash_session(p_session uuid, p_counted numeric, p_notes text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Sem permissão para fechar o caixa'; end if;
  if exists (select 1 from public.tickets t where t.cash_session_id = p_session and t.status = 'aberta') then
    raise exception 'Existem comandas abertas neste caixa';
  end if;
  update public.cash_sessions
     set status = 'fechado', closed_at = now(), closed_by = auth.uid(),
         closing_amount = p_counted, notes = coalesce(p_notes, notes)
   where id = p_session and status = 'aberto';
  if not found then raise exception 'Caixa já fechado ou inexistente'; end if;
end $$;

-- ============================ VIEWS DE INDICADORES ==========================
-- security_invoker: a view respeita o RLS de quem consulta.

create or replace view v_revenue_daily
with (security_invoker = true) as
select date_trunc('day', p.paid_at)::date as day,
       sum(p.amount)                      as revenue,
       count(distinct p.ticket_id)        as tickets
  from payments p
 group by 1;

create or replace view v_revenue_by_barber
with (security_invoker = true) as
select ti.barber_id,
       b.display_name,
       date_trunc('day', t.opened_at)::date as day,
       sum(ti.total)                        as revenue,
       count(*)                             as items
  from ticket_items ti
  join tickets t on t.id = ti.ticket_id and t.status = 'fechada'
  left join barbers b on b.id = ti.barber_id
 group by 1,2,3;

create or replace view v_service_ranking
with (security_invoker = true) as
select ti.service_id, s.name,
       count(*)        as qty,
       sum(ti.total)   as revenue
  from ticket_items ti
  join services s on s.id = ti.service_id
  join tickets t on t.id = ti.ticket_id and t.status = 'fechada'
 group by 1,2;

create or replace view v_payment_mix
with (security_invoker = true) as
select p.method, date_trunc('day', p.paid_at)::date as day,
       sum(p.amount) as amount, count(*) as qty
  from payments p group by 1,2;

-- Ficha do cliente: total gasto, frequência, última visita.
create or replace view v_client_stats
with (security_invoker = true) as
select c.id as client_id, c.name, c.phone, c.birthdate,
       count(distinct t.id)                              as visits,
       coalesce(sum(t.total), 0)                         as total_spent,
       max(t.opened_at)                                  as last_visit,
       min(t.opened_at)                                  as first_visit,
       case when count(distinct t.id) > 1
            then round(extract(epoch from (max(t.opened_at) - min(t.opened_at)))
                       / 86400.0 / nullif(count(distinct t.id) - 1, 0))
       end                                               as avg_days_between
  from clients c
  left join tickets t on t.client_id = c.id and t.status = 'fechada'
 group by c.id, c.name, c.phone, c.birthdate;

-- Comissões consolidadas por barbeiro
create or replace view v_commission_summary
with (security_invoker = true) as
select c.barber_id, b.display_name,
       sum(c.amount) filter (where c.status = 'pendente') as pending,
       sum(c.amount) filter (where c.status = 'paga')     as paid,
       count(*) filter (where c.status = 'pendente')      as pending_count
  from commissions c
  left join barbers b on b.id = c.barber_id
 group by 1,2;
