-- Fixtures de teste (executadas como superusuário).
set client_min_messages = warning;
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
