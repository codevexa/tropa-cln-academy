-- =============================================================================
-- 0014 — Índices para os filtros que as telas realmente fazem
-- =============================================================================
--
-- Os 27 índices que já existiam cobrem bem o caminho principal. Faltavam os
-- das colunas que o Dashboard filtra sozinhas, sem a coluna que vem antes no
-- índice composto — nesse caso o Postgres não consegue usar o índice.
--
-- Exemplo: `commissions` tem idx_comm_barber (barber_id, status,
-- generated_at desc). O Dashboard filtra só por generated_at, sem barber_id,
-- então esse índice não serve e sobra varredura sequencial.
--
-- Sobre os 7 índices que o linter do Supabase marcou como "nunca usados":
-- NÃO estão sendo removidos aqui, de propósito. A estatística vem de um banco
-- de três semanas, praticamente vazio e quase sem tráfego. idx_appt_status
-- serve exatamente o filtro (status='concluido', starts_at) do Dashboard e
-- idx_tickets_status serve (status, opened_at desc) das Comandas: os dois
-- passam a ser usados assim que houver movimento. Remover agora seria apagar
-- índice certo por causa de estatística de banco vazio.
-- =============================================================================

-- --------------------------------------------------- filtros do Dashboard ---
-- loadDashboard filtra ticket_items por created_at no período, sem barber_id;
-- idx_items_barber (barber_id, created_at desc) não atende esse caso.
create index if not exists idx_items_data on ticket_items (created_at);

-- clientes novos no período
create index if not exists idx_clients_criado on clients (created_at);

-- comissões do período, sem filtro por profissional
create index if not exists idx_comm_data on commissions (generated_at);

-- ------------------------------- chaves estrangeiras que as telas percorrem --
-- comandas por profissional, e a RLS do barbeiro que casa tickets com ele
create index if not exists idx_tickets_barber on tickets (barber_id);

-- Despesas mostra a categoria junto e permite excluir categoria
create index if not exists idx_expenses_cat on expenses (category_id);

-- Estoque filtra produto por fornecedor e permite excluir fornecedor
create index if not exists idx_products_fornec on products (supplier_id) where supplier_id is not null;

-- Pacotes lista pacotes vendidos com o pacote de origem
create index if not exists idx_cpkg_pacote on client_packages (package_id);

-- detalhe de um pagamento de comissões
create index if not exists idx_comm_payout on commissions (payout_id) where payout_id is not null;

-- excluir serviço precisa varrer quem o referencia
create index if not exists idx_items_servico on ticket_items (service_id) where service_id is not null;
create index if not exists idx_appt_servico on appointments (service_id);

analyze ticket_items;
analyze clients;
analyze commissions;
analyze tickets;
analyze expenses;
analyze products;
analyze client_packages;
analyze appointments;
