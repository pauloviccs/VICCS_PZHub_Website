# Active Task

## Status
Ocioso (Idle) // Aguardando novas ordens do operador

## Última Tarefa Concluída
- **Tarefa:** Gestão de Download de Software na Moderação & Resolução da Amnésia Social do Front-end.
- **Resultado:**
  1. Adicionada a aba de Configurações de Software no painel admin para controle em tempo real do link do executável `.exe` do botão Hero, com persistência remota no Supabase (`system_config`), cache local e reidratação automática no boot.
  2. Implementado sistema híbrido anti-amnésia (`localStorage` indexado por usuário + Supabase) para curtidas e reposts, com agregação de contagens reais direto das tabelas secundárias, impedindo que contadores resetem para zero no refresh (F5).
  3. Re-renderização instantânea de comentários no modal de modpack ao postar.
  4. Disparo do evento `pzhub:auth-changed` para eliminar condições de corrida de sessão no carregamento inicial da página.
- **Build Status:** Compilado e verificado via `npm run build` (0 erros, bundle em 2.09s).
