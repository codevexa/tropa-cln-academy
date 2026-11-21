\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

-- ===================== preparação (como service_role) ======================
set role postgres;
truncate auth.users cascade;
truncate commissions, commission_payouts, payments, ticket_items, tickets,
         cash_sessions, appointments, appointment_history, clients,
         barber_commission_rules, barber_service_commissions, barbers,
         debts, debt_payments, client_packages, package_uses,
         products, stock_moves, suppliers restart identity cascade;

insert into auth.users (id, email) values
 ('11111111-1111-1111-1111-111111111111','dono@diamond.test'),
 ('22222222-2222-2222-2222-222222222222','admin@diamond.test'),
 ('33333333-3333-3333-3333-333333333333','barbeiro1@diamond.test'),
 ('44444444-4444-4444-4444-444444444444','barbeiro2@diamond.test');

insert into profiles (id, role, full_name, permissions) values
 ('11111111-1111-1111-1111-111111111111','owner','Proprietário','{}'),
 ('22222222-2222-2222-2222-222222222222','admin','Administrador','{"reports":true,"stock":true,"financial":false,"commissions":false}'),
 ('33333333-3333-3333-3333-333333333333','barber','Barbeiro Um','{}'),
 ('44444444-4444-4444-4444-444444444444','barber','Barbeiro Dois','{}');

insert into barbers (id, profile_id, display_name) values
 ('aaaaaaaa-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','Barbeiro Um'),
 ('aaaaaaaa-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444','Barbeiro Dois');

insert into barber_commission_rules (barber_id, basis, value) values
 ('aaaaaaaa-0000-0000-0000-000000000001','percent',50),
 ('aaaaaaaa-0000-0000-0000-000000000002','percent',40);

insert into clients (id, name, phone) values
 ('cccccccc-0000-0000-0000-000000000001','Cliente A','51999990001'),
 ('cccccccc-0000-0000-0000-000000000002','Cliente B','51999990002');

update business_hours set opens='09:00', closes='20:00', closed=false;

\echo '--- T01 caixa único aberto ---'
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
insert into cash_sessions (opened_by, opening_amount) values (auth.uid(), 100);
do $$ begin
  insert into public.cash_sessions (opened_by, opening_amount) values (auth.uid(), 50);
  raise exception 'FALHA: permitiu dois caixas abertos';
exception when unique_violation then raise notice 'OK: segundo caixa bloqueado';
end $$;

\echo '--- T02 agendamento e bloqueio de sobreposicao ---'
insert into appointments (id, client_id, barber_id, service_id, starts_at, ends_at, price, status)
select 'eeeeeeee-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000001', s.id,
       date_trunc('hour', now()) + interval '1 day' + interval '10 hour',
       date_trunc('hour', now()) + interval '1 day' + interval '10 hour 30 min',
       s.price, 'confirmado' from services s where s.name='Corte';
do $$ declare sid uuid; begin
  select id into sid from public.services where name='Barba';
  insert into public.appointments (client_id, barber_id, service_id, starts_at, ends_at, price)
  values ('cccccccc-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001', sid,
          date_trunc('hour', now()) + interval '1 day' + interval '10 hour 15 min',
          date_trunc('hour', now()) + interval '1 day' + interval '10 hour 45 min', 30);
  raise exception 'FALHA: permitiu sobreposicao no mesmo barbeiro';
exception when exclusion_violation then raise notice 'OK: sobreposicao bloqueada';
end $$;

\echo '--- T03 concluir atendimento gera comanda (sem duplicar) ---'
update appointments set status='concluido' where id='eeeeeeee-0000-0000-0000-000000000001';
select 'itens da comanda: '||count(*) from ticket_items where appointment_id='eeeeeeee-0000-0000-0000-000000000001';
do $$ begin
  perform public.bill_appointment('eeeeeeee-0000-0000-0000-000000000001');
  if (select count(*) from public.ticket_items where appointment_id='eeeeeeee-0000-0000-0000-000000000001') > 1 then
    raise exception 'FALHA: faturamento duplicado';
  end if;
  raise notice 'OK: faturamento nao duplicou';
end $$;

\echo '--- T04 pagamento maior que o total e bloqueado ---'
do $$ declare tid uuid; begin
  select ticket_id into tid from public.ticket_items where appointment_id='eeeeeeee-0000-0000-0000-000000000001';
  insert into public.payments (ticket_id, method, amount) values (tid, 'pix', 999);
  raise exception 'FALHA: aceitou pagamento acima do total';
exception when others then
  if sqlerrm like 'FALHA%' then raise; end if;
  raise notice 'OK: pagamento excedente bloqueado (%)', left(sqlerrm, 40);
end $$;

\echo '--- T05 comissao nasce so na quitacao, com a regra do barbeiro ---'
do $$ declare tid uuid; n int; begin
  select ticket_id into tid from public.ticket_items where appointment_id='eeeeeeee-0000-0000-0000-000000000001';
  insert into public.payments (ticket_id, method, amount) values (tid, 'pix', 20);
  select count(*) into n from public.commissions where ticket_id = tid;
  if n <> 0 then raise exception 'FALHA: comissao gerada sem quitacao'; end if;
  raise notice 'OK: pagamento parcial nao gerou comissao';
  insert into public.payments (ticket_id, method, amount) values (tid, 'dinheiro', 17);
  select count(*) into n from public.commissions where ticket_id = tid;
  if n <> 1 then raise exception 'FALHA: esperava 1 comissao, veio %', n; end if;
  raise notice 'OK: comissao gerada na quitacao';
end $$;
select 'comissao: base '||base_amount||' / '||value||'% = R$ '||amount||' ('||status||')' from commissions;

\echo '--- T06 comissao nao duplica ao reprocessar ---'
do $$ declare tid uuid; n int; begin
  select ticket_id into tid from public.ticket_items where appointment_id='eeeeeeee-0000-0000-0000-000000000001';
  perform public.generate_commissions(tid);
  perform public.generate_commissions(tid);
  select count(*) into n from public.commissions where ticket_id = tid;
  if n <> 1 then raise exception 'FALHA: comissao duplicada (%)', n; end if;
  raise notice 'OK: comissao segue unica';
end $$;
