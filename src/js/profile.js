/**
 * PZHub - Social Profile Module (X / Steam Showcase Style)
 * Gerenciamento de perfil, avatar/banner em Canvas, Seguidores e Mural de Recados com Reações Discord.
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser, getCurrentUserProfile } from './auth.js';

let activeProfileData = null;
let currentTargetUsername = null;
let profileScrapsList = [];
let lastScrapPostTime = 0;

export async function loadUserProfileView(targetUsername) {
  const container = document.getElementById('view-profile');
  if (!container) return;

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();

  currentTargetUsername = targetUsername || currentProfile?.username || currentUser?.user_metadata?.username;

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

  profileScrapsList = await fetchProfileScraps(activeProfileData.id || currentTargetUsername);
  renderProfileView();
}

export async function fetchProfileData(username) {
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (!error && data) {
        return data;
      }
    } catch (e) {
      console.warn('Perfil não encontrado no Supabase:', e);
    }
  }

  // Fallback Local se o usuário salvou ou está no modo demo
  const saved = localStorage.getItem(`PZHUB_PROFILE_${username}`);
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }

  if (username === 'operador_alpha') {
    return {
      id: `user-${username}`,
      username: username,
      display_name: 'Capitão Miller [VICCS]',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
      banner_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      bio: 'Veterano de Knox County e explorador de Z-Levels. Desenvolvedor de coleções táticas e sobrevivência militar para Build 42.',
      role: 'creator',
      badges: ['SOBREVIVENTE B42', 'CRIADOR TÁTICO', 'LÍDER DE ESQUADRÃO'],
      followers_count: 148,
      following_count: 32,
      total_mods_count: 4,
      total_likes_received: 894,
      is_demo: true,
      created_at: new Date(Date.now() - 86400000 * 60).toISOString()
    };
  }

  return null;
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
          <label class="btn-edit-banner" title="Alterar Banner Panorâmico">
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
            <label class="btn-edit-avatar" title="Trocar Foto de Perfil">
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
              ${activeProfileData.is_demo ? '<span class="tarkov-tag badge-version" style="color: var(--accent-amber); border-color: var(--accent-amber);">PERFIL DEMONSTRATIVO</span>' : ''}
            </div>
            <span class="profile-handle">@${activeProfileData.username}</span>
          </div>

          <p class="profile-bio-text">${activeProfileData.bio || 'Sobrevivente operando no território de Knox County.'}</p>

          <div class="profile-badges-row">
            ${(activeProfileData.badges || ['SOBREVIVENTE B42']).map(b => `<span class="tarkov-badge-steam">${b}</span>`).join('')}
          </div>
        </div>

        <!-- Botões de Ação do Perfil -->
        <div class="profile-actions-strip">
          ${isOwner ? `
            <button id="btn-edit-bio-prompt" class="tarkov-btn btn-amber">
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              <span>EDITAR BIO</span>
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
          <span class="stat-value text-emerald">${activeProfileData.total_mods_count || 0}</span>
        </div>
        <div class="profile-stat-box">
          <span class="stat-label">LIKES RECEBIDOS</span>
          <span class="stat-value text-red">❤️ ${activeProfileData.total_likes_received || 0}</span>
        </div>
      </div>

      <!-- 4. MURAL DE RECADOS DO PERFIL (SCRAPS / DISCORD STYLE) -->
      <div class="profile-scraps-section">
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
                  <button class="reaction-pill btn-reaction" data-scrap-id="${scrap.id}" data-reaction="thumb">
                    <span>👍</span> <strong class="reaction-count">${reactions.thumb || 0}</strong>
                  </button>
                  <button class="reaction-pill btn-reaction" data-scrap-id="${scrap.id}" data-reaction="fire">
                    <span>🔥</span> <strong class="reaction-count">${reactions.fire || 0}</strong>
                  </button>
                  <button class="reaction-pill btn-reaction" data-scrap-id="${scrap.id}" data-reaction="skull">
                    <span>💀</span> <strong class="reaction-count">${reactions.skull || 0}</strong>
                  </button>
                  <button class="reaction-pill btn-reaction" data-scrap-id="${scrap.id}" data-reaction="heart">
                    <span>❤️</span> <strong class="reaction-count">${reactions.heart || 0}</strong>
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
  // Editar Bio
  const editBioBtn = document.getElementById('btn-edit-bio-prompt');
  if (editBioBtn) {
    editBioBtn.onclick = async () => {
      const newBio = prompt('Atualize sua biografia tática de sobrevivente:', activeProfileData.bio || '');
      if (newBio !== null) {
        activeProfileData.bio = newBio.trim();
        saveProfileLocally(activeProfileData);
        if (isConfigured) {
          try {
            await supabase.from('profiles').update({ bio: activeProfileData.bio }).eq('username', activeProfileData.username);
          } catch(e) {}
        }
        renderProfileView();
      }
    };
  }

  // Follow button
  const followBtn = document.getElementById('btn-toggle-follow');
  const followText = document.getElementById('follow-btn-text');
  const followersCountEl = document.getElementById('profile-followers-count');

  if (followBtn) {
    let following = false;
    followBtn.addEventListener('click', () => {
      following = !following;
      followBtn.classList.toggle('btn-amber', following);
      followBtn.classList.toggle('btn-emerald', !following);
      if (followText) followText.textContent = following ? '✓ SEGUINDO' : 'SEGUIR OPERADOR';

      const currentCount = parseInt(followersCountEl?.textContent || '0', 10);
      if (followersCountEl) {
        followersCountEl.textContent = following ? currentCount + 1 : Math.max(0, currentCount - 1);
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

  // Deletar Recado (Apenas dono do perfil ou staff)
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

  // Upload e redimensionamento em Canvas de Avatar
  const avatarInput = document.getElementById('input-upload-avatar');
  if (avatarInput) {
    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const compressedBase64 = await resizeImageWithCanvas(file, 256, 256);
        activeProfileData.avatar_url = compressedBase64;
        saveProfileLocally(activeProfileData);

        if (isConfigured) {
          try {
            await supabase.from('profiles').update({ avatar_url: compressedBase64 }).eq('username', activeProfileData.username);
          } catch(e) {}
        }
        renderProfileView();
      }
    });
  }

  // Upload e redimensionamento em Canvas de Banner
  const bannerInput = document.getElementById('input-upload-banner');
  if (bannerInput) {
    bannerInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const compressedBase64 = await resizeImageWithCanvas(file, 1200, 400);
        activeProfileData.banner_url = compressedBase64;
        saveProfileLocally(activeProfileData);

        if (isConfigured) {
          try {
            await supabase.from('profiles').update({ banner_url: compressedBase64 }).eq('username', activeProfileData.username);
          } catch(e) {}
        }
        renderProfileView();
      }
    });
  }
}

/**
 * Utilitário de redimensionamento e compressão em Canvas (Zero dependências externas)
 */
export function resizeImageWithCanvas(file, targetWidth, targetHeight) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        
        // Cobertura proporcional (object-fit: cover)
        const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
        const x = (targetWidth - img.width * scale) / 2;
        const y = (targetHeight - img.height * scale) / 2;
        
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
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
