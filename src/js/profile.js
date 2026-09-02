/**
 * PZHub - Social Profile Module (X / Steam Showcase Style)
 * Gerenciamento de perfil, avatar/banner com Enquadramento Tático, Compressor WebP,
 * Painel Completo de Customização Tática (Modal) e Mural de Recados.
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser, getCurrentUserProfile } from './auth.js';
import { openImageCropperModal } from './imageCropper.js';
import { showTacticalAlert, showTacticalConfirm, showTacticalToast } from './tacticalModal.js';

let activeProfileData = null;
let currentTargetUsername = null;
let profileScrapsList = [];
let profileUserModpacksList = [];
let isFollowingOperator = false;
let lastScrapPostTime = 0;
let modalSelectedBadges = [];

const AVAILABLE_BADGES = [
  'SOBREVIVENTE B42',
  'LÍDER DE ESQUADRÃO',
  'MÉDICO DE COMBATE',
  'MECÂNICO TÁTICO',
  'ATIRADOR DE ELITE',
  'CONSTRUTOR DE BASE',
  'COZINHEIRO VETERANO',
  'EXPLORADOR DE LV',
  'VETERANO DO APOCALIPSE'
];

export async function loadUserProfileView(targetUsername) {
  const container = document.getElementById('view-profile');
  if (!container) return;

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();

  // Se o target for vazio ou 'operador' mas temos usuário autenticado com outro username, usa o correto
  let resolvedUsername = targetUsername;
  if ((!resolvedUsername || resolvedUsername === 'operador') && currentUser) {
    resolvedUsername = currentProfile?.username || currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0];
  }

  currentTargetUsername = resolvedUsername || currentProfile?.username || currentUser?.user_metadata?.username;

  if (!currentTargetUsername) {
    // Usuário não autenticado tentando abrir rota genérica de perfil
    container.innerHTML = `
      <div class="tarkov-empty-state" style="padding: 60px 20px; background: var(--bg-surface-card); border: 1px solid var(--panel-border); border-radius: var(--radius-md);">
        <div class="tarkov-empty-title" style="color: var(--accent-amber); font-size: 16px;">IDENTIFICAÇÃO NECESSÁRIA</div>
        <div class="tarkov-empty-desc" style="margin: 10px 0 20px;">Você precisa se autenticar ou criar uma conta para acessar seu painel de sobrevivente.</div>
        <button id="btn-prompt-login-profile" class="tarkov-btn btn-amber" style="padding: 10px 20px;">ENTRAR / CRIAR CONTA DE CRIADOR</button>
      </div>
    `;

    document.getElementById('btn-prompt-login-profile')?.addEventListener('click', () => {
      document.getElementById('auth-modal')?.classList.add('visible');
    });
    return;
  }

  activeProfileData = await fetchProfileData(currentTargetUsername);

  if (!activeProfileData) {
    // Perfil pesquisado não existe no Supabase
    container.innerHTML = `
      <div class="tarkov-empty-state" style="padding: 60px 20px; background: var(--bg-surface-card); border: 1px solid var(--panel-border); border-radius: var(--radius-md);">
        <div class="tarkov-empty-title" style="color: var(--accent-red); font-size: 16px;">REGISTRO NÃO ENCONTRADO</div>
        <div class="tarkov-empty-desc" style="margin: 10px 0 20px;">O operador <strong>@${currentTargetUsername}</strong> ainda não existe no banco de dados do Supabase.</div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <a href="#workshop" class="tarkov-btn">VOLTAR AO CATÁLOGO</a>
          <button id="btn-create-account-from-missing" class="tarkov-btn btn-amber">REGISTRAR ESTE NOME</button>
        </div>
      </div>
    `;

    document.getElementById('btn-create-account-from-missing')?.addEventListener('click', () => {
      const authModal = document.getElementById('auth-modal');
      const toggleAuthBtn = document.getElementById('btn-toggle-auth-mode');
      const userInput = document.getElementById('auth-username');
      if (userInput) userInput.value = currentTargetUsername;
      if (toggleAuthBtn && !document.getElementById('auth-username-group')?.style.display.includes('block')) {
        toggleAuthBtn.click();
      }
      authModal?.classList.add('visible');
    });
    return;
  }

  // Verifica persistência de Follow real no Supabase
  if (currentUser && currentUser.id !== activeProfileData.id && isConfigured) {
    try {
      const { data: followRel } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', activeProfileData.id)
        .maybeSingle();
      isFollowingOperator = !!followRel;
    } catch(e) {
      console.warn('Erro ao checar status de follow:', e);
      isFollowingOperator = false;
    }
  } else {
    isFollowingOperator = false;
  }

  profileScrapsList = await fetchProfileScraps(activeProfileData.id || currentTargetUsername);
  profileUserModpacksList = await fetchUserModpacks(activeProfileData.id, activeProfileData.username);
  renderProfileView();
}

export async function fetchUserModpacks(userId, username) {
  if (isConfigured) {
    try {
      let query = supabase.from('modpacks').select('*');
      if (userId) {
        query = query.or(`author_id.eq.${userId},author.ilike.${username},author_name.ilike.${username}`);
      } else {
        query = query.or(`author.ilike.${username},author_name.ilike.${username}`);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch(e) {
      console.warn('Erro ao buscar modpacks do autor:', e);
    }
  }

  // Fallback local
  const localModpacks = JSON.parse(localStorage.getItem('PZHUB_SAVED_MODPACKS') || '[]');
  return localModpacks.filter(p => p.author === username || p.author_name === username);
}

export async function fetchProfileData(username) {
  let profile = null;
  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();

  if (isConfigured) {
    try {
      // 1. Busca por username (case-insensitive) ou por ID se for UUID
      let query = supabase.from('profiles').select('*');
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username)) {
        query = query.or(`id.eq.${username},username.ilike.${username}`);
      } else {
        query = query.ilike('username', username);
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        profile = data;
      }
    } catch (e) {
      console.warn('Perfil não encontrado no Supabase:', e);
    }
  }

  // 2. Se não encontrou no banco mas é o usuário que está autenticado, sincroniza e cria o registro automaticamente
  if (!profile && currentUser) {
    const myUsername = currentProfile?.username || currentUser.user_metadata?.username || currentUser.email?.split('@')[0];
    if (myUsername && (myUsername.toLowerCase() === username.toLowerCase() || currentUser.id === username || username === 'operador')) {
      profile = {
        id: currentUser.id,
        username: myUsername,
        display_name: currentProfile?.display_name || currentUser.user_metadata?.display_name || myUsername,
        role: myUsername.toLowerCase() === 'admin' ? 'admin' : (currentProfile?.role || 'user'),
        avatar_url: currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        banner_url: currentProfile?.banner_url || currentUser.user_metadata?.banner_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
        bio: 'Sobrevivente tático de Knox County.',
        badges: ['SOBREVIVENTE B42']
      };

      if (isConfigured) {
        try {
          const { data: upserted } = await supabase
            .from('profiles')
            .upsert([profile])
            .select()
            .maybeSingle();
          if (upserted) profile = upserted;
        } catch(err) {
          console.warn('Erro ao salvar perfil logado no Supabase:', err);
        }
      }
    }
  }

  if (!profile) {
    // Fallback Local se o usuário salvou
    const saved = localStorage.getItem(`PZHUB_PROFILE_${username}`);
    if (saved) {
      try { profile = JSON.parse(saved); } catch(e) {}
    }
  }

  if (profile) {
    // Cálculo Dinâmico Unificado de Modpacks, Likes e Seguidores
    if (isConfigured) {
      try {
        // 1. Modpacks do autor e likes recebidos em modpacks
        const { data: userModpacks } = await supabase
          .from('modpacks')
          .select('id, likes_count')
          .or(`author_id.eq.${profile.id},author.eq.${profile.username},author_name.eq.${profile.username}`);

        let modpackLikes = 0;
        let modsCount = 0;
        if (userModpacks && Array.isArray(userModpacks)) {
          modsCount = userModpacks.length;
          modpackLikes = userModpacks.reduce((acc, curr) => acc + (curr.likes_count || 0), 0);
        }

        // 2. Posts do autor na Timeline e likes recebidos em posts
        const { data: userPosts } = await supabase
          .from('posts')
          .select('id, likes_count')
          .or(`author_id.eq.${profile.id},author_username.eq.${profile.username}`);

        let postLikes = 0;
        if (userPosts && Array.isArray(userPosts)) {
          postLikes = userPosts.reduce((acc, curr) => acc + (curr.likes_count || 0), 0);
        }

        // 3. Seguidores
        const { count: followersCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profile.id);

        // 4. Seguindo
        const { count: followingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', profile.id);

        profile.total_mods_count = modsCount;
        profile.total_likes_received = modpackLikes + postLikes;
        profile.followers_count = followersCount || 0;
        profile.following_count = followingCount || 0;
      } catch (err) {
        console.warn('Erro ao agregar métricas do perfil no Supabase:', err);
      }
    } else {
      // Fallback local se offline
      const localModpacks = JSON.parse(localStorage.getItem('PZHUB_SAVED_MODPACKS') || '[]');
      const userPacks = localModpacks.filter(p => p.author === profile.username || p.author_name === profile.username);
      profile.total_mods_count = userPacks.length;
      profile.total_likes_received = userPacks.reduce((acc, p) => acc + (p.likes_count || 0), 0);
    }
  }

  return profile;
}

export function renderProfileView() {
  const container = document.getElementById('view-profile');
  if (!container || !activeProfileData) return;

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();
  const isOwner = currentUser && (currentUser.user_metadata?.username === activeProfileData.username || currentUser.id === activeProfileData.id);
  const isStaff = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'moderator');

  let roleBadgeHtml = '';
  if (activeProfileData.role === 'admin') {
    roleBadgeHtml = '<span class="tarkov-tag badge-role-admin">👑 ADMIN / STAFF</span>';
  } else if (activeProfileData.role === 'moderator') {
    roleBadgeHtml = '<span class="tarkov-tag badge-role-mod">🛡️ MODERADOR</span>';
  } else if (activeProfileData.role === 'creator') {
    roleBadgeHtml = '<span class="tarkov-tag badge-role-creator">💎 CRIADOR VERIFICADO</span>';
  } else {
    roleBadgeHtml = '<span class="tarkov-tag badge-role-user">🎖️ OPERADOR</span>';
  }

  const bannerSrc = activeProfileData.banner_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80';
  const avatarSrc = activeProfileData.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80';

  container.innerHTML = `
    <div class="steam-profile-container">
      <!-- 1. BANNER PANORÂMICO ESTILO X (TWITTER) / STEAM -->
      <div class="profile-banner-wrapper">
        <img src="${bannerSrc}" class="profile-banner-img" id="profile-banner-display" alt="Banner" onerror="this.src='https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80'" />
        <div class="profile-banner-overlay"></div>

        ${isOwner ? `
          <label class="btn-edit-banner" title="Alterar e Ajustar Banner Panorâmico">
            <svg viewBox="0 0 24 24"><path d="M4 4h3l2-2h6l2 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>
            <span>ALTERAR BANNER</span>
            <input type="file" id="input-upload-banner" accept="image/*" style="display: none;" />
          </label>
        ` : ''}
      </div>

      <!-- 2. HEADER CARD DO PERFIL (AVATAR, BIO, PATENTES) -->
      <div class="profile-card-header">
        <div class="profile-avatar-block">
          <div class="avatar-frame">
            <img src="${avatarSrc}" class="profile-avatar-img" id="profile-avatar-display" alt="${activeProfileData.username}" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80'" />
            <div class="avatar-status-dot"></div>
          </div>

          ${isOwner ? `
            <label class="btn-edit-avatar" title="Trocar e Ajustar Foto de Perfil">
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              <input type="file" id="input-upload-avatar" accept="image/*" style="display: none;" />
            </label>
          ` : ''}
        </div>

        <div class="profile-identity-strip">
          <div class="profile-name-group">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h1 class="profile-display-name">${activeProfileData.display_name || activeProfileData.username}</h1>
              ${roleBadgeHtml}
            </div>
            <span class="profile-handle">@${activeProfileData.username}</span>
          </div>

          <p class="profile-bio-text">${activeProfileData.bio || 'Sobrevivente operando no território de Knox County.'}</p>

          <div class="profile-badges-row">
            ${(activeProfileData.badges && activeProfileData.badges.length > 0 ? activeProfileData.badges : ['SOBREVIVENTE B42']).map(b => `<span class="tarkov-badge-steam">${b}</span>`).join('')}
          </div>
        </div>

        <!-- Botões de Ação do Perfil -->
        <div class="profile-actions-strip">
          ${isOwner ? `
            <button id="btn-open-profile-edit" class="tarkov-btn btn-amber">
              <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
              <span>EDITAR PERFIL</span>
            </button>
          ` : `
            <button id="btn-toggle-follow" class="tarkov-btn btn-emerald">
              <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              <span id="follow-btn-text">SEGUIR OPERADOR</span>
            </button>
          `}
        </div>
      </div>

      <!-- 3. GRADE DE ESTATÍSTICAS (STEAM SHOWCASE STYLE) -->
      <div class="profile-stats-grid">
        <div class="profile-stat-box">
          <span class="stat-label">SEGUIDORES</span>
          <span class="stat-value text-amber" id="profile-followers-count">${activeProfileData.followers_count || 0}</span>
        </div>
        <div class="profile-stat-box">
          <span class="stat-label">SEGUINDO</span>
          <span class="stat-value text-cyan">${activeProfileData.following_count || 0}</span>
        </div>
        <div class="profile-stat-box">
          <span class="stat-label">MODS PUBLICADOS</span>
          <span class="stat-value text-emerald">${profileUserModpacksList.length || activeProfileData.total_mods_count || 0}</span>
        </div>
        <div class="profile-stat-box">
          <span class="stat-label">LIKES RECEBIDOS</span>
          <span class="stat-value text-red">❤️ ${activeProfileData.total_likes_received || 0}</span>
        </div>
      </div>

      <!-- 3.5. COLEÇÕES & MODPACKS PUBLICADOS PELO OPERADOR -->
      <div class="profile-published-modpacks-section" style="margin-top: 24px;">
        <div class="scraps-header-strip">
          <div class="scraps-title-group">
            <span class="view-sub">PRODUÇÃO TÁTICA</span>
            <h2 class="section-title">MODPACKS PUBLICADOS (${profileUserModpacksList.length})</h2>
          </div>
          <span class="scrap-notice-tag">📦 Coleções disponíveis no Catálogo</span>
        </div>

        ${profileUserModpacksList.length === 0 ? `
          <div class="tarkov-empty-state" style="padding: 24px; background: rgba(0, 0, 0, 0.2); border: 1px dashed var(--panel-border); border-radius: var(--radius-sm); margin-top: 12px;">
            <div class="tarkov-empty-title" style="font-size: 13px;">NENHUM MODPACK PUBLICADO</div>
            <div class="tarkov-empty-desc" style="font-size: 12px;">Este operador ainda não publicou coleções de mods no catálogo comunitário.</div>
          </div>
        ` : `
          <div class="workshop-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 14px;">
            ${profileUserModpacksList.map(pack => `
              <div class="ws-card">
                <div class="ws-card-banner" style="background-image: url('${pack.banner_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80'}'); height: 110px; background-size: cover; background-position: center; position: relative;">
                  <div class="ws-card-tags" style="position: absolute; top: 8px; left: 8px; display: flex; gap: 4px;">
                    <span class="tarkov-tag badge-amber">${pack.zomboid_version || '42.0+'}</span>
                    <span class="tarkov-tag badge-cyan">${pack.category || 'Militar'}</span>
                  </div>
                </div>
                <div class="ws-card-body" style="padding: 12px 14px;">
                  <h3 class="ws-card-title" style="font-size: 13.5px; margin: 0 0 6px 0; color: #fff;">${pack.name}</h3>
                  <p class="ws-card-desc" style="font-size: 11.5px; color: var(--text-dim); line-height: 1.4; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${pack.description || 'Coleção tática de mods.'}</p>
                  
                  <div class="ws-card-meta" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 8px; font-size: 11px; font-family: var(--font-mono);">
                    <span style="color: var(--accent-emerald);">📦 ${(pack.mods || []).length} Mods</span>
                    <span style="color: var(--accent-amber);">❤️ ${pack.likes_count || 0} Likes</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- 4. MURAL DE RECADOS DO PERFIL (SCRAPS / DISCORD STYLE) -->
      <div class="profile-scraps-section" style="margin-top: 24px;">
        <div class="scraps-header-strip">
          <div class="scraps-title-group">
            <span class="view-sub">MURAL DE COMUNICAÇÃO</span>
            <h2 class="section-title">RECADOS DO OPERADOR (${profileScrapsList.length})</h2>
          </div>
          <span class="scrap-notice-tag">🔒 Recados gravados em registro público</span>
        </div>

        <!-- Caixa de Envio de Recado -->
        <div class="scrap-compose-box">
          <textarea id="input-scrap-message" class="tarkov-textarea" placeholder="Deixe uma mensagem tática no mural deste sobrevivente... (Não pode ser apagada por quem enviou)" rows="3"></textarea>
          <div class="scrap-compose-actions">
            <span class="scrap-cooldown-hint" id="scrap-cooldown-display">Pronto para envio</span>
            <button id="btn-send-scrap" class="tarkov-btn btn-amber">
              <span>POSTAR RECADO NO MURAL</span>
            </button>
          </div>
        </div>

        <!-- Lista de Recados -->
        <div class="scraps-feed-container" id="scraps-feed-container">
          ${profileScrapsList.length === 0 ? `
            <div class="tarkov-empty-state" style="padding: 30px;">
              <div class="tarkov-empty-title">NENHUM RECADO POSTADO AINDA</div>
              <div class="tarkov-empty-desc">Seja o primeiro sobrevivente a deixar uma transmissão de rádio neste mural.</div>
            </div>
          ` : profileScrapsList.map(scrap => {
            const canDelete = isOwner || isStaff;
            const reactions = scrap.reactions || { thumb: 0, fire: 0, skull: 0, heart: 0 };

            return `
              <div class="scrap-card" data-scrap-id="${scrap.id}">
                <div class="scrap-card-header">
                  <div class="scrap-author-info">
                    <img src="${scrap.sender_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80'}" class="scrap-avatar" alt="${scrap.sender_name}" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80'" />
                    <div class="scrap-author-text">
                      <span class="scrap-author-name">${scrap.sender_name}</span>
                      <span class="scrap-date">${new Date(scrap.created_at).toLocaleDateString('pt-BR')} às ${new Date(scrap.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  ${canDelete ? `
                    <button class="btn-delete-scrap" data-scrap-id="${scrap.id}" title="Excluir do meu mural (Apenas o Dono ou Staff)">
                      <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                  ` : ''}
                </div>

                <div class="scrap-body">
                  <p class="scrap-message-text">${scrap.message}</p>
                </div>

                <!-- Reações estilo Discord com pílulas táteis -->
                <div class="scrap-reactions-bar">
                  <button class="btn-reaction ${reactions.thumb > 0 ? 'reacted' : ''}" data-scrap-id="${scrap.id}" data-reaction="thumb" title="Positivo">
                    <span>👍</span>
                    <span class="reaction-count">${reactions.thumb || 0}</span>
                  </button>
                  <button class="btn-reaction ${reactions.fire > 0 ? 'reacted' : ''}" data-scrap-id="${scrap.id}" data-reaction="fire" title="Fogo">
                    <span>🔥</span>
                    <span class="reaction-count">${reactions.fire || 0}</span>
                  </button>
                  <button class="btn-reaction ${reactions.skull > 0 ? 'reacted' : ''}" data-scrap-id="${scrap.id}" data-reaction="skull" title="Mortal">
                    <span>💀</span>
                    <span class="reaction-count">${reactions.skull || 0}</span>
                  </button>
                  <button class="btn-reaction ${reactions.heart > 0 ? 'reacted' : ''}" data-scrap-id="${scrap.id}" data-reaction="heart" title="Apoio">
                    <span>❤️</span>
                    <span class="reaction-count">${reactions.heart || 0}</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  setupProfileEventListeners(isOwner, isStaff);
}

function setupProfileEventListeners(isOwner, isStaff) {
  // Abrir Painel Completo de Edição de Perfil
  const openEditBtn = document.getElementById('btn-open-profile-edit');
  if (openEditBtn) {
    openEditBtn.onclick = () => {
      openProfileCustomizationModal();
    };
  }

  // Follow button com persistência real no Supabase
  const followBtn = document.getElementById('btn-toggle-follow');
  const followText = document.getElementById('follow-btn-text');
  const followersCountEl = document.getElementById('profile-followers-count');

  if (followBtn) {
    followBtn.classList.toggle('btn-amber', isFollowingOperator);
    followBtn.classList.toggle('btn-emerald', !isFollowingOperator);
    if (followText) followText.textContent = isFollowingOperator ? '✓ SEGUINDO' : 'SEGUIR OPERADOR';

    followBtn.addEventListener('click', async () => {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        document.getElementById('auth-modal')?.classList.add('visible');
        return;
      }

      if (currentUser.id === activeProfileData.id) {
        showTacticalToast('Você não pode seguir a si mesmo.', 'warning');
        return;
      }

      const nextFollowState = !isFollowingOperator;
      isFollowingOperator = nextFollowState;
      followBtn.classList.toggle('btn-amber', isFollowingOperator);
      followBtn.classList.toggle('btn-emerald', !isFollowingOperator);
      if (followText) followText.textContent = isFollowingOperator ? '✓ SEGUINDO' : 'SEGUIR OPERADOR';

      const currentCount = parseInt(followersCountEl?.textContent || '0', 10);
      if (followersCountEl) {
        followersCountEl.textContent = isFollowingOperator ? currentCount + 1 : Math.max(0, currentCount - 1);
      }

      if (isConfigured) {
        try {
          if (nextFollowState) {
            await supabase.from('follows').insert([{
              follower_id: currentUser.id,
              following_id: activeProfileData.id
            }]);
            showTacticalToast(`Agora você está seguindo @${activeProfileData.username}!`, 'success');
          } else {
            await supabase.from('follows').delete()
              .eq('follower_id', currentUser.id)
              .eq('following_id', activeProfileData.id);
            showTacticalToast(`Deixou de seguir @${activeProfileData.username}.`, 'info');
          }
        } catch (err) {
          console.error('Erro ao persistir follow no Supabase:', err);
          showTacticalToast('Erro ao sincronizar com o banco.', 'error');
        }
      }
    });
  }

  // Envio de Recado
  const sendScrapBtn = document.getElementById('btn-send-scrap');
  const scrapInput = document.getElementById('input-scrap-message');
  const cooldownHint = document.getElementById('scrap-cooldown-display');

  if (sendScrapBtn && scrapInput) {
    sendScrapBtn.addEventListener('click', async () => {
      const text = scrapInput.value.trim();
      if (!text) return;

      const now = Date.now();
      if (now - lastScrapPostTime < 10000) {
        const remaining = Math.ceil((10000 - (now - lastScrapPostTime)) / 1000);
        if (cooldownHint) cooldownHint.textContent = `Aguarde ${remaining}s antes de postar outro recado...`;
        return;
      }

      lastScrapPostTime = now;
      const currentUser = getCurrentUser();
      const currentProfile = getCurrentUserProfile();

      const newScrap = {
        id: `sc-${Date.now()}`,
        profile_id: activeProfileData.id || activeProfileData.username,
        sender_id: currentUser?.id || 'guest-user',
        sender_name: currentProfile?.display_name || currentUser?.user_metadata?.display_name || currentProfile?.username || 'Sobrevivente Anônimo',
        sender_avatar: currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80',
        message: text,
        likes_count: 0,
        reactions: { thumb: 0, fire: 0, skull: 0, heart: 0 },
        created_at: new Date().toISOString()
      };

      profileScrapsList.unshift(newScrap);
      saveScrapsLocally(activeProfileData.id || activeProfileData.username, profileScrapsList);

      if (isConfigured && currentUser) {
        try {
          await supabase.from('profile_scraps').insert([{
            profile_id: activeProfileData.id,
            sender_id: currentUser.id,
            sender_name: newScrap.sender_name,
            sender_avatar: newScrap.sender_avatar,
            message: text,
            reactions: newScrap.reactions
          }]);
        } catch(err) {
          console.warn('Erro ao salvar recado no Supabase:', err);
        }
      }

      scrapInput.value = '';
      if (cooldownHint) cooldownHint.textContent = 'Recado gravado no mural com sucesso!';
      renderProfileView();
    });
  }

  // Deletar Recado
  document.querySelectorAll('.btn-delete-scrap').forEach(btn => {
    btn.addEventListener('click', async () => {
      const scrapId = btn.dataset.scrapId;
      if (confirm('Deseja remover este recado do seu mural?')) {
        profileScrapsList = profileScrapsList.filter(s => s.id !== scrapId);
        saveScrapsLocally(activeProfileData.id || activeProfileData.username, profileScrapsList);

        if (isConfigured) {
          try {
            await supabase.from('profile_scraps').delete().eq('id', scrapId);
          } catch(e) {}
        }

        renderProfileView();
      }
    });
  });

  // Reações do Discord
  document.querySelectorAll('.btn-reaction').forEach(btn => {
    btn.addEventListener('click', () => {
      const scrapId = btn.dataset.scrapId;
      const reaction = btn.dataset.reaction;
      const scrap = profileScrapsList.find(s => s.id === scrapId);
      if (scrap) {
        scrap.reactions = scrap.reactions || { thumb: 0, fire: 0, skull: 0, heart: 0 };
        scrap.reactions[reaction] = (scrap.reactions[reaction] || 0) + 1;
        btn.classList.add('reacted');
        const countEl = btn.querySelector('.reaction-count');
        if (countEl) countEl.textContent = scrap.reactions[reaction];
        saveScrapsLocally(activeProfileData.id || activeProfileData.username, profileScrapsList);

        if (isConfigured) {
          supabase.from('profile_scraps').update({ reactions: scrap.reactions }).eq('id', scrapId).then();
        }
      }
    });
  });

  // Upload, Ajuste e Compressão de Foto de Perfil (Avatar 1:1 Circular)
  const avatarInput = document.getElementById('input-upload-avatar');
  if (avatarInput) {
    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        triggerAvatarCropper(file);
      }
    });
  }

  // Upload, Ajuste e Compressão de Banner Panorâmico (3:1 Panorâmico HD)
  const bannerInput = document.getElementById('input-upload-banner');
  if (bannerInput) {
    bannerInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        triggerBannerCropper(file);
      }
    });
  }
}

function triggerAvatarCropper(file) {
  openImageCropperModal(file, {
    title: 'AJUSTE DE FOTO DE PERFIL // AVATAR',
    aspectRatio: 1,
    isCircle: true,
    outputWidth: 384,
    outputHeight: 384,
    quality: 0.85,
    onComplete: async (compressedBase64) => {
      activeProfileData.avatar_url = compressedBase64;
      const previewEl = document.getElementById('edit-preview-avatar');
      if (previewEl) previewEl.src = compressedBase64;
      saveProfileLocally(activeProfileData);

      if (isConfigured) {
        try {
          await supabase.from('profiles').update({ avatar_url: compressedBase64 }).eq('username', activeProfileData.username);
        } catch(e) {
          console.warn('Erro ao salvar avatar no Supabase:', e);
        }
      }
      renderProfileView();
    }
  });
}

function triggerBannerCropper(file) {
  openImageCropperModal(file, {
    title: 'AJUSTE DE BANNER PANORÂMICO TÁTICO',
    aspectRatio: 3 / 1,
    isCircle: false,
    outputWidth: 1200,
    outputHeight: 400,
    quality: 0.85,
    onComplete: async (compressedBase64) => {
      activeProfileData.banner_url = compressedBase64;
      saveProfileLocally(activeProfileData);

      if (isConfigured) {
        try {
          await supabase.from('profiles').update({ banner_url: compressedBase64 }).eq('username', activeProfileData.username);
        } catch(e) {
          console.warn('Erro ao salvar banner no Supabase:', e);
        }
      }
      renderProfileView();
    }
  });
}

/**
 * Abre o Painel Completo de Customização e Edição de Perfil
 */
