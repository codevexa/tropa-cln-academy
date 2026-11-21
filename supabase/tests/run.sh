#!/usr/bin/env bash
# Suíte de testes do backend Diamond Barbearia.
# Cada bloco roda numa sessão própria, autenticada como um perfil real.
set -uo pipefail
PSQL="psql -h /var/run/postgresql -p 5433 -U postgres -d diamond -qtAX -v ON_ERROR_STOP=1"
DONO=11111111-1111-1111-1111-111111111111
ADMIN=22222222-2222-2222-2222-222222222222
B1=33333333-3333-3333-3333-333333333333
B2=44444444-4444-4444-4444-444444444444
BARB1=aaaaaaaa-0000-0000-0000-000000000001
BARB2=aaaaaaaa-0000-0000-0000-000000000002

PASS=0; FAIL=0
as() { # as <uid> <sql>
  local uid="$1"; shift
  $PSQL -c "set role authenticated; set \"request.jwt.claim.sub\" = '$uid'; $1" 2>&1
}
check() { # check <descricao> <esperado> <obtido>
  if [[ "$3" == "$2" ]]; then printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1));
  else printf '  \033[31m✗\033[0m %s\n      esperado: %s\n      obtido:   %s\n' "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi
}
contains() { # contains <descricao> <trecho> <obtido>
  if [[ "$3" == *"$2"* ]]; then printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1));
  else printf '  \033[31m✗\033[0m %s\n      devia conter: %s\n      obtido: %s\n' "$1" "$2" "$3"; FAIL=$((FAIL+1)); fi
}

echo ""
echo "═══ CAIXA ═══"
$PSQL -c "set role postgres; truncate commissions, payments, ticket_items, tickets, cash_sessions, appointments, appointment_history restart identity cascade;" >/dev/null
r=$(as $DONO "insert into cash_sessions (opened_by, opening_amount) values (auth.uid(), 100) returning 'ok';")
check "proprietário abre o caixa" "ok" "$r"
r=$(as $DONO "insert into cash_sessions (opened_by, opening_amount) values (auth.uid(), 50) returning 'ok';")
contains "segundo caixa simultâneo é bloqueado" "uniq_open_cash" "$r"
r=$(as $B1 "select count(*) from cash_sessions;")
check "BARBEIRO não enxerga o caixa da barbearia" "0" "$r"

