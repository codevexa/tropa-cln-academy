-- ============================================================================
-- DIAMOND BARBEARIA — 0011 Fecha a superfície RPC
--
-- O PostgREST publica TODA função do schema public como endpoint /rest/v1/rpc/.
-- Como as funções internas são SECURITY DEFINER (ignoram RLS por desenho, para
-- os triggers funcionarem), elas ficavam chamáveis por qualquer visitante:
-- um anônimo poderia lançar itens em comanda (bill_appointment), gerar
-- comissões (generate_commissions) ou queimar o pacote de um cliente
-- (consume_package). Esta migration revoga tudo e devolve só o necessário.
--
-- Triggers não dependem de GRANT EXECUTE: continuam funcionando normalmente.
-- ============================================================================

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ------------------------------------------------ site público (visitante) --
grant execute on function public.public_available_slots(uuid, date, uuid, int)
  to anon, authenticated;
grant execute on function public.public_book(uuid, uuid, timestamptz, text, text, text)
  to anon, authenticated;

-- ------------------------------------------------- painel (usuário logado) --
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.consume_package(uuid, uuid, uuid, uuid)  to authenticated;
grant execute on function public.pay_commissions(uuid, uuid[], public.payment_method, text)
  to authenticated;

-- --------------------------------------- auxiliares usadas dentro do RLS ----
-- As policies são avaliadas com os privilégios de quem consulta, então o papel
-- `authenticated` precisa executá-las. Elas só revelam dados do próprio
-- chamador (qual o meu papel, qual o meu id de barbeiro).
grant execute on function public.app_role()          to authenticated;
grant execute on function public.is_owner()          to authenticated;
grant execute on function public.is_staff()          to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.current_barber_id() to authenticated;

-- ----------------------------------- trava extra no consumo de pacote -------
-- consume_package é chamada pelo painel, então precisa continuar acessível ao
-- usuário logado. Sem esta checagem, um barbeiro logado poderia debitar o
-- pacote de qualquer cliente chamando o endpoint direto.
create or replace function consume_package(p_client_package uuid, p_ticket_item uuid, p_barber uuid, p_service uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão para consumir pacote';
  end if;

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

revoke all on function public.consume_package(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.consume_package(uuid, uuid, uuid, uuid) to authenticated;
