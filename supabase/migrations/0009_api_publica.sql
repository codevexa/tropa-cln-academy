-- ============================================================================
-- DIAMOND BARBEARIA — 0009 API pública do site (visitante sem login)
-- O visitante NUNCA lê a tabela de agendamentos (vazaria dados de clientes).
-- Ele enxerga só serviços/profissionais ativos e conversa por duas funções.
-- ============================================================================

create policy services_public on services for select to anon using (active);
create policy barbers_public  on barbers  for select to anon using (active);
grant select on services, barbers to anon;

-- Horários livres de um barbeiro num dia, respeitando jornada, folgas,
-- duração do serviço e agendamentos existentes.
create or replace function public_available_slots(
  p_barber uuid, p_date date, p_service uuid, p_step_min int default 30)
returns table (slot timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_dow int; v_open time; v_close time; v_dur int; v_closed boolean;
  v_start timestamptz; v_end timestamptz; v_cur timestamptz;
begin
  select s.duration_min into v_dur from public.services s where s.id = p_service and s.active;
  if v_dur is null then return; end if;

  v_dow := extract(dow from p_date);

  -- jornada individual tem prioridade sobre o horário da casa
  select bs.starts, bs.ends into v_open, v_close
    from public.barber_schedules bs
   where bs.barber_id = p_barber and bs.weekday = v_dow and bs.active
   order by bs.starts limit 1;

  if v_open is null then
    select bh.opens, bh.closes, bh.closed into v_open, v_close, v_closed
      from public.business_hours bh where bh.weekday = v_dow;
    if v_closed or v_open is null then return; end if;
  end if;

  v_start := (p_date + v_open) at time zone 'America/Sao_Paulo';
  v_end   := (p_date + v_close) at time zone 'America/Sao_Paulo';
  v_cur   := v_start;

  while v_cur + make_interval(mins => v_dur) <= v_end loop
    if v_cur > now()
       and not exists (
         select 1 from public.appointments a
          where a.barber_id = p_barber and a.status <> 'cancelado'
            and tstzrange(a.starts_at, a.ends_at)
                && tstzrange(v_cur, v_cur + make_interval(mins => v_dur)))
       and not exists (
         select 1 from public.barber_time_off o
          where o.barber_id = p_barber
            and tstzrange(o.starts_at, o.ends_at)
                && tstzrange(v_cur, v_cur + make_interval(mins => v_dur)))
    then
      slot := v_cur; return next;
    end if;
    v_cur := v_cur + make_interval(mins => p_step_min);
  end loop;
end $$;

-- Cria o agendamento vindo do site. Reaproveita o cliente pelo telefone.
-- A constraint de sobreposição é a palavra final contra corrida de dois
-- visitantes pedindo o mesmo horário.
create or replace function public_book(
  p_barber uuid, p_service uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_notes text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_dur int; v_price numeric; v_client uuid; v_id uuid;
begin
  if p_name is null or length(btrim(p_name)) < 2 then
    raise exception 'Informe o nome';
  end if;
  if p_phone is null or length(regexp_replace(p_phone, '\D', '', 'g')) < 10 then
    raise exception 'Informe um telefone válido com DDD';
  end if;
  if p_starts_at <= now() then
    raise exception 'Escolha um horário futuro';
  end if;

  select s.duration_min, s.price into v_dur, v_price
    from public.services s where s.id = p_service and s.active;
  if v_dur is null then raise exception 'Serviço indisponível'; end if;

  if not exists (select 1 from public.barbers b where b.id = p_barber and b.active) then
    raise exception 'Profissional indisponível';
  end if;

  -- o horário precisa estar na lista de livres calculada pelo servidor
  if not exists (
    select 1 from public.public_available_slots(p_barber, (p_starts_at at time zone 'America/Sao_Paulo')::date, p_service)
     where slot = p_starts_at) then
    raise exception 'Horário indisponível';
  end if;

  select c.id into v_client from public.clients c
   where regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g');
  if v_client is null then
    insert into public.clients (name, phone) values (btrim(p_name), p_phone)
    returning id into v_client;
  end if;

  insert into public.appointments
    (client_id, barber_id, service_id, starts_at, ends_at, status, price, source,
     notes, client_name, client_phone)
  values (v_client, p_barber, p_service, p_starts_at,
          p_starts_at + make_interval(mins => v_dur), 'aguardando', v_price, 'site',
          p_notes, btrim(p_name), p_phone)
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public_available_slots(uuid, date, uuid, int) from public;
revoke all on function public_book(uuid, uuid, timestamptz, text, text, text) from public;
grant execute on function public_available_slots(uuid, date, uuid, int) to anon, authenticated;
grant execute on function public_book(uuid, uuid, timestamptz, text, text, text) to anon, authenticated;
