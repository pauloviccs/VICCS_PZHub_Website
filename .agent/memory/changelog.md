# Project Memory Changelog

## [2026-09-06] - Gestão de Download de Software na Moderação & Fim da Amnésia Front-end

### Problema Resolvido
- O link do executável `.exe` do botão principal da Hero (`#hero-btn-download-app`) estava chumbado no código e não permitia alteração direta pela Staff através da aba de moderação.
- Amnésia de interações sociais no front-end: curtidas em posts e modpacks, comentários e reposts eram perdidos ao atualizar a página (F5), pois dependiam apenas de estado em RAM ou de triggers de banco que podiam não estar sincronizados.
- Condição de corrida no carregamento inicial da autenticação que limpava os dados de likes antes da confirmação da sessão no Supabase.

### Mudanças Implementadas
1. **Painel de Moderação (`src/js/admin.js`):**
   - Criação da 3ª aba operacional: `⚙️ CONFIGURAÇÕES DE SOFTWARE & DOWNLOADS`.
   - Implementação de painel tático com input da URL do executável `.exe`, botão de cópia rápida, botão de teste direto do link e botão com feedback de gravação.
   - Sincronização remota via Supabase (`modpack_changelogs` com `system_config` / `desktop_download_url`), cache local (`PZHUB_DESKTOP_DOWNLOAD_URL`) e atualização imediata do DOM no botão Hero `#hero-btn-download-app`.
2. **Boot da Aplicação (`src/js/app.js`):**
   - Chamada `await fetchActiveDownloadUrl()` no início do `init()`, garantindo que o link correto seja injetado antes de renderizar as telas.
3. **Radar Social (`src/js/timeline.js`):**
   - Cache e restauração imediata de `userLikedPostIds` e `userRepostedPostIds` via `localStorage` indexado por usuário.
   - Contagem agregada em tempo real de `post_likes` e `post_comments` no `loadTimelinePosts()`.
   - Atualização explícita de `likes_count`, `reposts_count` e `comments_count` na tabela `posts` ao interagir.
4. **Catálogo da Comunidade (`src/js/workshop.js`):**
   - Cache e restauração imediata de `userLikedModpackIds` via `localStorage`.
   - Agregação em tempo real de `modpack_likes` e `comments` para alimentar com precisão os cards no F5.
   - Re-renderização instantânea de comentários no modal de detalhes ao postar.
5. **Autenticação (`src/js/auth.js`):**
   - Emissão do evento `pzhub:auth-changed` no `onAuthStateChange`, escutado por `timeline.js` e `workshop.js` para re-sincronizar dados sociais assim que o JWT for verificado.

---

## [2026-09-03] - Sincronização Atômica de Elementos Sociais (Likes, Comentários, Reports)

### Problema Resolvido
- Dados gravados em tabelas de relacionamentos (`post_likes`, `post_comments`, `modpack_likes`, `reports`) não tinham seus totais refletidos nas tabelas agregadas principais nem na interface visual do front-end.
- O front-end tentava executar mutações `UPDATE` diretas em `public.posts` e `public.modpacks`, que eram silenciosamente barradas pelas políticas de Row Level Security (RLS).
- A interface de moderação (`admin.js`) não persistia o status de denúncias descartadas ou resolvidas no Supabase.

### Mudanças Implementadas
1. **Banco de Dados & RLS (`supabase_schema.sql`):**
   - Criação da função e trigger `sync_post_likes_count` com `SECURITY DEFINER` na tabela `post_likes`.
   - Criação da função e trigger `sync_post_comments_count` com `SECURITY DEFINER` na tabela `post_comments`.
   - Criação da função e trigger `sync_modpack_likes_count` com `SECURITY DEFINER` na tabela `modpack_likes`.
   - Inclusão de política de `UPDATE` em `public.posts` para autores e equipe de moderação.
   - Inclusão de política de `UPDATE` em `public.reports` para administradores e moderadores.
   - Script SQL para recalibração retroativa de todos os registros existentes.

2. **Radar Social (`src/js/timeline.js`):**
   - Removidas chamadas de `UPDATE` na tabela `posts` ao curtir e comentar, delegando a agregação aos triggers de banco.
   - Adicionada rotina de auto-cura no carregamento de comentários (`loadPostComments`), sincronizando o badge numérico no DOM de acordo com o total de registros retornados.
   - Adicionado fallback `onerror` nos avatares para mitigar erros de requisição inválida.

3. **Catálogo Workshop (`src/js/workshop.js`):**
   - Removidos comandos manuais de `UPDATE` em `modpacks.likes_count`. A mutação agora opera exclusivamente sobre a tabela `modpack_likes`.

4. **Moderação da Staff (`src/js/admin.js`):**
   - Integração assíncrona nos botões de descartar (`dismissed`) e resolver (`resolved`) denúncias com persistência direta no Supabase.

5. **Documentação & Memória:**
   - Atualizado `PROJECT_STATUS.md` com status real do ecossistema.
   - Atualizados arquivos de memória em `.agent/memory/`.
