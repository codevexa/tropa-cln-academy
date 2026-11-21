-- ============================================================================
-- DIAMOND BARBEARIA — 0002 Agenda: horários, folgas e agendamentos
-- ============================================================================

-- Horário de funcionamento da barbearia (0 = domingo … 6 = sábado)
create table if not exists business_hours (
  weekday int primary key check (weekday between 0 and 6),
  opens   time,
  closes  time,
  closed  boolean not null default false,
  check (closed or (opens is not null and closes is not null and closes > opens))
);

-- Jornada individual do barbeiro. Sem linha para o dia = segue o horário da casa.
create table if not exists barber_schedules (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid not null references barbers(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),
  starts     time not null,
  ends       time not null,
  active     boolean not null default true,
  check (ends > starts),
  unique (barber_id, weekday, starts)
);

-- Folgas, intervalos e bloqueios pontuais
create table if not exists barber_time_off (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid not null references barbers(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- um barbeiro não pode ter duas folgas sobrepostas
  exclude using gist (barber_id with =, tstzrange(starts_at, ends_at) with &&)
);

-- --------------------------------------------------------- agendamentos ----
create table if not exists appointments (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete set null,
  barber_id     uuid not null references barbers(id) on delete restrict,
  service_id    uuid not null references services(id) on delete restrict,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        appointment_status not null default 'aguardando',
  price         numeric(10,2) not null check (price >= 0),
  source        text not null default 'painel' check (source in ('site','painel')),
  notes         text,
  client_name   text,   -- preenchido quando o agendamento vem do site sem cadastro
  client_phone  text,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  cancel_reason text,
  check (ends_at > starts_at),
  -- REGRA: dois atendimentos não podem ocupar o mesmo barbeiro ao mesmo tempo.
  -- Cancelados liberam o horário.
  constraint no_overlap_per_barber
    exclude using gist (barber_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status <> 'cancelado')
);
create index if not exists idx_appt_barber_day on appointments (barber_id, starts_at);
create index if not exists idx_appt_status     on appointments (status, starts_at);
create index if not exists idx_appt_client     on appointments (client_id, starts_at desc);

-- Histórico de mudanças de status (rastreabilidade exigida)
create table if not exists appointment_history (
  id             bigserial primary key,
  appointment_id uuid not null references appointments(id) on delete cascade,
  from_status    appointment_status,
  to_status      appointment_status not null,
  changed_by     uuid references profiles(id),
  changed_at     timestamptz not null default now(),
  note           text
);
create index if not exists idx_appt_hist on appointment_history (appointment_id, changed_at desc);

create or replace function log_appointment_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.appointment_history (appointment_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.appointment_history (appointment_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(), new.cancel_reason);
  end if;
  return new;
end $$;

drop trigger if exists trg_appt_history on appointments;
create trigger trg_appt_history after insert or update on appointments
  for each row execute function log_appointment_status();

-- Marca a hora do cancelamento automaticamente
create or replace function stamp_cancelled_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    new.cancelled_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_appt_cancel on appointments;
create trigger trg_appt_cancel before update on appointments
  for each row execute function stamp_cancelled_at();
