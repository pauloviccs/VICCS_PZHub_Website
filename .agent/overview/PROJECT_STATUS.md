# Project Overview

## Project Name
PZHub Community Workshop & Creator Platform (`pzhub-website`)

## Description
Plataforma Web Oficial (SPA) de compartilhamento, criação, publicação e exploração de modpacks para Project Zomboid (Build 42 e Build 41). Possui interface e design system inspirados no jogo *Escape from Tarkov*, autenticação integrada com Supabase, rede social tática (Radar Social/Timeline), sistema de perfis de operadores estilo vitrine Steam, estúdio de criação de pacotes com suporte a IDs da Oficina Steam e links de download direto, **edição in-place de mods componentes com persistência atômica no Supabase**, **telemetria de downloads do software desktop com badges visuais e sincronização em tempo real via Supabase Realtime WebSocket**, painel de moderação para administradores com triagem em tempo real e controle dinâmico da URL do executável desktop (.exe), além de motor de persistência social híbrido (Supabase + `localStorage`) anti-amnésia para likes, reposts e comentários.

## Tech Stack
- Languages: JavaScript (ES6+ Vanilla Modules), HTML5, CSS3, SQL (PostgreSQL / Supabase DDL / Stored Procedures)
- Frameworks: Vite 6.4.3 (Build Tool & Dev Server), @supabase/supabase-js 2.49.1
- Tools: npm, Vercel CLI / Config
- Services: Supabase (PostgreSQL, Auth, Row Level Security, REST API, RPC, Database Triggers, Realtime Postgres Changes), Vercel (Hospedagem SPA & Edge CDN)

## Folder Structure
```text
VICCS_PZHub_Website/
├── .agent/
│   ├── changelogs/
│   ├── memory/
│   │   ├── active_task.md
│   │   ├── changelog.md
│   │   └── todos.md
│   └── overview/
│       └── PROJECT_STATUS.md
├── .env
├── .env.example
├── .gitignore
├── dist/
│   ├── assets/
│   └── index.html
├── index.html
├── package.json
├── package-lock.json
├── public/
│   ├── PZHub_LogoIcon.png
│   ├── PZHub_LogoIcon.svg
│   ├── android-chrome-192x192.png
│   ├── android-chrome-512x512.png
│   ├── apple-touch-icon.png
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── favicon.ico
│   └── site.webmanifest
├── README.md
├── src/
│   ├── assets/
│   │   └── logo/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── admin.js
│       ├── app.js
│       ├── auth.js
│       ├── changelogs.js
│       ├── i18n.js
│       ├── imageCropper.js
│       ├── modpackBuilder.js
│       ├── profile.js
│       ├── supabaseClient.js
│       ├── tacticalModal.js
│       ├── timeline.js
│       └── workshop.js
├── supabase_schema.sql
├── vercel.json
└── vite.config.js
```

