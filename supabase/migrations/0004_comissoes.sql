-- ============================================================================
-- DIAMOND BARBEARIA — 0004 Comissões
-- Regra individual por barbeiro, com override por serviço.
-- Tabela separada de `barbers` para que o RLS esconda a regra dos colegas.
-- ============================================================================

create table if not exists barber_commission_rules (
  barber_id uuid primary key references barbers(id) on delete cascade,
  basis     commission_basis not null default 'percent',
  value     numeric(10,2) not null check (value >= 0),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
comment on table barber_commission_rules is 'Regra padrão do barbeiro. percent = % sobre o item; fixed = valor em R$ por item.';

create table if not exists barber_service_commissions (
  barber_id  uuid not null references barbers(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  basis      commission_basis not null,
  value      numeric(10,2) not null check (value >= 0),
  primary key (barber_id, service_id)
);

create table if not exists commission_payouts (
  id        uuid primary key default gen_random_uuid(),
  barber_id uuid not null references barbers(id) on delete restrict,
  amount    numeric(10,2) not null check (amount > 0),
  method    payment_method,
  paid_at   timestamptz not null default now(),
  paid_by   uuid references profiles(id),
  notes     text
);
create index if not exists idx_payouts_barber on commission_payouts (barber_id, paid_at desc);

create table if not exists commissions (
  id             uuid primary key default gen_random_uuid(),
  barber_id      uuid not null references barbers(id) on delete restrict,
  ticket_item_id uuid not null unique references ticket_items(id) on delete cascade,
  ticket_id      uuid not null references tickets(id) on delete cascade,
  base_amount    numeric(10,2) not null check (base_amount >= 0),
  basis          commission_basis not null,
  value          numeric(10,2) not null,
  amount         numeric(10,2) not null check (amount >= 0),
  status         commission_status not null default 'pendente',
  payout_id      uuid references commission_payouts(id) on delete set null,
  generated_at   timestamptz not null default now(),
  paid_at        timestamptz
);
comment on column commissions.ticket_item_id is
  'UNIQUE: impede que o mesmo item gere comissão duas vezes.';
create index if not exists idx_comm_barber on commissions (barber_id, status, generated_at desc);
create index if not exists idx_comm_ticket on commissions (ticket_id);

-- --------------------------------------------------- resolução da regra ----
create or replace function resolve_commission(
  p_barber uuid, p_service uuid, p_base numeric,
  out o_basis commission_basis, out o_value numeric, out o_amount numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  select bsc.basis, bsc.value into o_basis, o_value
    from public.barber_service_commissions bsc
   where bsc.barber_id = p_barber and bsc.service_id = p_service;

  if o_basis is null then
    select bcr.basis, bcr.value into o_basis, o_value
      from public.barber_commission_rules bcr where bcr.barber_id = p_barber;
  end if;

  if o_basis is null then
    o_basis := 'percent'; o_value := 0;
  end if;

  o_amount := case when o_basis = 'percent'
                   then round(p_base * o_value / 100.0, 2)
                   else round(o_value, 2) end;
end $$;

-- ------------------------------------- geração automática após quitação ----
-- Comissão nasce só quando a comanda está integralmente paga.
create or replace function generate_commissions(p_ticket uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare r record; v_rule record; v_total numeric; v_paid numeric; n int := 0;
begin
  select t.total, t.paid_total into v_total, v_paid
    from public.tickets t where t.id = p_ticket;
  if v_total is null or v_paid < v_total - 0.009 or v_total = 0 then
    return 0;
  end if;

  for r in
    select ti.id, ti.barber_id, ti.service_id, ti.total
      from public.ticket_items ti
     where ti.ticket_id = p_ticket
       and ti.barber_id is not null
       and ti.service_id is not null
       and not ti.covered_by_package
       and not exists (select 1 from public.commissions cc where cc.ticket_item_id = ti.id)
  loop
    select * into v_rule from public.resolve_commission(r.barber_id, r.service_id, r.total);
    insert into public.commissions
      (barber_id, ticket_item_id, ticket_id, base_amount, basis, value, amount)
    values (r.barber_id, r.id, p_ticket, r.total, v_rule.o_basis, v_rule.o_value, v_rule.o_amount)
    on conflict (ticket_item_id) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function trg_commission_on_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_ticket uuid; v_total numeric; v_paid numeric;
begin
  v_ticket := coalesce(new.ticket_id, old.ticket_id);
  select t.total, t.paid_total into v_total, v_paid
    from public.tickets t where t.id = v_ticket;

  if v_paid >= v_total - 0.009 and v_total > 0 then
    perform public.generate_commissions(v_ticket);
  else
    -- pagamento estornado: comissões ainda pendentes voltam atrás.
    -- As já pagas ao barbeiro permanecem (bloqueado explicitamente).
    if exists (select 1 from public.commissions cc
                where cc.ticket_id = v_ticket and cc.status = 'paga') then
      raise exception 'Há comissões já pagas nesta comanda; estorne o repasse antes';
    end if;
    delete from public.commissions where ticket_id = v_ticket and status = 'pendente';
  end if;
  return coalesce(new, old);
end $$;

-- roda depois do recálculo de totais (ordem alfabética dos triggers)
drop trigger if exists trg_z_commission on payments;
create trigger trg_z_commission after insert or update or delete on payments
  for each row execute function trg_commission_on_payment();

-- ------------------------------------------------ repasse das comissões ----
create or replace function pay_commissions(p_barber uuid, p_ids uuid[], p_method payment_method default null, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_payout uuid; v_amount numeric;
begin
  if not public.is_owner() then
    raise exception 'Apenas o proprietário registra repasse de comissões';
  end if;

  select coalesce(sum(cc.amount), 0) into v_amount
    from public.commissions cc
   where cc.id = any(p_ids) and cc.barber_id = p_barber and cc.status = 'pendente';

  if v_amount <= 0 then
    raise exception 'Nenhuma comissão pendente nesta seleção';
  end if;

  insert into public.commission_payouts (barber_id, amount, method, paid_by, notes)
  values (p_barber, v_amount, p_method, auth.uid(), p_notes)
  returning id into v_payout;

  update public.commissions
     set status = 'paga', payout_id = v_payout, paid_at = now()
   where id = any(p_ids) and barber_id = p_barber and status = 'pendente';

  return v_payout;
end $$;
