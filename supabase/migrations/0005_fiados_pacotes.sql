-- ============================================================================
-- DIAMOND BARBEARIA — 0005 Fiados e pacotes
-- ============================================================================

-- ----------------------------------------------------------------- fiados --
create table if not exists debts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete restrict,
  ticket_id       uuid references tickets(id) on delete set null,
  original_amount numeric(10,2) not null check (original_amount > 0),
  paid_amount     numeric(10,2) not null default 0 check (paid_amount >= 0),
  status          debt_status not null default 'pendente',
  origin_date     date not null default current_date,
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index if not exists idx_debts_client on debts (client_id, status);
create index if not exists idx_debts_status on debts (status, origin_date);

create table if not exists debt_payments (
  id              uuid primary key default gen_random_uuid(),
  debt_id         uuid not null references debts(id) on delete cascade,
  amount          numeric(10,2) not null check (amount > 0),
  method          payment_method not null default 'dinheiro',
  paid_at         timestamptz not null default now(),
  received_by     uuid references profiles(id),
  cash_session_id uuid references cash_sessions(id) on delete set null,
  notes           text
);
create index if not exists idx_debt_pay on debt_payments (debt_id, paid_at);

-- Saldo e situação recalculados a cada pagamento; impede pagar mais que a dívida.
create or replace function recalc_debt(p_debt uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_orig numeric; v_paid numeric;
begin
  select d.original_amount into v_orig from public.debts d where d.id = p_debt;
  select coalesce(sum(dp.amount), 0) into v_paid
    from public.debt_payments dp where dp.debt_id = p_debt;

  update public.debts
     set paid_amount = v_paid,
         status = case when v_paid >= v_orig - 0.009 then 'quitado'::public.debt_status
                       when v_paid > 0               then 'parcial'::public.debt_status
                       else 'pendente'::public.debt_status end
   where id = p_debt;
end $$;

create or replace function validate_debt_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_orig numeric; v_paid numeric; v_cash uuid;
begin
  select d.original_amount into v_orig from public.debts d where d.id = new.debt_id for update;
  select coalesce(sum(dp.amount), 0) into v_paid
    from public.debt_payments dp where dp.debt_id = new.debt_id and dp.id <> new.id;
  if v_paid + new.amount > v_orig + 0.009 then
    raise exception 'Pagamento de % excede o saldo do fiado (original %, já pago %)',
      new.amount, v_orig, v_paid;
  end if;
  if new.cash_session_id is null then
    select c.id into v_cash from public.cash_sessions c where c.status = 'aberto' limit 1;
    new.cash_session_id := v_cash;
  end if;
  return new;
end $$;
drop trigger if exists trg_debt_pay_validate on debt_payments;
create trigger trg_debt_pay_validate before insert or update on debt_payments
  for each row execute function validate_debt_payment();

create or replace function trg_recalc_debt() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.recalc_debt(coalesce(new.debt_id, old.debt_id));
  return coalesce(new, old);
end $$;
drop trigger if exists trg_debt_recalc on debt_payments;
create trigger trg_debt_recalc after insert or update or delete on debt_payments
  for each row execute function trg_recalc_debt();

-- --------------------------------------------------------------- pacotes --
create table if not exists packages (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  price         numeric(10,2) not null check (price >= 0),
  uses_total    int not null check (uses_total > 0),
  validity_days int,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists package_services (
  package_id uuid not null references packages(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (package_id, service_id)
);

create table if not exists client_packages (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete restrict,
  package_id   uuid not null references packages(id) on delete restrict,
  ticket_id    uuid references tickets(id) on delete set null,
  purchased_at timestamptz not null default now(),
  expires_at   timestamptz,
  uses_total   int not null check (uses_total > 0),
  uses_left    int not null check (uses_left >= 0),
  status       client_package_status not null default 'ativo',
  created_by   uuid references profiles(id),
  check (uses_left <= uses_total)
);
create index if not exists idx_cpkg_client on client_packages (client_id, status);

create table if not exists package_uses (
  id                uuid primary key default gen_random_uuid(),
  client_package_id uuid not null references client_packages(id) on delete cascade,
  ticket_item_id    uuid unique references ticket_items(id) on delete set null,
  barber_id         uuid references barbers(id) on delete set null,
  service_id        uuid references services(id) on delete set null,
  used_at           timestamptz not null default now()
);

-- Consumo de pacote: debita 1 uso, bloqueia pacote esgotado/vencido,
-- e o UNIQUE em ticket_item_id impede debitar duas vezes pelo mesmo item.
create or replace function consume_package(p_client_package uuid, p_ticket_item uuid, p_barber uuid, p_service uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  select * into v from public.client_packages where id = p_client_package for update;
  if v is null then raise exception 'Pacote do cliente não encontrado'; end if;
  if v.status <> 'ativo' then raise exception 'Pacote % não está ativo', v.status; end if;
  if v.uses_left <= 0 then raise exception 'Pacote sem utilizações restantes'; end if;
  if v.expires_at is not null and v.expires_at < now() then
    update public.client_packages set status = 'expirado' where id = p_client_package;
    raise exception 'Pacote vencido em %', v.expires_at::date;
  end if;

  insert into public.package_uses (client_package_id, ticket_item_id, barber_id, service_id)
  values (p_client_package, p_ticket_item, p_barber, p_service);

  update public.client_packages
     set uses_left = uses_left - 1,
         status = case when uses_left - 1 <= 0 then 'esgotado'::public.client_package_status
                       else status end
   where id = p_client_package;

  update public.ticket_items
     set covered_by_package = true, unit_price = 0, total = 0
   where id = p_ticket_item;
end $$;