echo ""
echo "═══ AGENDA ═══"
SID=$($PSQL -c "set role postgres; select id from services where name='Corte';")
SID2=$($PSQL -c "set role postgres; select id from services where name='Barba';")
r=$(as $DONO "insert into appointments (id, client_id, barber_id, service_id, starts_at, ends_at, price, status)
  values ('eeeeeeee-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','$BARB1','$SID',
  date_trunc('hour',now())+interval '1 day 10 hour', date_trunc('hour',now())+interval '1 day 10 hour 30 min', 37,'confirmado') returning 'ok';")
check "agendamento criado" "ok" "$r"
r=$(as $DONO "insert into appointments (client_id, barber_id, service_id, starts_at, ends_at, price)
  values ('cccccccc-0000-0000-0000-000000000002','$BARB1','$SID2',
  date_trunc('hour',now())+interval '1 day 10 hour 15 min', date_trunc('hour',now())+interval '1 day 10 hour 45 min', 30) returning 'ok';")
contains "horário sobreposto no mesmo barbeiro é recusado" "no_overlap_per_barber" "$r"
r=$(as $DONO "insert into appointments (client_id, barber_id, service_id, starts_at, ends_at, price)
  values ('cccccccc-0000-0000-0000-000000000002','$BARB2','$SID2',
  date_trunc('hour',now())+interval '1 day 10 hour 15 min', date_trunc('hour',now())+interval '1 day 10 hour 45 min', 30) returning 'ok';")
check "mesmo horário em outro barbeiro é aceito" "ok" "$r"
r=$(as $DONO "select count(*) from appointment_history where appointment_id='eeeeeeee-0000-0000-0000-000000000001';")
check "histórico de status registrado" "1" "$r"

echo ""
echo "═══ ISOLAMENTO ENTRE BARBEIROS ═══"
r=$(as $B1 "select count(*) from appointments;")
check "barbeiro 1 vê apenas o próprio agendamento" "1" "$r"
r=$(as $B2 "select count(*) from appointments;")
check "barbeiro 2 vê apenas o próprio agendamento" "1" "$r"
r=$(as $DONO "select count(*) from appointments;")
check "proprietário vê os dois" "2" "$r"
r=$(as $B1 "select count(*) from barber_commission_rules;")
check "barbeiro vê só a própria regra de comissão" "1" "$r"
r=$(as $B1 "select value from barber_commission_rules;")
check "e a regra é a dele (50%)" "50.00" "$r"
r=$(as $B1 "update barber_commission_rules set value=90 where barber_id='$BARB1' returning 'ok';")
check "barbeiro NÃO altera a própria comissão" "" "$r"
r=$(as $B1 "update appointments set barber_id='$BARB2' where id='eeeeeeee-0000-0000-0000-000000000001' returning 'ok';")
contains "barbeiro NÃO transfere atendimento para outro" "violates row-level security" "$r"

echo ""
echo "═══ COMANDA, FATURAMENTO E COMISSÃO ═══"
r=$(as $DONO "update appointments set status='concluido' where id='eeeeeeee-0000-0000-0000-000000000001' returning 'ok';")
check "atendimento concluído" "ok" "$r"
r=$(as $DONO "select count(*) from ticket_items where appointment_id='eeeeeeee-0000-0000-0000-000000000001';")
check "concluir lançou o item na comanda automaticamente" "1" "$r"
r=$(as $DONO "select public.bill_appointment('eeeeeeee-0000-0000-0000-000000000001');")
contains "bill_appointment NÃO é chamável por RPC" "permission denied" "$r"
r=$(as $DONO "select count(*) from ticket_items where appointment_id='eeeeeeee-0000-0000-0000-000000000001';")
check "FATURAMENTO NÃO DUPLICOU" "1" "$r"
TID=$($PSQL -c "set role postgres; select ticket_id from ticket_items where appointment_id='eeeeeeee-0000-0000-0000-000000000001';")
r=$(as $DONO "select total from tickets where id='$TID';")
check "total da comanda = preço do serviço" "37.00" "$r"
r=$(as $DONO "insert into payments (ticket_id, method, amount) values ('$TID','pix',999) returning 'ok';")
contains "pagamento acima do total é recusado" "excede o saldo" "$r"
r=$(as $DONO "insert into payments (ticket_id, method, amount) values ('$TID','pix',20) returning 'ok';")
check "pagamento parcial aceito" "ok" "$r"
r=$(as $DONO "select count(*) from commissions where ticket_id='$TID';")
check "pagamento parcial NÃO gera comissão" "0" "$r"
r=$(as $DONO "insert into payments (ticket_id, method, amount) values ('$TID','dinheiro',17) returning 'ok';")
check "quitação aceita" "ok" "$r"
r=$(as $DONO "select count(*) from commissions where ticket_id='$TID';")
check "comissão gerada na quitação" "1" "$r"
r=$(as $DONO "select amount from commissions where ticket_id='$TID';")
check "comissão = 50% de 37,00" "18.50" "$r"
r=$(as $DONO "select public.generate_commissions('$TID');")
contains "generate_commissions NÃO é chamável por RPC" "permission denied" "$r"
r=$(as $DONO "select count(*) from commissions where ticket_id='$TID';")
check "comissão segue única" "1" "$r"
r=$(as $B1 "select count(*) from commissions;")
check "barbeiro 1 vê a própria comissão" "1" "$r"
r=$(as $B2 "select count(*) from commissions;")
check "BARBEIRO 2 NÃO VÊ a comissão do colega" "0" "$r"
r=$(as $ADMIN "select count(*) from commissions;")
check "admin sem permissão de comissões não vê nada" "0" "$r"

echo ""
echo "═══ REPASSE DE COMISSÃO ═══"
CID=$($PSQL -c "set role postgres; select id from commissions limit 1;")
r=$(as $B1 "select public.pay_commissions('$BARB1', array['$CID']::uuid[]);")
contains "barbeiro NÃO registra o próprio repasse" "Apenas o proprietário" "$r"
r=$(as $DONO "select public.pay_commissions('$BARB1', array['$CID']::uuid[], 'pix') is not null;")
check "proprietário registra o repasse" "t" "$r"
r=$(as $DONO "select status from commissions where id='$CID';")
check "comissão marcada como paga" "paga" "$r"
r=$(as $DONO "select public.pay_commissions('$BARB1', array['$CID']::uuid[]);")
contains "repasse não paga a mesma comissão duas vezes" "Nenhuma comissão pendente" "$r"
r=$(as $DONO "delete from payments where ticket_id='$TID' returning 'ok';")
contains "estorno é barrado com comissão já paga" "comissões já pagas" "$r"

echo ""
echo "═══ FIADOS ═══"
r=$(as $DONO "insert into debts (id, client_id, original_amount) values ('dddddddd-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001',100) returning status;")
check "fiado nasce pendente" "pendente" "$r"
r=$(as $DONO "insert into debt_payments (debt_id, amount) values ('dddddddd-0000-0000-0000-000000000001',40) returning 'ok';")
check "pagamento parcial aceito" "ok" "$r"
r=$(as $DONO "select status||' / saldo '||(original_amount-paid_amount) from debts where id='dddddddd-0000-0000-0000-000000000001';")
check "situação vira parcial com saldo correto" "parcial / saldo 60.00" "$r"
r=$(as $DONO "insert into debt_payments (debt_id, amount) values ('dddddddd-0000-0000-0000-000000000001',999) returning 'ok';")
contains "pagamento acima da dívida é recusado" "excede o saldo do fiado" "$r"
r=$(as $DONO "insert into debt_payments (debt_id, amount) values ('dddddddd-0000-0000-0000-000000000001',60) returning 'ok';")
check "quitação aceita" "ok" "$r"
r=$(as $DONO "select status from debts where id='dddddddd-0000-0000-0000-000000000001';")
check "fiado quitado" "quitado" "$r"
r=$(as $B1 "select count(*) from debts;")
check "BARBEIRO não acessa fiados" "0" "$r"

echo ""
echo "═══ PACOTES ═══"
PKG=$($PSQL -c "set role postgres; select id from packages where name='Pacote 4 Cortes';")
r=$(as $DONO "insert into client_packages (id, client_id, package_id, uses_total, uses_left)
  values ('bbbbbbbb-0000-0000-0000-000000000001','cccccccc-0000-0000-0000-000000000001','$PKG',4,4) returning 'ok';")
check "pacote vendido ao cliente" "ok" "$r"
IT=$($PSQL -c "set role postgres; insert into ticket_items (ticket_id, service_id, barber_id, description, unit_price, total) select '$TID', id, '$BARB1', 'Corte (pacote)', 37, 37 from services where name='Corte' returning id;")
as $DONO "select public.consume_package('bbbbbbbb-0000-0000-0000-000000000001','$IT','$BARB1','$SID');" >/dev/null
r=$(as $DONO "select count(*) from package_uses where ticket_item_id='$IT';")
check "uso do pacote registrado" "1" "$r"
r=$(as $DONO "select uses_left from client_packages where id='bbbbbbbb-0000-0000-0000-000000000001';")
check "restam 3 utilizações" "3" "$r"
r=$(as $DONO "select total||'/'||covered_by_package from ticket_items where id='$IT';")
check "item do pacote não cobra de novo" "0.00/true" "$r"
r=$(as $DONO "select public.consume_package('bbbbbbbb-0000-0000-0000-000000000001','$IT','$BARB1','$SID');")
contains "mesmo item não debita o pacote duas vezes" "duplicate key" "$r"

echo ""
echo "═══ ESTOQUE ═══"
r=$(as $DONO "insert into suppliers (id, name) values ('ffffffff-0000-0000-0000-000000000001','Fornecedor Teste') returning 'ok';")
check "fornecedor cadastrado" "ok" "$r"
r=$(as $DONO "insert into products (id, name, min_qty, sale_price) values ('ffffffff-0000-0000-0000-000000000002','Pomada',5,35) returning stock_qty;")
check "produto começa zerado" "0.00" "$r"
r=$(as $DONO "insert into stock_moves (product_id, type, qty, unit_cost) values ('ffffffff-0000-0000-0000-000000000002','entrada',10,18) returning 'ok';")
check "entrada registrada" "ok" "$r"
r=$(as $DONO "select stock_qty from products where id='ffffffff-0000-0000-0000-000000000002';")
check "saldo subiu para 10" "10.00" "$r"
r=$(as $DONO "insert into stock_moves (product_id, type, qty) values ('ffffffff-0000-0000-0000-000000000002','saida',3) returning 'ok';")
check "saída registrada" "ok" "$r"
r=$(as $DONO "select stock_qty from products where id='ffffffff-0000-0000-0000-000000000002';")
check "saldo caiu para 7" "7.00" "$r"
r=$(as $DONO "insert into stock_moves (product_id, type, qty) values ('ffffffff-0000-0000-0000-000000000002','saida',999) returning 'ok';")
contains "saída maior que o estoque é recusada" "Estoque insuficiente" "$r"
r=$(as $ADMIN "select count(*) from products;")
check "admin COM permissão de estoque enxerga" "1" "$r"
r=$(as $B1 "select count(*) from products;")
check "BARBEIRO não acessa estoque" "0" "$r"
r=$(as $ADMIN "select count(*) from expenses;")
check "admin SEM permissão financeira não vê despesas" "0" "$r"

echo ""
echo "═══ SUPERFÍCIE RPC FECHADA ═══"
for fn in "bill_appointment('eeeeeeee-0000-0000-0000-000000000001')" \
          "generate_commissions('$TID')" \
          "recalc_ticket('$TID')" \
          "recalc_debt('dddddddd-0000-0000-0000-000000000001')"; do
  r=$($PSQL -c "set role anon; select public.$fn;" 2>&1)
  contains "visitante NÃO executa ${fn%%(*}" "permission denied" "$r"
done
r=$($PSQL -c "set role anon; select public.consume_package('bbbbbbbb-0000-0000-0000-000000000001','$IT','$BARB1','$SID');" 2>&1)
contains "visitante NÃO consome pacote" "permission denied" "$r"
r=$($PSQL -c "set role anon; select public.pay_commissions('$BARB1', array[]::uuid[]);" 2>&1)
contains "visitante NÃO repassa comissão" "permission denied" "$r"
r=$(as $B1 "select public.consume_package('bbbbbbbb-0000-0000-0000-000000000001','$IT','$BARB1','$SID');")
contains "barbeiro NÃO consome pacote de cliente" "Sem permissão" "$r"

echo ""
echo "═══ API PÚBLICA DO SITE ═══"
r=$($PSQL -c "set role anon; select count(*) from services;")
check "visitante lê os serviços" "15" "$r"
r=$($PSQL -c "set role anon; select count(*) from appointments;" 2>&1)
contains "visitante NÃO lê agendamentos" "permission denied" "$r"
r=$($PSQL -c "set role anon; select count(*) from clients;" 2>&1)
contains "visitante NÃO lê clientes" "permission denied" "$r"
r=$($PSQL -c "set role anon; select count(*) > 0 from public.public_available_slots('$BARB2', (now()+interval '2 day')::date, '$SID');")
check "visitante consulta horários livres" "t" "$r"
SLOT=$($PSQL -c "set role anon; select slot from public.public_available_slots('$BARB2', (now()+interval '2 day')::date, '$SID') limit 1;")
r=$($PSQL -c "set role anon; select public.public_book('$BARB2','$SID','$SLOT','Cliente Site','51988887777') is not null;")
check "visitante agenda pelo site" "t" "$r"
r=$($PSQL -c "set role anon; select public.public_book('$BARB2','$SID','$SLOT','Outro Cliente','51988886666');" 2>&1)
contains "mesmo horário não é vendido duas vezes" "Horário indisponível" "$r"
r=$($PSQL -c "set role anon; select public.public_book('$BARB2','$SID','$SLOT','Cliente Teste','123');" 2>&1)
contains "telefone inválido é recusado" "telefone válido" "$r"

echo ""
printf '═══ RESULTADO: \033[32m%d passaram\033[0m, \033[31m%d falharam\033[0m ═══\n' "$PASS" "$FAIL"
[[ $FAIL -eq 0 ]]