export function openProfileCustomizationModal() {
  const modal = document.getElementById('profile-edit-modal');
  const closeBtn = document.getElementById('profile-edit-modal-close');
  const cancelBtn = document.getElementById('btn-cancel-profile-edit');
  const form = document.getElementById('profile-edit-form');
  const displayNameInput = document.getElementById('edit-profile-display-name');
  const usernameInput = document.getElementById('edit-profile-username');
  const bioInput = document.getElementById('edit-profile-bio');
  const bioCounter = document.getElementById('edit-bio-counter');
  const previewAvatar = document.getElementById('edit-preview-avatar');
  const badgesContainer = document.getElementById('edit-profile-badges-container');
  const avatarUpload = document.getElementById('edit-modal-avatar-upload');
  const bannerUpload = document.getElementById('edit-modal-banner-upload');
  const statusMsg = document.getElementById('profile-edit-status-msg');

  if (!modal || !activeProfileData) return;

  // Preenchimento dos dados do perfil ativo
  if (displayNameInput) displayNameInput.value = activeProfileData.display_name || activeProfileData.username;
  if (usernameInput) usernameInput.value = `@${activeProfileData.username}`;
  if (bioInput) {
    bioInput.value = activeProfileData.bio || '';
    if (bioCounter) bioCounter.textContent = `${bioInput.value.length} / 280`;

    bioInput.oninput = () => {
      if (bioCounter) bioCounter.textContent = `${bioInput.value.length} / 280`;
    };
  }

  if (previewAvatar) {
    previewAvatar.src = activeProfileData.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80';
  }

  if (statusMsg) statusMsg.textContent = '';

  // Configuração das Insígnias & Patentes (Chips Selecionáveis)
  modalSelectedBadges = Array.isArray(activeProfileData.badges) ? [...activeProfileData.badges] : ['SOBREVIVENTE B42'];

  if (badgesContainer) {
    badgesContainer.innerHTML = AVAILABLE_BADGES.map(badge => {
      const isSelected = modalSelectedBadges.includes(badge);
      return `
        <div class="badge-toggle-chip ${isSelected ? 'active' : ''}" data-badge="${badge}">
          <span>${isSelected ? '✓' : '+'}</span>
          <span>${badge}</span>
        </div>
      `;
    }).join('');

    badgesContainer.querySelectorAll('.badge-toggle-chip').forEach(chip => {
      chip.onclick = () => {
        const badgeName = chip.dataset.badge;
        if (modalSelectedBadges.includes(badgeName)) {
          modalSelectedBadges = modalSelectedBadges.filter(b => b !== badgeName);
          chip.classList.remove('active');
          chip.querySelector('span').textContent = '+';
        } else {
          modalSelectedBadges.push(badgeName);
          chip.classList.add('active');
          chip.querySelector('span').textContent = '✓';
        }
      };
    });
  }

  // Bind dos botões de troca de mídia interna do modal
  if (avatarUpload) {
    avatarUpload.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) triggerAvatarCropper(file);
    };
  }

  if (bannerUpload) {
    bannerUpload.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) triggerBannerCropper(file);
    };
  }

  // Fechamento
  const closeModal = () => {
    modal.classList.remove('visible');
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  // Submissão do Formulário
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const newDisplayName = displayNameInput?.value.trim() || activeProfileData.username;
      const newBio = bioInput?.value.trim() || '';

      if (statusMsg) statusMsg.textContent = 'Gravando alterações no Supabase...';

      activeProfileData.display_name = newDisplayName;
      activeProfileData.bio = newBio;
      activeProfileData.badges = modalSelectedBadges.length > 0 ? modalSelectedBadges : ['SOBREVIVENTE B42'];
      activeProfileData.updated_at = new Date().toISOString();

      saveProfileLocally(activeProfileData);

      if (isConfigured) {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              display_name: activeProfileData.display_name,
              bio: activeProfileData.bio,
              badges: activeProfileData.badges,
              updated_at: activeProfileData.updated_at
            })
            .eq('username', activeProfileData.username);

          if (error) throw error;
        } catch(err) {
          console.warn('Erro ao atualizar perfil no Supabase:', err);
        }
      }

      closeModal();
      renderProfileView();
    };
  }

  modal.classList.add('visible');
}

async function fetchProfileScraps(profileId) {
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('profile_scraps')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) return data;
    } catch (e) {
      console.warn('Erro ao ler scraps do Supabase:', e);
    }
  }

  const saved = localStorage.getItem(`PZHUB_SCRAPS_${profileId}`);
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }

  return [];
}

function saveScrapsLocally(profileId, scraps) {
  localStorage.setItem(`PZHUB_SCRAPS_${profileId}`, JSON.stringify(scraps));
}

function saveProfileLocally(profile) {
  localStorage.setItem(`PZHUB_PROFILE_${profile.username}`, JSON.stringify(profile));
}