## Key Files & Architecture
- `index.html`: Ponto de entrada SPA contendo as views principais (`#view-workshop`, `#view-dashboard`, `#view-studio`, `#view-timeline`, `#view-profile`, `#view-admin`), botão principal de download do instalador na Hero (`#hero-btn-download-app`) com badge de contagem de downloads (`#hero-app-downloads-badge`), modais globais e sistema de layout.
- `src/js/app.js`: Controlador central do SPA, roteamento via hash de URL, reidratação inicial do link do executável desktop no boot (`fetchActiveDownloadUrl`), inicialização de contadores de downloads (`fetchAppDownloadsCount`), subscrição Realtime WebSocket (`setupRealtimeDownloads`) via canal `pzhub-global-downloads`, alternador de temas (claro/escuro) e inicialização dos subsistemas.
- `src/js/admin.js`: Área restrita para Staff e Moderadores com 3 abas operacionais: Triagem de Denúncias, Gerenciamento de Cargos e Gestão de Software & Downloads. Funções de telemetria exportadas: `trackAppDownload()` (RPC atômica não-bloqueante), `fetchAppDownloadsCount()` e `updateAppDownloadCountersInDom()`.
- `src/js/timeline.js`: Radar Social com feed de posts curtos, anexo de imagens (cortador/compressor WebP), player YouTube tático com hover autoplay, gaveta expansível de respostas inline, persistência resiliente de likes e reposts no cache local do usuário e contagem real agregada de curtidas e comentários direto das tabelas relacionais.
- `src/js/workshop.js`: Feed do catálogo, filtros por categorias militares/táticas, barra de pesquisa, ordenação, modal detalhado com histórico de versões (Changelogs), comentários dinâmicos com re-renderização imediata, sincronização atômica de likes, **purificação visual com remoção dos contadores de downloads nos cards e no modal de detalhes**, dashboard com métricas separadas Software vs Modpacks e exposição de `updateModpackInList` e `renderWorkshop` para atualização em tempo real.
- `src/js/auth.js`: Camada de autenticação (login, registro, logout) integrada ao Supabase Auth, emissão do evento global `pzhub:auth-changed` para re-sincronizar dados sociais nos módulos clientes eliminando condições de corrida no F5.
- `src/js/profile.js`: Painel de perfil de operador com badges militares, mural de recados (scraps) interativo, agregações dinâmicas de métricas e gerenciamento de seguidores.
- `src/js/modpackBuilder.js`: Estúdio de criação e edição de modpacks com suporte a múltiplos tipos de mods (Oficina Steam ou Download Direto), **edição in-place de mods componentes via modal tático (`#mod-component-edit-modal`) com sincronização atômica direta no Supabase (`modpacks.mods`)**, editor de descrição com formatação e Drag & Drop de arquivos Markdown.
- `src/js/changelogs.js`: Gerenciamento e consulta assíncrona de notas de versão dos modpacks e configurações globais na nuvem.
- `src/js/supabaseClient.js`: Inicializador do cliente `@supabase/supabase-js` em produção.
- `src/js/imageCropper.js`: Modal utilitário para recorte com proporção fixa e compressão WebP em tempo de execução no cliente.
- `src/js/i18n.js`: Suporte multilíngue para Português, Inglês e Espanhol.
- `src/js/tacticalModal.js`: Sistema de caixas de diálogo e notificações toast customizadas no estilo tático Tarkov.
- `src/css/style.css`: Folha de estilos unificada contendo variáveis de cores táteis, tema claro/escuro, componentes e animações.
- `supabase_schema.sql`: Script SQL idempotente com criação de enums, tabelas com integridade referencial, triggers automáticos para contadores sociais e políticas RLS completas.

