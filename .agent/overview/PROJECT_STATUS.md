# Project Overview

## Project Name
PZHub Community Workshop & Creator Platform (`pzhub-website`)

## Description
Plataforma Web Oficial (SPA) de compartilhamento, criação, publicação e exploração de modpacks para Project Zomboid (Build 42 e Build 41). Possui interface e design system inspirados no jogo Escape from Tarkov, autenticação integrada com Supabase, rede social tática (Radar Social/Timeline), sistema de perfis de operadores estilo vitrine Steam, estúdio de criação de pacotes com suporte a IDs da Oficina Steam e links de download direto, e painel de moderação para administradores.

## Tech Stack
- Languages: JavaScript (ES6+ Vanilla Modules), HTML5, CSS3, SQL (PostgreSQL / Supabase DDL)
- Frameworks: Vite 6.2.0 (Build Tool & Dev Server), @supabase/supabase-js 2.49.1
- Tools: npm, Vercel CLI / Config
- Services: Supabase (PostgreSQL, Auth, Row Level Security, REST API), Vercel (Hospedagem SPA & Edge CDN)

## Folder Structure
```text
VICCS_PZHub_Website/
├── .agent/
│   └── overview/
│       └── PROJECT_STATUS.md
├── .env
├── .env.example
├── .gitignore
├── dist/
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
│   │       ├── PZHUB_Logo_svg_Red_White.svg
│   │       ├── PZHub_LogoIcon.png
│   │       ├── PZHub_LogoIcon.svg
│   │       ├── android-chrome-192x192.png
│   │       ├── android-chrome-512x512.png
│   │       ├── apple-touch-icon.png
│   │       ├── favicon-16x16.png
│   │       ├── favicon-32x32.png
│   │       ├── favicon.ico
│   │       └── site.webmanifest
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
- `index.html`: Ponto de entrada SPA contendo as views principais (`#view-workshop`, `#view-dashboard`, `#view-studio`, `#view-timeline`, `#view-profile`, `#view-admin`), modais globais e sistema de layout.
- `src/js/app.js`: Controlador central do SPA, roteamento via hash de URL, alternador de temas (claro/escuro) e inicialização dos subsistemas.
- `src/js/supabaseClient.js`: Conexão com a instância do Supabase com fallback de credenciais para ambiente de desenvolvimento.
- `src/js/auth.js`: Camada de autenticação (login, registro, logout) e sincronização automática de estado com `profiles`.
- `src/js/workshop.js`: Feed do catálogo, filtros por categorias militares/táticas, barra de pesquisa, ordenação e modal detalhado de modpack.
- `src/js/modpackBuilder.js`: Estúdio de criação e edição de modpacks com suporte a múltiplos tipos de mods (Oficina Steam ou Download Direto).
- `src/js/timeline.js`: Radar Social com feed de posts curtos, anexo de imagens (cortador/compressor WebP) e pré-visualização de vídeos do YouTube.
- `src/js/profile.js`: Painel de perfil de operador com badges militares, mural de recados (scraps) interativo e gerenciamento de seguidores.
- `src/js/admin.js`: Área restrita para Staff e Moderadores com visualização de denúncias e gerenciamento de permissões.
- `src/js/imageCropper.js`: Modal utilitário para recorte com proporção fixa e compressão WebP em tempo de execução no cliente.
- `src/js/i18n.js`: Suporte multilíngue para Português, Inglês e Espanhol.
- `src/js/tacticalModal.js`: Sistema de caixas de diálogo e notificações toast customizadas no estilo Tarkov.
- `src/css/style.css`: Folha de estilos unificada contendo variáveis de cores táteis, tema claro/escuro, componentes e animações.
- `supabase_schema.sql`: Script SQL idempotente com criação de enums, 11 tabelas com integridade referencial, trigger de criação de perfil e políticas RLS de segurança.

## Current Features Implemented
- [x] **Catálogo da Comunidade (Workshop):** listagem de pacotes, filtros por tags e categorias dinâmicas, busca textual e ordenações por relevância, likes e downloads.
- [x] **Modal de Detalhes de Modpack:** visualização completa do pacote com abas para Visão Geral, Lista de Mods, Histórico de Atualizações (Changelogs) e Comentários.
- [x] **Estúdio do Criador:** criação e edição de modpacks próprios com formulário dinâmico (Steam Workshop vs Direct Download) e recorte tático de capa.
- [x] **Radar Social (Timeline):** feed comunitário com limites de caracteres, suporte a até 4 imagens com compressão em WebP, incorporação de vídeos do YouTube e comentários.
- [x] **Perfil de Sobrevivente / Operador:** estatísticas, insígnias selecionáveis, edição de avatar/banner com crop tático e mural de recados (scraps) com reações rápidas.
- [x] **Autenticação Segura:** fluxo de cadastro, login e logout com persistência de sessão e criação automática de perfil no banco.
- [x] **Painel de Moderação (Admin):** controle de denúncias de modpacks/comentários e gerenciamento de cargos (user, creator, moderator, admin).
- [x] **Estação de Redação Tática em Markdown:** editor de manifesto e changelogs com suporte a upload de arquivos `.md`/`.txt`, Drag & Drop nativo, barra de ferramentas rápida (Bold, Italic, Header, Lists, Links, Quotes, Code), atalhos de teclado (Ctrl+B, Ctrl+I, Ctrl+K) e abas de alternância [Escrever / Pré-visualizar].
- [x] **Modal Tático de Despacho de Changelogs:** modal dedicado para publicação de novas versões de modpacks com incremento semântico automático, campos de título/notas em Markdown e sincronização com Supabase e catálogo.
- [x] **Renderizador de Markdown Seguro:** parser nativo Vanilla JS com sanitização de tags para exibir formatações ricas na vitrine de detalhes e na timeline de versões.
- [x] **Internacionalização (i18n):** alternador entre Português, Inglês e Espanhol.
- [x] **Design Responsivo & Temas:** layout adaptável para mobile (drawer de navegação) e alternador entre modo escuro tático e modo claro.

## Work-in-Progress & Known Next Steps
- [ ] **Sincronização em Tempo Real:** implementação de subscrições via `supabase.channel` para que posts da timeline e comentários atualizem instantaneamente sem refresh.
- [ ] **Paginação com Infinite Scroll:** adicionar carregamento paginado no catálogo e na timeline para otimizar transferência de dados conforme o volume de conteúdo cresce.
- [ ] **Integração com Protocolo Desktop (`pzhub://`):** botão de 1-clique para abrir e sincronizar diretamente com o aplicativo nativo do PZHub.
- [ ] **Recuperação de Senha & Validação de E-mail:** inclusão dos fluxos de redefinição de credenciais diretamente nos modais de autenticação.
