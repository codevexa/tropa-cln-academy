-- ============================================================================
-- DIAMOND BARBEARIA — 0006 Estoque, fornecedores e despesas
-- ============================================================================

create table if not exists suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  email      text,
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sku         text unique,
  unit        text not null default 'un',
  stock_qty   numeric(10,2) not null default 0,
  min_qty     numeric(10,2) not null default 0 check (min_qty >= 0),
  cost_price  numeric(10,2) not null default 0 check (cost_price >= 0),
  sale_price  numeric(10,2) not null default 0 check (sale_price >= 0),
  supplier_id uuid references suppliers(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_products_low on products (stock_qty) where active;

alter table ticket_items
  drop constraint if exists ticket_items_product_id_fkey,
  add constraint ticket_items_product_id_fkey
    foreign key (product_id) references products(id) on delete restrict;

create table if not exists stock_moves (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  type       stock_move_type not null,
  qty        numeric(10,2) not null check (qty > 0),
  unit_cost  numeric(10,2),
  reason     text,
  ref_ticket_item_id uuid unique references ticket_items(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_moves_product on stock_moves (product_id, created_at desc);

-- Saldo do produto sempre derivado das movimentações.
create or replace function apply_stock_move() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_delta numeric; v_stock numeric;
begin
  if tg_op = 'INSERT' then
    v_delta := case new.type when 'entrada' then new.qty
                             when 'saida'   then -new.qty
                             else new.qty end;
    if new.type = 'saida' then
      select p.stock_qty into v_stock from public.products p where p.id = new.product_id for update;
      if v_stock < new.qty then
        raise exception 'Estoque insuficiente: % disponível, % solicitado', v_stock, new.qty;
      end if;
    end if;
    if new.type = 'ajuste' then
      update public.products set stock_qty = new.qty where id = new.product_id;
    else
      update public.products set stock_qty = stock_qty + v_delta where id = new.product_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.type = 'ajuste' then
      raise exception 'Ajuste de estoque não pode ser excluído; lance um novo ajuste';
    end if;
    v_delta := case old.type when 'entrada' then -old.qty else old.qty end;
    update public.products set stock_qty = stock_qty + v_delta where id = old.product_id;
    return old;
  end if;
  return null;
end $$;
drop trigger if exists trg_stock_move on stock_moves;
create trigger trg_stock_move after insert or delete on stock_moves
  for each row execute function apply_stock_move();

-- --------------------------------------------------------------- compras --
create table if not exists purchases (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid references suppliers(id) on delete set null,
  total        numeric(10,2) not null default 0 check (total >= 0),
  purchased_at date not null default current_date,
  notes        text,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create table if not exists purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases(id) on delete cascade,
  product_id  uuid not null references products(id) on delete restrict,
  qty         numeric(10,2) not null check (qty > 0),
  unit_cost   numeric(10,2) not null check (unit_cost >= 0),
  move_id     uuid references stock_moves(id) on delete set null
);

-- Item de compra dá entrada no estoque automaticamente
create or replace function trg_purchase_item() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_move uuid;
begin
  insert into public.stock_moves (product_id, type, qty, unit_cost, reason, created_by)
  values (new.product_id, 'entrada', new.qty, new.unit_cost, 'Compra', auth.uid())
  returning id into v_move;
  new.move_id := v_move;

  update public.products set cost_price = new.unit_cost where id = new.product_id;
  return new;
end $$;
drop trigger if exists trg_purchase_item_in on purchase_items;
create trigger trg_purchase_item_in before insert on purchase_items
  for each row execute function trg_purchase_item();

create or replace function trg_purchase_total() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.purchases p
     set total = (select coalesce(sum(pi.qty * pi.unit_cost), 0)
                    from public.purchase_items pi where pi.purchase_id = p.id)
   where p.id = coalesce(new.purchase_id, old.purchase_id);
  return coalesce(new, old);
end $$;
drop trigger if exists trg_purchase_sum on purchase_items;
create trigger trg_purchase_sum after insert or update or delete on purchase_items
  for each row execute function trg_purchase_total();

-- -------------------------------------------------------------- despesas --
create table if not exists expense_categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists expenses (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references expense_categories(id) on delete set null,
  description     text not null,
  amount          numeric(10,2) not null check (amount > 0),
  due_date        date,
  paid_at         timestamptz,
  method          payment_method,
  cash_session_id uuid references cash_sessions(id) on delete set null,
  supplier_id     uuid references suppliers(id) on delete set null,
  purchase_id     uuid references purchases(id) on delete set null,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now()
);
create index if not exists idx_expenses_paid on expenses (paid_at);
create index if not exists idx_expenses_due  on expenses (due_date) where paid_at is null;
