-- ============================================================================
-- DIAMOND BARBEARIA — 0010 Dados iniciais
-- Apenas dados REAIS fornecidos pelo estabelecimento. Nada inventado:
-- horários de funcionamento entram fechados até o proprietário configurar.
-- ============================================================================

insert into services (name, duration_min, price, category, order_index) values
  ('Barba',                           30,  30.00, 'barba',  1),
  ('Barba + Sobrancelha',             30,  37.00, 'barba',  2),
  ('Corte',                           30,  37.00, 'corte',  3),
  ('Corte + Barba',                   60,  60.00, 'combo',  4),
  ('Corte + Barba + Sobrancelha',     60,  65.00, 'combo',  5),
  ('Corte + Sobrancelha',             30,  45.00, 'combo',  6),
  ('Máquina',                         30,  28.00, 'corte',  7),
  ('Máquina + Barba',                 60,  55.00, 'combo',  8),
  ('Máquina + Barba + Sobrancelha',   60,  60.00, 'combo',  9),
  ('Máquina + Sobrancelha',           30,  37.00, 'combo', 10),
  ('Pacote 4 Cabelo + Barba',         30, 220.00, 'pacote',11),
  ('Pacote 4 Cortes',                 30, 130.00, 'pacote',12),
  ('Pacote 4 Cortes Máquina',         30, 110.00, 'pacote',13),
  ('Pigmentação',                     30,  25.00, 'extra', 14),
  ('Sobrancelha',                     10,  10.00, 'extra', 15)
on conflict (name) do update
  set duration_min = excluded.duration_min,
      price        = excluded.price,
      category     = excluded.category,
      order_index  = excluded.order_index;

-- Horário de funcionamento: fechado até ser configurado pelo proprietário.
insert into business_hours (weekday, opens, closes, closed)
select g, null, null, true from generate_series(0,6) g
on conflict (weekday) do nothing;

-- Pacotes derivados dos serviços de pacote já praticados pela barbearia.
insert into packages (name, price, uses_total, validity_days, description)
values
  ('Pacote 4 Cortes',          130.00, 4, null, 'Quatro cortes, conforme tabela da barbearia.'),
  ('Pacote 4 Cortes Máquina',  110.00, 4, null, 'Quatro cortes na máquina.'),
  ('Pacote 4 Cabelo + Barba',  220.00, 4, null, 'Quatro atendimentos de cabelo e barba.')
on conflict do nothing;

-- Categorias de despesa: rótulos padrão, editáveis pelo proprietário.
insert into expense_categories (name) values
  ('Aluguel'), ('Produtos'), ('Energia'), ('Água'), ('Internet'),
  ('Salários'), ('Impostos'), ('Manutenção'), ('Marketing'), ('Outros')
on conflict (name) do nothing;

-- Dados do estabelecimento informados pelo cliente.
insert into settings (key, value) values
  ('business', jsonb_build_object(
      'name',    'Diamond Barbearia',
      'since',   2015,
      'phone',   '(51) 98454-6144',
      'address', 'Av. Protásio Alves, 6585',
      'city',    'Porto Alegre',
      'state',   'RS',
      'instagram', null,
      'timezone','America/Sao_Paulo')),
  ('agenda', jsonb_build_object('slot_step_min', 30, 'allow_site_booking', true))
on conflict (key) do nothing;
