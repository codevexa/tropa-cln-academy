-- ============================================================================
-- DIAMOND BARBEARIA — 0003 Caixa, comandas e pagamentos
-- ============================================================================

create table if not exists cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  opened_by       uuid not null references profiles(id),
  opened_at       timestamptz not null default now(),
  opening_amount  numeric(10,2) not null default 0 check (opening_amount >= 0),
  closed_by       uuid references profiles(id),
  closed_at       timestamptz,
  closing_amount  numeric(10,2),
  status          cash_status not null default 'aberto',
  notes           text,
  check (status = 'aberto' or closed_at is not null)
);
-- REGRA: só pode existir um caixa aberto por vez.
create unique index if not exists uniq_open_cash
  on cash_sessions ((status)) where status = 'aberto';

-- ------------------------------------------------------------- comandas ----
create sequence if not exists ticket_code_seq;
create table if not exists tickets (
  id              uuid primary key default gen_random_uuid(),
  code            int not null unique default nextval('ticket_code_seq'),
  client_id       uuid references clients(id) on delete set null,
  barber_id       uuid references barbers(id) on delete set null,
  cash_session_id uuid references cash_sessions(id) on delete restrict,
  status          ticket_status not null default 'aberta',
  discount        numeric(10,2) not null default 0 check (discount >= 0),
  subtotal        numeric(10,2) not null default 0,
  total           numeric(10,2) not null default 0,
  paid_total      numeric(10,2) not null default 0,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  created_by      uuid references profiles(id),
  notes           text
);
create index if not exists idx_tickets_status on tickets (status, opened_at desc);
create index if not exists idx_tickets_cash   on tickets (cash_session_id);
create index if not exists idx_tickets_client on tickets (client_id, opened_at desc);

create table if not exists ticket_items (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references tickets(id) on delete cascade,
  service_id     uuid references services(id) on delete restrict,
  product_id     uuid,  -- FK adicionada na migration de estoque
  barber_id      uuid references barbers(id) on delete restrict,
  appointment_id uuid references appointments(id) on delete set null,
  description    text not null,
  qty            numeric(10,2) not null default 1 check (qty > 0),
  unit_price     numeric(10,2) not null check (unit_price >= 0),
  total          numeric(10,2) not null check (total >= 0),
  covered_by_package boolean not null default false,
  created_at     timestamptz not null default now()
);
-- REGRA CRÍTICA: um atendimento nunca gera faturamento duas vezes.
create unique index if not exists uniq_item_per_appointment
  on ticket_items (appointment_id) where appointment_id is not null;
create index if not exists idx_items_ticket on ticket_items (ticket_id);
create index if not exists idx_items_barber on ticket_items (barber_id, created_at desc);

-- ----------------------------------------------------------- pagamentos ----
create table if not exists payments (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references tickets(id) on delete cascade,
  cash_session_id uuid references cash_sessions(id) on delete restrict,
  method          payment_method not null,
  amount          numeric(10,2) not null check (amount > 0),
  paid_at         timestamptz not null default now(),
  received_by     uuid references profiles(id),
  notes           text
);
create index if not exists idx_payments_ticket on payments (ticket_id);
create index if not exists idx_payments_cash   on payments (cash_session_id, paid_at);
create index if not exists idx_payments_date   on payments (paid_at);

-- ------------------------------------------- recálculo de totais da comanda --
create or replace function recalc_ticket(p_ticket uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_sub numeric(10,2); v_disc numeric(10,2); v_paid numeric(10,2);
begin
  select coalesce(sum(ti.total), 0) into v_sub
    from public.ticket_items ti where ti.ticket_id = p_ticket;
  select t.discount into v_disc from public.tickets t where t.id = p_ticket;
  select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p where p.ticket_id = p_ticket;

  update public.tickets
     set subtotal   = v_sub,
         total      = greatest(v_sub - coalesce(v_disc, 0), 0),
         paid_total = v_paid
   where id = p_ticket;
end $$;

create or replace function trg_recalc_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalc_ticket(coalesce(new.ticket_id, old.ticket_id));
  return coalesce(new, old);
end $$;

drop trigger if exists trg_items_recalc on ticket_items;
create trigger trg_items_recalc after insert or update or delete on ticket_items
  for each row execute function trg_recalc_ticket();

drop trigger if exists trg_payments_recalc on payments;
create trigger trg_payments_recalc after insert or update or delete on payments
  for each row execute function trg_recalc_ticket();

-- Desconto alterado na própria comanda também recalcula
create or replace function trg_ticket_discount() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.discount is distinct from old.discount then
    perform public.recalc_ticket(new.id);
  end if;
  return new;
end $$;
drop trigger if exists trg_ticket_disc on tickets;
create trigger trg_ticket_disc after update of discount on tickets
  for each row execute function trg_ticket_discount();

-- REGRA: pagamento sempre entra no caixa aberto; bloqueia pagar comanda cancelada
-- ou pagar mais do que o total.
create or replace function validate_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_status public.ticket_status; v_total numeric; v_paid numeric; v_cash uuid;
begin
  select t.status, t.total into v_status, v_total
    from public.tickets t where t.id = new.ticket_id for update;
  if v_status = 'cancelada' then
    raise exception 'Comanda cancelada não aceita pagamento';
  end if;

  select coalesce(sum(p.amount), 0) into v_paid
    from public.payments p where p.ticket_id = new.ticket_id and p.id <> new.id;
  if v_paid + new.amount > v_total + 0.009 then
    raise exception 'Pagamento de % excede o saldo da comanda (total %, já pago %)',
      new.amount, v_total, v_paid;
  end if;

  if new.cash_session_id is null then
    select c.id into v_cash from public.cash_sessions c where c.status = 'aberto' limit 1;
    if v_cash is null then
      raise exception 'Nenhum caixa aberto: abra o caixa antes de registrar pagamentos';
    end if;
    new.cash_session_id := v_cash;
  end if;
  return new;
end $$;
drop trigger if exists trg_payment_validate on payments;
create trigger trg_payment_validate before insert or update on payments
  for each row execute function validate_payment();
