# Diamond Barbearia — Painel de gestão

App React + TypeScript (Vite) do sistema administrativo. O site público continua
em `../diamond` e não depende deste app.

## Configurar

```bash
cd app
cp .env.example .env     # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5174
```

Sem o `.env` preenchido a tela de login avisa e bloqueia o acesso — nenhum dado
falso é exibido.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção em `dist/` |
| `npm run typecheck` | checagem de tipos sem emitir |
| `node e2e/render.mjs [pasta]` | abre todas as telas dos três perfis com a rede interceptada e falha se alguma quebrar |

O teste de renderização usa fixtures em `e2e/fixtures.mjs`, que existem **apenas
no teste** — nada fictício entra no código do aplicativo.

## Perfis

| Perfil | Vê |
|---|---|
| **Proprietário** | tudo: dashboard, financeiro, comissões de todos, cadastros, estoque, configurações |
| **Administrador** | operação (agenda, caixa, comandas, clientes, serviços, pacotes, fiados) + o que as permissões liberarem |
| **Barbeiro** | só o que é dele: agenda, clientes atendidos, comissões, disponibilidade |

O isolamento é garantido por RLS no banco (`supabase/migrations/0008_rls.sql`),
não pela interface: mesmo chamando a API direto, o barbeiro não alcança o caixa,
os fiados, o estoque nem os dados dos colegas.

## Estrutura

```
src/
├── auth/          AuthProvider (sessão, papel, permissões) e tela de login
├── layout/        Shell com menu lateral por perfil
├── lib/           cliente Supabase, tipos do banco, formatação, agregações
├── ui/            kit de componentes (modal, campos, badges, KPIs) e ícones
└── pages/         uma tela por módulo; pages/barber/ é o painel do profissional
```
