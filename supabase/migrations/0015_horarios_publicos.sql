-- =============================================================================
-- 0015 — Horário de funcionamento legível por quem visita o site
-- =============================================================================
--
-- `business_hours` só era legível por usuário autenticado, então o calendário
-- do site não tinha como saber que domingo é fechado: oferecia o dia, o
-- visitante clicava e recebia uma grade vazia sem explicação.
--
-- O horário de funcionamento é informação pública — já aparece escrito na
-- seção de contato do próprio site e na porta da barbearia. Liberar a leitura
-- para `anon` não expõe nada novo; só permite o calendário ser honesto sobre
-- quais dias existem.
--
-- Continua sendo só leitura: escrever segue restrito ao proprietário pela
-- policy hours_write, que não é tocada aqui.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'business_hours'
       and policyname = 'hours_read_publico'
  ) then
    create policy hours_read_publico on public.business_hours
      for select to anon using (true);
  end if;
end $$;
