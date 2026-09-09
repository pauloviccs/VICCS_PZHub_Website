# Project TODOs

## Em Aberto / Próximos Passos
- [ ] **Sincronização em Tempo Real (Supabase Realtime):** Implementar subscrições via `supabase.channel` para posts, curtidas e comentários atualizarem instantaneamente entre múltiplos clientes sem necessidade de refresh.
- [ ] **Paginação com Infinite Scroll:** Adicionar paginação sob demanda na Timeline e no Catálogo Workshop para otimizar transferência de dados com feeds longos.
- [ ] **Integração com Protocolo Desktop (`pzhub://`):** Botão de 1-clique para despachar o manifesto do pacote selecionado diretamente ao aplicativo desktop.
- [ ] **Recuperação de Senha & Validação de E-mail:** Inclusão de fluxo de esqueci minha senha e confirmação de e-mail no modal de autenticação.

## Concluídos Recentemente
- [x] **Gestão de Download na Moderação:** Criação da aba de Configurações de Software no painel admin com controle do link `.exe` da Hero, persistência remota e cache local.
- [x] **Persistência Social Resiliente (Anti-Amnésia):** Eliminação da perda de likes, reposts e comentários no refresh (F5) via sistema híbrido de cache local e agregação em tempo real.
- [x] **Re-renderização Instantânea de Comentários em Modpacks:** Comentários enviados no modal aparecem imediatamente sem recarregar tela.
- [x] **Sincronização de Estado de Autenticação (`pzhub:auth-changed`):** Eliminação de condições de corrida de sessão no carregamento inicial da página.
- [x] Sincronização atômica de contadores sociais (Likes em posts e modpacks, Comentários na timeline) via triggers PostgreSQL.
- [x] Políticas de RLS para permissão de `UPDATE` em posts da timeline e denúncias de moderação.
- [x] Auto-cura do contador de comentários na interface do post ao expandir a gaveta.
- [x] Conexão em tempo real das ações de moderação (Ignorar / Resolver denúncias) com a tabela `reports` do Supabase.
