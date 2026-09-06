# Project Memory Changelog

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
