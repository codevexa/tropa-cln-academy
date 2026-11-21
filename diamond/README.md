# Diamond Barbearia — Website (esboço visual navegável)

Protótipo de alta fidelidade, 100% navegável, construído para apresentação ao estabelecimento.
Stack intencionalmente simples e sem build: **HTML + CSS + JavaScript puro + GSAP/ScrollTrigger** (vendorizado localmente, sem dependência de CDN).

## Como abrir

```bash
cd diamond
python3 -m http.server 8080    # ou qualquer servidor estático
# abrir http://localhost:8080
```

> O `index.html` precisa ser servido por HTTP (não abrir via `file://`) para que o mapa e os módulos carreguem corretamente.

## Estrutura

```
diamond/
├── index.html                 # marcação + SEO + dados estruturados (schema.org/HairSalon)
├── site.webmanifest
└── assets/
    ├── css/style.css          # design system completo (tokens, componentes, responsivo)
    ├── js/main.js             # animação do diamante, scroll, agendamento, galeria
    ├── vendor/                # gsap.min.js + ScrollTrigger.min.js (3.12.5)
    └── img/                   # logo reconstruída, fotos otimizadas em WebP, favicons
```

## A animação do diamante

O diamante **não é GIF nem vídeo**. É um SVG com **12 facetas independentes** (`FACETS` em `assets/js/main.js`),
traçadas a partir da geometria da logo original — 7 facetas de coroa + 5 de pavilhão.

Narrativa ligada ao scroll (GSAP ScrollTrigger, `scrub`):

| Fase | Trecho da página | Comportamento |
|---|---|---|
| Abertura | pré-carregamento | as partes se montam e formam o diamante inteiro |
| 1 | Sobre → Manifesto | as partes se separam progressivamente |
| 2 | Manifesto → Time/Galeria | fragmentos flutuam com profundidade e rotação |
| 3 | Galeria → Agendamento | reconstrução progressiva |
| Final | Contato / Rodapé | diamante inteiro novamente |

Ajustes de performance já aplicados: amplitude reduzida no mobile (`K = 0.52`), brilho (`filter`) apenas acima de 1024px,
animação somente via `transform`/`opacity`, e respeito total a `prefers-reduced-motion`.

## Campos editáveis (nada foi inventado)

Tudo que não foi informado está marcado como **“a definir”** e concentrado em pontos únicos do código:

| Informação | Onde alterar |
|---|---|
| Nome, especialidade e apresentação dos profissionais | `assets/js/main.js` → `TEAM` (`name`, `role`, `bio`) |
| Horário de funcionamento | `index.html` → seção `#contato` (“Horário de funcionamento”) e rodapé |
| Instagram | `index.html` → seção `#contato` e rodapé |
| Fotos adicionais do salão | `assets/img/` + array `GAL` em `main.js` (trocar `{slot:true}` por `{img:'...', cap:'...'}`) |

Os **15 serviços** (`SERVICES` em `main.js`) estão com nomes, durações e preços exatamente como fornecidos.

## Agendamento — status

O fluxo de 5 passos (serviço → profissional → data → horário → revisão) está **implementado apenas como interface**:

- o calendário gera datas reais, mas **não há disponibilidade declarada**;
- o passo “Horário” mostra estado bloqueado, aguardando integração — **nenhum horário fictício é exibido**;
- a revisão **não confirma nem registra** reserva alguma.

Ponto de integração: o objeto `state` (`{ service, pro, date, step }`) em `main.js` já concentra a seleção do usuário,
pronto para receber a chamada da API do sistema de agendamento (ex.: SalonSoft) nos passos 4 e 5.

Enquanto isso, o contato direto por WhatsApp — **(51) 98454-6144** — está ativo em toda a página.

## Identidade

- Logo original preservada: o selo circular foi **reconstruído a partir da foto enviada** (anéis externos completados, binarizado e recortado com transparência). Proporções e desenho não foram alterados.
- Cores: `#050505` (preto profundo), `#FFFFFF`, cinza metálico e gradiente prata cromado.
- Tipografia: **Oswald** (condensada, caixa alta, espaçamento ampliado) para títulos; **Inter** para texto corrido.

## Acessibilidade e performance

- Imagens em WebP com `loading="lazy"` e dimensões declaradas (sem layout shift).
- Navegação por teclado na galeria, no lightbox e no menu; `Esc` fecha overlays.
- `prefers-reduced-motion` desativa todas as animações.
- Peso total do site: **menos de 1 MB**, sem requisições a CDNs de terceiros (exceto Google Fonts).
