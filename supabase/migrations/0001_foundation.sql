-- ============================================================================
-- DIAMOND BARBEARIA — 0001 Fundação: extensões, enums, perfis e permissões
-- ============================================================================
create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------- enums ----
do $$ begin create type user_role as enum ('owner','admin','barber'); exception when duplicate_object then null; end $$;
do $$ begin create type appointment_status as enum ('aguardando','confirmado','em_atendimento','concluido','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type payment_method as enum ('dinheiro','pix','credito','debito','fiado'); exception when duplicate_object then null; end $$;
do $$ begin create type commission_basis as enum ('percent','fixed'); exception when duplicate_object then null; end $$;
do $$ begin create type commission_status as enum ('pendente','paga','cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type ticket_status as enum ('aberta','fechada','cancelada'); exception when duplicate_object then null; end $$;
do $$ begin create type cash_status as enum ('aberto','fechado'); exception when duplicate_object then null; end $$;
do $$ begin create type debt_status as enum ('pendente','parcial','quitado'); exception when duplicate_object then null; end $$;
do $$ begin create type client_package_status as enum ('ativo','esgotado','expirado','cancelado'); exception when duplicate_object then null; end $$;
do $$ begin create type stock_move_type as enum ('entrada','saida','ajuste'); exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- profiles ----
-- Espelha auth.users. `permissions` guarda as permissões extras do ADMINISTRADOR
-- (o proprietário tem tudo; o barbeiro não usa este campo).
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'barber',
  full_name   text not null,
  phone       text,
  email       text,
  active      boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on column profiles.permissions is
  'Permissões do perfil admin: {"reports":true,"financial":false,"stock":true,...}. Ignorado para owner (tudo) e barber (nada).';

-- -------------------------------------------------------- funções de RLS ----
-- SECURITY DEFINER + search_path fixo: as policies consultam profiles sem
-- recursão e sem depender do search_path de quem chama.
create or replace function app_role() returns user_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() = 'owner', false)
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.app_role() in ('owner','admin'), false)
$$;

create or replace function has_permission(flag text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when public.app_role() = 'owner' then true
    when public.app_role() = 'admin' then coalesce(
      (select p.permissions ->> flag from public.profiles p where p.id = auth.uid())::boolean, false)
    else false
  end
$$;

-- -------------------------------------------------------------- barbeiros --
create table if not exists barbers (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid unique references profiles(id) on delete set null,
  display_name text not null,
  specialty    text,
  bio          text,
  photo_url    text,
  active       boolean not null default true,
  order_index  int not null default 0,
  created_at   timestamptz not null default now()
);

create or replace function current_barber_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select b.id from public.barbers b where b.profile_id = auth.uid() and b.active
$$;

-- --------------------------------------------------------------- serviços --
create table if not exists services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  duration_min int  not null check (duration_min > 0),
  price        numeric(10,2) not null check (price >= 0),
  category     text not null default 'geral',
  active       boolean not null default true,
  order_index  int not null default 0,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------------- clientes --
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text unique,
  birthdate   date,
  notes       text,
  preferences text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_clients_name on clients (lower(name));

-- ------------------------------------------------------------ auditoria ----
create table if not exists audit_log (
  id         bigserial primary key,
  actor_id   uuid references profiles(id),
  action     text not null,
  entity     text not null,
  entity_id  text,
  data       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on audit_log (entity, entity_id, created_at desc);

-- ------------------------------------------------------- configurações -----
create table if not exists settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- updated_at automático
create or replace function touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
  for each row execute function touch_updated_at();
drop trigger if exists trg_clients_touch on clients;
create trigger trg_clients_touch before update on clients
  for each row execute function touch_updated_at();