## Current Features Implemented
- [x] **Edição Tática In-Place de Mods Componentes:** modal dedicado (`#mod-component-edit-modal`) permitindo que autores e administradores editem o nome, tipo (Steam Workshop vs Download Direto), Workshop ID/URL e status obrigatório de qualquer mod de uma coleção existente, com persistência direta e atômica na tabela `modpacks` do Supabase e sincronização instantânea com o PZHub Desktop.
- [x] **Purificação Visual do Catálogo de Modpacks:** remoção do contador de downloads nos cards do catálogo e no modal de detalhes, mantendo o foco nas métricas de curtidas comunitárias e reservando a telemetria de downloads para o executável do ecossistema desktop.
- [x] **Telemetria de Downloads do Software Desktop (v2.2.6 sync):** badges visuais de contagem real de downloads no botão Hero (`#hero-app-downloads-badge`), drawer mobile (`#mobile-app-downloads-count`) e dashboard. Rastreamento não-bloqueante via RPC `increment_app_download` com `SECURITY DEFINER`. Divisão de métricas *DOWNLOADS DO SOFTWARE (.EXE)* e *DOWNLOADS DE MODPACKS* no Dashboard.
- [x] **Sincronização em Tempo Real (Supabase Realtime WebSocket):** canal `pzhub-global-downloads` assinando tabelas `app_analytics` e `modpacks` via `postgres_changes` para zero-refresh updates de contadores entre múltiplos clientes.
- [x] **Gestão de Distribuição do Executável (.exe):** aba dedicada no painel de moderação (`admin.js`) para alteração dinâmica do link de download do aplicativo PZHub Desktop vinculado ao botão Hero, com persistência remota no Supabase (`system_config`), cache local imediato e reidratação automática no boot.
- [x] **Persistência Social Anti-Amnésia:** sistema de dupla camada (`localStorage` indexado por usuário + Supabase) para curtidas de posts e modpacks, e persistência completa de reposts na timeline. Agregação em tempo real a partir de `post_likes`, `modpack_likes`, `post_comments` e `comments`, impedindo reset de contadores para zero no refresh (F5).
- [x] **Re-renderização Instantânea de Comentários:** comentários adicionados aos modpacks no modal de detalhes aparecem imediatamente sem necessidade de refresh ou fechamento do modal.
- [x] **Sincronização de Estado de Autenticação (`pzhub:auth-changed`):** eliminação de condições de corrida de sessão no carregamento inicial da página.
- [x] **Catálogo da Comunidade (Workshop):** listagem de pacotes, filtros por tags e categorias dinâmicas, busca textual, ordenação e contagem atômica de likes sem concorrência.
- [x] **Modal de Detalhes de Modpack:** visualização completa do pacote com abas para Visão Geral, Lista de Mods, Histórico de Atualizações (Changelogs), Comentários e Denúncia rápida para Staff.
- [x] **Estúdio do Criador:** criação e edição de modpacks próprios com formulário dinâmico (Steam Workshop vs Direct Download) e recorte tático de capa.
- [x] **Radar Social (Timeline):** feed comunitário com limites de caracteres, suporte a até 4 imagens com compressão em WebP, incorporação de vídeos do YouTube, gaveta expansível de comentários e contadores sincronizados.
- [x] **Perfil de Sobrevivente / Operador:** estatísticas, insígnias selecionáveis, edição de avatar/banner com crop tático e mural de recados (scraps) com reações rápidas.
- [x] **Autenticação Segura:** fluxo de cadastro, login e logout com persistência de sessão e criação automática de perfil no banco.
- [x] **Painel de Moderação (Admin):** controle de denúncias de modpacks/conteúdo com persistência direta no Supabase, gerenciamento de cargos (user, creator, moderator, admin) e painel de configuração de software.
- [x] **Estação de Redação Tática em Markdown:** editor de manifesto e changelogs com suporte a upload de arquivos `.md`/`.txt`, Drag & Drop nativo, barra de ferramentas rápida (Bold, Italic, Header, Lists, Links, Quotes, Code) e atalhos de teclado.
- [x] **Modal Tático de Despacho de Changelogs:** modal dedicado para publicação de novas versões com incremento semântico automático e sincronização na nuvem.
- [x] **Renderizador de Markdown Seguro:** parser nativo Vanilla JS com sanitização de tags.
- [x] **Internacionalização (i18n):** alternador dinâmico entre Português, Inglês e Espanhol.
- [x] **Design Responsivo & Temas:** layout adaptável para mobile (drawer de navegação) e alternador entre modo escuro tático e modo claro.

## Bugfixes & Estabilidade Recente
- **[v2.2.7 sync] Persistência Atômica de Mods no Supabase:** correção na mutação de mods componentes no Estúdio, garantindo que edições salvas no modal gravem diretamente na coluna `mods` do Supabase via `UPDATE`, eliminando a perda de alterações no F5 ou no PZHub Desktop.
- **[v2.2.6 hotfix] Navegação do SPA Desbloqueada:** `workshop.js` referenciava `renderWorkshopFeed` (função inexistente) em `updateDashboardView()`, causando `ReferenceError` que impedia o `setupRouting()`. Corrigido para `renderWorkshop`.
- **[v2.2.7 build] Bundle de Produção Atualizado:** Compilação limpa do Vite (`npm run build`) gerando os artefatos otimizados em `dist/` sem pendências.

## Work-in-Progress & Known Next Steps
- [ ] **Expansão do Supabase Realtime:** Adicionar subscrições de eventos WebSocket para novos posts e comentários na Timeline sem necessidade de refresh manual.
- [ ] **Paginação com Infinite Scroll:** Adicionar carregamento paginado no catálogo e na timeline para otimizar transferência de dados conforme o volume de conteúdo cresce.
- [ ] **Integração com Protocolo Desktop (`pzhub://`):** Botão de 1-clique para abrir e sincronizar diretamente com o aplicativo nativo do PZHub.
- [ ] **Recuperação de Senha & Validação de E-mail:** Inclusão dos fluxos de redefinição de credenciais diretamente nos modais de autenticação.
