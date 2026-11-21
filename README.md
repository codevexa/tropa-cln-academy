# Diamond Barbearia

Site público de agendamentos + sistema de gestão da barbearia.

> O projeto **TROPA CLN Academy** continua intacto na raiz (`index.html`).
> A Diamond vive em `diamond/`, `app/` e `supabase/`.

```
.
├── index.html          TROPA CLN Academy (projeto anterior, não alterado)
├── diamond/            site público — HTML/CSS/JS, sem build
├── app/                painel de gestão — React + TypeScript (Vite)
└── supabase/           banco: migrations, testes e shim local
```

## Como colocar no ar

### 1. Criar o projeto no Supabase

Um projeto próprio para a barbearia (não reaproveitar outro). Anote a **URL** e a
**chave publishable** em *Project Settings → API*.

### 2. Aplicar as migrations

No SQL Editor do Supabase, rode os arquivos de `supabase/migrations/` **na ordem
numérica**, do `0001` ao `0010`. Ou, com a CLI:

```bash
supabase link --project-ref SEU_REF
supabase db push
```

O `0010_seed.sql` já cadastra os 15 serviços com os preços reais e os 3 pacotes.
O horário de funcionamento entra **fechado** — o proprietário configura no painel.

### 3. Criar o primeiro acesso

Em *Authentication → Users*, crie o e-mail do proprietário. Depois, no SQL Editor:

```sql
insert into profiles (id, role, full_name, email)
select id, 'owner', 'Nome do Proprietário', email from auth.users where email = 'dono@exemplo.com';
```

A partir daí todos os outros acessos saem do painel, em **Profissionais → Acessos**.

### 4. Ligar o site público

```bash
cp diamond/assets/js/config.example.js diamond/assets/js/config.js
# preencher supabaseUrl e supabaseAnonKey
```

Sem isso o site continua funcionando como vitrine: o fluxo de agendamento mostra
o aviso de "aguardando integração" e o WhatsApp segue como canal de contato.

### 5. Ligar o painel

```bash
cd app
cp .env.example .env     # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install && npm run build
```

`app/dist/` é estático e pode ser hospedado em qualquer lugar.

## Testes

| Comando | O que cobre |
|---|---|
| `bash supabase/tests/run.sh` | 63 testes de regra de negócio e RLS contra PostgreSQL |
| `cd app && npm run typecheck` | tipos de todo o painel |
| `cd app && node e2e/render.mjs` | abre as 15 telas do proprietário, as 5 do barbeiro e 6 em 390px |

Os testes de banco precisam de um PostgreSQL local com `supabase/local/00_shim.sql`
aplicado (ele recria o schema `auth` e as roles que o Supabase já tem).

## Perfis e isolamento

| Perfil | Alcança |
|---|---|
| **Proprietário** | tudo |
| **Administrador** | operação + o que as permissões liberarem (`profiles.permissions`) |
| **Barbeiro** | só o que é dele |

O isolamento é de **banco**, não de tela: as policies em `0008_rls.sql` impedem
que um barbeiro leia o caixa, os fiados, o estoque, as comissões dos colegas ou
a própria regra de comissão para alterá-la — mesmo chamando a API diretamente.

## Regras garantidas pelo banco

- um atendimento nunca fatura duas vezes (`ticket_items.appointment_id` único);
- uma comissão nunca duplica (`commissions.ticket_item_id` único);
- dois atendimentos não ocupam o mesmo barbeiro no mesmo horário (`EXCLUDE gist`);
- só existe um caixa aberto por vez;
- pagamento acima do total da comanda ou do saldo do fiado é recusado;
- comissão só nasce com a comanda quitada, e o estorno é barrado se já houve repasse;
- saída de estoque maior que o saldo é recusada.

## Site público

O visitante nunca lê as tabelas de agendamentos ou clientes. Ele conversa com
duas funções `SECURITY DEFINER`: `public_available_slots`, que calcula os
horários livres no servidor (jornada da casa, jornada individual, folgas,
duração do serviço e agenda ocupada), e `public_book`, que valida e grava.
