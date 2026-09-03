/**
 * PZHub - Tactical Radar Social & Timeline Module (X / Twitter Style)
 * 100% Conectado ao Supabase Backend em Produção (Sem Placeholders/Mocks)
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser, getCurrentUserProfile, openAuthModal } from './auth.js';
import { openImageCropperModal } from './imageCropper.js';
import { showTacticalAlert, showTacticalToast } from './tacticalModal.js';

let postsList = [];
let userLikedPostIds = new Set();
let activeFeedTab = 'discovery'; // 'discovery' | 'following'
let attachedMediaList = []; // Array de base64/URLs (máximo 4)
let attachedYoutubeId = null;
let activeSearchTag = '';
let currentLightboxImages = [];
let currentLightboxIndex = 0;

export async function initTimeline() {
  const composeTextarea = document.getElementById('timeline-compose-textarea');
  const charCounter = document.getElementById('timeline-char-counter');
  const publishBtn = document.getElementById('btn-timeline-publish');
  const addMediaBtn = document.getElementById('btn-add-timeline-media');
  const mediaFileInput = document.getElementById('input-timeline-media-file');
  const addYoutubeBtn = document.getElementById('btn-add-timeline-youtube');
  const youtubeInputBox = document.getElementById('timeline-youtube-input-box');
  const youtubeUrlInput = document.getElementById('input-timeline-youtube-url');
  const attachYoutubeBtn = document.getElementById('btn-attach-youtube-confirm');
  const cancelYoutubeBtn = document.getElementById('btn-cancel-youtube');
  const feedTabDiscovery = document.getElementById('tab-feed-discovery');
  const feedTabFollowing = document.getElementById('tab-feed-following');

  // Configura modais de autenticação e lightbox
  setupAuthLockModal();
  setupLightboxModal();

  // Atualiza foto do autor logado na caixa de composição
  updateComposeAvatar();

  // 1. Contador de Caracteres (0 a 280)
  if (composeTextarea) {
    composeTextarea.addEventListener('input', () => {
      const len = composeTextarea.value.length;
      if (charCounter) {
        charCounter.textContent = `${280 - len}`;
        charCounter.style.color = len > 260 ? 'var(--accent-red)' : (len > 220 ? 'var(--accent-amber)' : 'var(--text-dim)');
      }
    });
  }

  // 2. Anexo de Mídia (Imagens com Modal de Enquadramento e Compressor)
  if (addMediaBtn && mediaFileInput) {
    addMediaBtn.addEventListener('click', () => {
      if (attachedMediaList.length >= 4) {
        showTacticalAlert('Você pode anexar no máximo 4 imagens por postagem.', 'LIMITE DE ANEXOS', 'warning');
        return;
      }
      mediaFileInput.click();
    });

    mediaFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        openImageCropperModal(file, {
          title: 'AJUSTE DE FOTO PARA TIMELINE',
          aspectRatio: 16 / 9,
          outputWidth: 1200,
          outputHeight: 675,
          quality: 0.85,
          onComplete: (compressedBase64) => {
            if (attachedMediaList.length < 4) {
              attachedMediaList.push(compressedBase64);
              renderComposeMediaPreviews();
            }
          }
        });
      }
      mediaFileInput.value = '';
    });
  }

  // 3. Anexo de Vídeo do YouTube
  if (addYoutubeBtn && youtubeInputBox) {
    addYoutubeBtn.addEventListener('click', () => {
      youtubeInputBox.style.display = youtubeInputBox.style.display === 'flex' ? 'none' : 'flex';
      if (youtubeUrlInput) youtubeUrlInput.focus();
    });
  }

  if (attachYoutubeBtn && youtubeUrlInput) {
    attachYoutubeBtn.addEventListener('click', () => {
      const rawUrl = youtubeUrlInput.value.trim();
      const ytId = extractYoutubeId(rawUrl);
      if (ytId) {
        attachedYoutubeId = ytId;
        youtubeInputBox.style.display = 'none';
        youtubeUrlInput.value = '';
        renderComposeMediaPreviews();
      } else {
        showTacticalAlert('URL do YouTube inválida. Insira um link como https://youtu.be/... ou https://youtube.com/watch?v=...', 'VÍDEO INVÁLIDO', 'warning');
      }
    });
  }

  if (cancelYoutubeBtn && youtubeInputBox) {
    cancelYoutubeBtn.addEventListener('click', () => {
      youtubeInputBox.style.display = 'none';
      if (youtubeUrlInput) youtubeUrlInput.value = '';
    });
  }

  // 4. Abas do Feed (Para Você vs Seguindo)
  if (feedTabDiscovery) {
    feedTabDiscovery.addEventListener('click', () => {
      activeFeedTab = 'discovery';
      feedTabDiscovery.classList.add('active');
      feedTabFollowing?.classList.remove('active');
      renderTimelineFeed();
    });
  }

  if (feedTabFollowing) {
    feedTabFollowing.addEventListener('click', () => {
      activeFeedTab = 'following';
      feedTabFollowing.classList.add('active');
      feedTabDiscovery?.classList.remove('active');
      renderTimelineFeed();
    });
  }

  // 5. Botão de Publicar Post
  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      await handlePublishTimelinePost();
    });
  }

  // Carrega dados 100% reais do Supabase
  await loadTimelinePosts();
  await renderFollowSuggestionsSidebar();
}

function setupAuthLockModal() {
  const modal = document.getElementById('timeline-auth-lock-modal');
  const closeBtn = document.getElementById('timeline-auth-lock-close');
  const loginBtn = document.getElementById('modal-btn-feed-login');
  const registerBtn = document.getElementById('modal-btn-feed-register');

  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.remove('visible');
  }

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('visible');
    };
  }

  if (loginBtn) {
    loginBtn.onclick = () => {
      modal?.classList.remove('visible');
      openAuthModal(false);
    };
  }

  if (registerBtn) {
    registerBtn.onclick = () => {
      modal?.classList.remove('visible');
      openAuthModal(true);
    };
  }
}

export function showAuthLockModal() {
  const modal = document.getElementById('timeline-auth-lock-modal');
  if (modal) {
    modal.classList.add('visible');
  }
}

export function updateComposeAvatar() {
  const avatarEl = document.getElementById('compose-user-avatar');
  if (!avatarEl) return;
  const currentProfile = getCurrentUserProfile();
  const currentUser = getCurrentUser();
  const avatarUrl = currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80';
  avatarEl.src = avatarUrl;
  avatarEl.onerror = () => {
    avatarEl.src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80';
  };
}

export function extractYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

function renderComposeMediaPreviews() {
  const container = document.getElementById('timeline-compose-previews');
  if (!container) return;

  if (attachedMediaList.length === 0 && !attachedYoutubeId) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  let html = '';

  // Imagens
  attachedMediaList.forEach((src, idx) => {
    html += `
      <div class="compose-thumb-card">
        <img src="${src}" alt="Anexo ${idx + 1}" />
        <button type="button" class="btn-remove-thumb" data-media-idx="${idx}" title="Remover Imagem">✕</button>
      </div>
    `;
  });

  // Vídeo YouTube
  if (attachedYoutubeId) {
    html += `
      <div class="compose-thumb-card yt-thumb-card">
        <img src="https://img.youtube.com/vi/${attachedYoutubeId}/mqdefault.jpg" alt="YouTube Preview" />
        <div class="yt-thumb-badge">▶ VÍDEO YOUTUBE</div>
        <button type="button" class="btn-remove-yt-thumb" title="Remover Vídeo">✕</button>
      </div>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.btn-remove-thumb').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.mediaIdx, 10);
      attachedMediaList.splice(idx, 1);
      renderComposeMediaPreviews();
    };
  });

  container.querySelector('.btn-remove-yt-thumb')?.addEventListener('click', () => {
    attachedYoutubeId = null;
    renderComposeMediaPreviews();
  });
}

export async function loadTimelinePosts() {
  updateComposeAvatar();

  const currentUser = getCurrentUser();
  if (currentUser && isConfigured) {
    try {
      const { data: likesData } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', currentUser.id);
      if (likesData && Array.isArray(likesData)) {
        userLikedPostIds = new Set(likesData.map(l => l.post_id));
      }
    } catch (e) {
      console.warn('Erro ao ler curtidas do usuário no Supabase:', e);
    }
  } else {
    userLikedPostIds.clear();
  }

  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        postsList = data;
        localStorage.setItem('PZHUB_TIMELINE_POSTS', JSON.stringify(postsList));
        renderTimelineFeed();
        renderTrendingSidebar();
        return;
      }
    } catch (e) {
      console.warn('Erro ao ler posts da Timeline no Supabase:', e);
    }
  }

  // Fallback 100% limpo (sem posts fake)
  postsList = [];
  localStorage.removeItem('PZHUB_TIMELINE_POSTS');
  renderTimelineFeed();
  renderTrendingSidebar();
}

async function handlePublishTimelinePost() {
  const textarea = document.getElementById('timeline-compose-textarea');
  const content = textarea?.value.trim();

  if (!content && attachedMediaList.length === 0 && !attachedYoutubeId) {
    showTacticalAlert('Escreva uma mensagem ou anexe uma foto/vídeo antes de publicar na rede.', 'CONTEÚDO NECESSÁRIO', 'warning');
    return;
  }

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();

  if (!currentUser) {
    showAuthLockModal();
    return;
  }

  // Extração de hashtags do texto (#Loot, #Build42, etc.)
  const foundTags = (content.match(/#(\w+)/g) || []).map(t => t.replace('#', ''));

  const newPost = {
    id: `post-${Date.now()}`,
    author_id: currentUser.id,
    author_name: currentProfile?.display_name || currentProfile?.username || currentUser.user_metadata?.username || 'Operador',
    author_username: currentProfile?.username || currentUser.user_metadata?.username || 'operador',
    author_avatar: currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
    author_role: currentProfile?.role || 'user',
    content: content || '',
    media_urls: [...attachedMediaList],
    youtube_id: attachedYoutubeId,
    likes_count: 0,
    reposts_count: 0,
    comments_count: 0,
    tags: foundTags,
    created_at: new Date().toISOString()
  };

  if (isConfigured) {
    try {
      const { data, error } = await supabase.from('posts').insert([{
        author_id: newPost.author_id,
        author_name: newPost.author_name,
        author_username: newPost.author_username,
        author_avatar: newPost.author_avatar,
        author_role: newPost.author_role,
        content: newPost.content,
        media_urls: newPost.media_urls,
        youtube_id: newPost.youtube_id,
        tags: newPost.tags
      }]).select();

      if (!error && data?.[0]) {
        newPost.id = data[0].id;
      }
    } catch(err) {
      console.warn('Erro ao salvar post no Supabase:', err);
    }
  }

  postsList.unshift(newPost);
  localStorage.setItem('PZHUB_TIMELINE_POSTS', JSON.stringify(postsList));

  // Limpa formulário
  if (textarea) textarea.value = '';
  attachedMediaList = [];
  attachedYoutubeId = null;
  renderComposeMediaPreviews();
  const counterEl = document.getElementById('timeline-char-counter');
  if (counterEl) counterEl.textContent = '280';

  renderTimelineFeed();
  renderTrendingSidebar();
}

export function renderTimelineFeed() {
  const container = document.getElementById('timeline-feed-stream');
  if (!container) return;

  updateComposeAvatar();

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();
  const composeCard = document.querySelector('.timeline-compose-card');

  // Se o usuário NÃO está logado: bloqueia leitura e exibe aviso tático de autenticação obrigatória
  if (!currentUser) {
    if (composeCard) {
      composeCard.style.opacity = '0.4';
      composeCard.style.pointerEvents = 'none';
    }

    container.innerHTML = `
      <div class="timeline-lock-gate-card" style="padding: 48px 24px; background: rgba(14, 17, 23, 0.95); border: 1px solid rgba(229, 142, 38, 0.4); border-radius: 6px; text-align: center; box-shadow: 0 4px 30px rgba(0,0,0,0.8); margin-bottom: 24px;">
        <div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
        <span class="tarkov-tag badge-amber" style="margin-bottom: 12px; font-size: 11px;">CANAL MILITAR CRIPTOGRAFADO // FREQ. 92.4 MHz</span>
        <h2 style="font-size: 20px; font-weight: 800; color: #fff; letter-spacing: 1px; margin: 10px 0 14px 0;">AUTENTICAÇÃO NECESSÁRIA PARA LER TRANSMISSÕES</h2>
        <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6; max-width: 580px; margin: 0 auto 24px auto; background: rgba(0,0,0,0.4); padding: 16px; border: 1px solid var(--panel-border); border-radius: 4px; text-align: left;">
          As transmissões de rádio e mensagens da comunidade de Knox County contêm relatórios de bases, coordenadas de esquadrões e discussões táticas da comunidade Project Zomboid.
          <br><br>
          Para evitar transmissões fantasmas e proteger a segurança dos operadores, <strong>é obrigatório estar conectado com seu perfil</strong> para visualizar as postagens e interagir no feed.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button id="btn-gate-login" class="tarkov-btn btn-amber" style="padding: 12px 24px; font-size: 13px;">
            <span>⚡ ENTRAR NA FREQUÊNCIA (LOGIN)</span>
          </button>
          <button id="btn-gate-register" class="tarkov-btn btn-cyan" style="padding: 12px 24px; font-size: 13px;">
            <span>🎖️ ALISTAR-SE (CRIAR CONTA)</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-gate-login')?.addEventListener('click', () => openAuthModal(false));
    document.getElementById('btn-gate-register')?.addEventListener('click', () => openAuthModal(true));
    
    // Abre o modal de bloqueio automaticamente
    showAuthLockModal();
    return;
  }

  // Usuário autenticado: libera o compositor
  if (composeCard) {
    composeCard.style.opacity = '1';
    composeCard.style.pointerEvents = 'auto';
  }

  let filtered = [...postsList];

  // Filtro por Tag Ativa se o usuário clicou num Trending Topic
  if (activeSearchTag) {
    filtered = filtered.filter(p => (p.tags || []).some(t => t.toLowerCase() === activeSearchTag.toLowerCase()) || p.content.toLowerCase().includes(`#${activeSearchTag.toLowerCase()}`));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="tarkov-empty-state" style="padding: 60px 20px; background: rgba(0,0,0,0.4); border: 1px dashed var(--panel-border); border-radius: 4px; text-align: center;">
        <svg viewBox="0 0 24 24" style="width: 48px; height: 48px; fill: var(--text-dim); margin-bottom: 12px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        <div class="tarkov-empty-title" style="color: var(--text-main); font-size: 14px; font-weight: bold; letter-spacing: 1px;">NENHUMA TRANSMISSÃO NA FREQUÊNCIA</div>
        <div class="tarkov-empty-desc" style="color: var(--text-dim); font-size: 12px; margin-top: 6px; max-width: 440px; margin-left: auto; margin-right: auto;">Seja o primeiro operador a publicar uma mensagem, foto de base ou vídeo na rede de Knox County.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(post => {
    // Formatação de Papel / Role
    let roleBadge = '';
    if (post.author_role === 'admin') roleBadge = '<span class="tarkov-tag badge-role-admin" style="font-size: 9px; padding: 1px 5px;">👑 ADMIN</span>';
    else if (post.author_role === 'creator') roleBadge = '<span class="tarkov-tag badge-role-creator" style="font-size: 9px; padding: 1px 5px;">💎 CRIADOR</span>';

    // Formatação de Tempo Amigável
    const timeAgo = formatTimeAgo(new Date(post.created_at));

    // Permissão de exclusão (Autor do post ou Moderador/Admin da Staff)
    const isAuthor = currentUser && (currentUser.id === post.author_id || currentUser.user_metadata?.username === post.author_username);
    const isStaff = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'moderator');
    const canDelete = isAuthor || isStaff;

    // Formatação de Texto com Hashtags e Menções destacadas
    const formattedContent = escapeHtml(post.content)
      .replace(/#(\w+)/g, '<span class="timeline-hashtag" data-tag="$1">#$1</span>')
      .replace(/@(\w+)/g, '<a href="#profile/$1" class="timeline-mention">@$1</a>');

    // Renderização do Grid de Mídia (1 a 4 fotos) se houver fotos reais anexadas
    const photoGridHtml = renderPostPhotoGrid(post.media_urls, post.id);

    // Renderização do Embed do YouTube se houver ID válido
    const youtubeHtml = post.youtube_id ? renderYoutubeEmbed(post.youtube_id, post.id) : '';

    return `
      <article class="timeline-tweet-card" data-post-id="${post.id}">
        <div class="tweet-card-left">
          <a href="#profile/${post.author_username || 'operador'}" class="tweet-avatar-link">
            <img src="${post.author_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80'}" class="tweet-avatar-img" alt="${post.author_username}" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80'" />
          </a>
        </div>

        <div class="tweet-card-right">
          <div class="tweet-header">
            <div class="tweet-author-meta">
              <a href="#profile/${post.author_username || 'operador'}" class="tweet-display-name">${post.author_name}</a>
              ${roleBadge}
              <span class="tweet-handle">@${post.author_username}</span>
              <span class="tweet-dot">•</span>
              <span class="tweet-time" title="${new Date(post.created_at).toLocaleString('pt-BR')}">${timeAgo}</span>
            </div>

            ${canDelete ? `
              <button class="btn-delete-post" data-post-id="${post.id}" title="Excluir Transmissão" style="background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: var(--transition-fast); display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            ` : ''}
          </div>

          <!-- Conteúdo do Post -->
          ${formattedContent ? `
            <div class="tweet-content">
              <p class="tweet-text">${formattedContent}</p>
            </div>
          ` : ''}

          <!-- Grid de Fotos / Carrossel -->
          ${photoGridHtml}

          <!-- Player YouTube Tático -->
          ${youtubeHtml}

          <!-- Barra de Ações Estilo X (Twitter) -->
          <div class="tweet-actions-bar">
            <button class="tweet-action-btn btn-action-reply" data-post-id="${post.id}" title="Comentários">
              <svg viewBox="0 0 24 24"><path d="M14.046 2.242l-4.148-.01a8 8 0 0 0-7.893 6.945c-.477 3.39 1.135 6.643 4.025 8.244l-.79 3.16a1 1 0 0 0 1.25 1.214l4.475-1.492a8 8 0 0 0 3.08.618l4.148.01a8 8 0 0 0 8-8 8 8 0 0 0-8-8.689zm-.148 14.689l-3.32-.008a6 6 0 0 1-2.31-.464l-2.73.91.48-1.921a6 6 0 0 1-3.08-4.998 6 6 0 0 1 5.92-5.21l3.32.008a6 6 0 1 1 0 11.683z"/></svg>
              <span class="action-count">${post.comments_count || 0}</span>
            </button>

            <button class="tweet-action-btn btn-action-repost" data-post-id="${post.id}" title="Republicar transmissão">
              <svg viewBox="0 0 24 24"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.9 2 2 2H12v2H7.5c-2.21 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H12V4h4.5c2.21 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.9-2-2-2z"/></svg>
              <span class="action-count">${post.reposts_count || 0}</span>
            </button>

            <button class="tweet-action-btn btn-action-like ${userLikedPostIds.has(post.id) ? 'liked' : ''}" data-post-id="${post.id}" title="Curtir" style="${userLikedPostIds.has(post.id) ? 'color: var(--accent-red);' : ''}">
              <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              <span class="action-count like-counter">${post.likes_count || 0}</span>
            </button>

            <button class="tweet-action-btn btn-action-share" data-post-id="${post.id}" title="Copiar link da transmissão">
              <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
            </button>
          </div>

          <!-- Gaveta Expansível de Comentários -->
          <div class="tweet-comments-drawer" id="comments-drawer-${post.id}" style="display: none;">
            <div class="comment-compose-inline">
              <input type="text" class="tarkov-input input-inline-comment" placeholder="Responda na frequência..." />
              <button class="tarkov-btn btn-amber btn-send-inline-comment" data-post-id="${post.id}">RESPONDER</button>
            </div>
            <div class="comments-list-stream" id="comments-stream-${post.id}">
              <!-- Renderizado dinamicamente -->
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  setupTweetCardInteractions();
}

function renderPostPhotoGrid(mediaUrls, postId) {
  if (!mediaUrls || !Array.isArray(mediaUrls) || mediaUrls.length === 0) return '';
  const count = mediaUrls.length;

  let gridClass = `photo-grid-${Math.min(count, 4)}`;

  const photosHtml = mediaUrls.map((url, idx) => `
    <div class="photo-cell" data-post-id="${postId}" data-photo-idx="${idx}" style="background-image: url('${url}');">
      <img src="${url}" alt="Mídia ${idx + 1}" loading="lazy" onerror="this.parentElement.style.display='none';" />
    </div>
  `).join('');

  return `
    <div class="timeline-photo-grid ${gridClass}">
      ${photosHtml}
    </div>
  `;
}

function renderYoutubeEmbed(youtubeId, postId) {
  if (!youtubeId) return '';
  return `
    <div class="timeline-youtube-wrapper" data-yt-id="${youtubeId}">
      <div class="youtube-player-container">
        <iframe 
          id="yt-player-${postId}"
          class="youtube-clean-iframe"
          src="https://www.youtube-nocookie.com/embed/${youtubeId}?enablejsapi=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&mute=1" 
          title="YouTube video player" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
        
        <div class="youtube-tactical-overlay">
          <div class="yt-play-icon-glow">▶</div>
          <span class="yt-hover-tip">Passe o mouse para reprodução automática</span>
        </div>

        <div class="youtube-audio-toggle" title="Alternar Áudio">
          🔊
        </div>
      </div>
    </div>
  `;
}

function setupTweetCardInteractions() {
  const container = document.getElementById('timeline-feed-stream');
  if (!container) return;

  // 1. Excluir Post
  container.querySelectorAll('.btn-delete-post').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const postId = btn.dataset.postId;
      if (!confirm('Deseja realmente excluir esta transmissão da Timeline?')) return;

      if (isConfigured) {
        try {
          await supabase.from('posts').delete().eq('id', postId);
        } catch(err) {
          console.warn('Erro ao deletar post do Supabase:', err);
        }
      }

      postsList = postsList.filter(p => p.id !== postId);
      localStorage.setItem('PZHUB_TIMELINE_POSTS', JSON.stringify(postsList));
      renderTimelineFeed();
      renderTrendingSidebar();
    };
  });

  // 2. Lightbox de Imagem
  container.querySelectorAll('.photo-cell').forEach(cell => {
    cell.onclick = () => {
      const postId = cell.dataset.postId;
      const photoIdx = parseInt(cell.dataset.photoIdx, 10);
      const post = postsList.find(p => p.id === postId);
      if (post && post.media_urls) {
        openLightbox(post.media_urls, photoIdx);
      }
    };
  });

  // 3. YouTube Hover Autoplay sem HUD
  container.querySelectorAll('.timeline-youtube-wrapper').forEach(wrapper => {
    const iframe = wrapper.querySelector('iframe');
    const overlay = wrapper.querySelector('.youtube-tactical-overlay');
    const audioBtn = wrapper.querySelector('.youtube-audio-toggle');
    let isMuted = true;

    wrapper.onmouseenter = () => {
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        if (overlay) overlay.style.opacity = '0';
      }
    };

    wrapper.onmouseleave = () => {
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        if (overlay) overlay.style.opacity = '1';
      }
    };

    if (audioBtn) {
      audioBtn.onclick = (e) => {
        e.stopPropagation();
        isMuted = !isMuted;
        if (iframe?.contentWindow) {
          const cmd = isMuted ? 'mute' : 'unMute';
          iframe.contentWindow.postMessage(`{"event":"command","func":"${cmd}","args":""}`, '*');
          audioBtn.textContent = isMuted ? '🔇' : '🔊';
        }
      };
    }
  });

  // 4. Curtir Post (Heart) com Toggle Atômico Anti-409
  container.querySelectorAll('.btn-action-like').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const postId = btn.dataset.postId;
      const post = postsList.find(p => p.id === postId);
      const currentUser = getCurrentUser();

      if (!currentUser) {
        showAuthLockModal();
        return;
      }

      if (!post) return;

      const counter = btn.querySelector('.like-counter');
      const isAlreadyLiked = userLikedPostIds.has(post.id) || btn.classList.contains('liked');

      if (isAlreadyLiked) {
        // Toggle OFF: Descurtir
        userLikedPostIds.delete(post.id);
        post.likes_count = Math.max(0, (post.likes_count || 1) - 1);
        btn.classList.remove('liked');
        btn.style.color = '';
        if (counter) counter.textContent = post.likes_count;

        if (isConfigured) {
          try {
            await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
          } catch(e) {
            console.warn('Erro ao descurtir post no Supabase:', e);
          }
        }
      } else {
        // Toggle ON: Curtir
        userLikedPostIds.add(post.id);
        post.likes_count = (post.likes_count || 0) + 1;
        btn.classList.add('liked');
        btn.style.color = 'var(--accent-red)';
        if (counter) counter.textContent = post.likes_count;

        if (isConfigured) {
          try {
            await supabase.from('post_likes').upsert([{ post_id: post.id, user_id: currentUser.id }], { onConflict: 'post_id,user_id' });
          } catch(e) {
            console.warn('Erro ao curtir post no Supabase:', e);
          }
        }
      }
    };
  });

  // 5. Comentários Expansíveis
  container.querySelectorAll('.btn-action-reply').forEach(btn => {
    btn.onclick = async () => {
      const postId = btn.dataset.postId;
      const drawer = document.getElementById(`comments-drawer-${postId}`);
      if (!drawer) return;

      const isOpening = drawer.style.display === 'none';
      drawer.style.display = isOpening ? 'block' : 'none';

      if (isOpening) {
        await loadPostComments(postId);
      }
    };
  });

  // 6. Envio de Comentário Inline (Sem ID manual para não quebrar UUID no Supabase)
  container.querySelectorAll('.btn-send-inline-comment').forEach(btn => {
    btn.onclick = async () => {
      const postId = btn.dataset.postId;
      const drawer = document.getElementById(`comments-drawer-${postId}`);
      const input = drawer?.querySelector('.input-inline-comment');
      const text = input?.value.trim();

      if (!text) return;

      const currentUser = getCurrentUser();
      const currentProfile = getCurrentUserProfile();

      if (!currentUser) {
        showAuthLockModal();
        return;
      }

      const commentPayload = {
        post_id: postId,
        author_id: currentUser.id,
        author_name: currentProfile?.display_name || currentProfile?.username || currentUser.user_metadata?.username || 'Sobrevivente',
        author_username: currentProfile?.username || currentUser.user_metadata?.username || 'operador',
        author_avatar: currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80',
        content: text
      };

      if (isConfigured) {
        try {
          const { error } = await supabase.from('post_comments').insert([commentPayload]);
          if (error) throw error;

          const post = postsList.find(p => p.id === postId);
          if (post) {
            post.comments_count = (post.comments_count || 0) + 1;
            const replyCounter = container.querySelector(`.btn-action-reply[data-post-id="${postId}"] .action-count`);
            if (replyCounter) replyCounter.textContent = post.comments_count;
          }
          showTacticalToast('Resposta transmitida com sucesso!', 'success');
        } catch(e) {
          console.warn('Erro ao enviar comentário do post no Supabase:', e);
          showTacticalToast('Falha ao registrar comentário na rede.', 'error');
        }
      }

      if (input) input.value = '';
      await loadPostComments(postId);
    };
  });

  // 7. Clique em Hashtag para Filtrar
  container.querySelectorAll('.timeline-hashtag').forEach(tagEl => {
    tagEl.onclick = (e) => {
      e.stopPropagation();
      activeSearchTag = tagEl.dataset.tag;
      renderTimelineFeed();
    };
  });

  // 8. Compartilhar / Copiar Link
  container.querySelectorAll('.btn-action-share').forEach(btn => {
    btn.onclick = () => {
      const postId = btn.dataset.postId;
      navigator.clipboard.writeText(`${window.location.origin}/#timeline?post=${postId}`);
      showTacticalToast('Link da transmissão copiado para a área de transferência!', 'success');
    };
  });
}

async function loadPostComments(postId) {
  const stream = document.getElementById(`comments-stream-${postId}`);
  if (!stream) return;

  let comments = [];

  if (isConfigured) {
    try {
      const { data } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (data) comments = data;
    } catch(e) {
      console.warn('Erro ao carregar comentários do post:', e);
    }
  }

  // Sincroniza dinamicamente o contador do botão com a quantidade real do banco
  const post = postsList.find(p => p.id === postId);
  if (post) post.comments_count = comments.length;
  const replyCounter = document.querySelector(`.btn-action-reply[data-post-id="${postId}"] .action-count`);
  if (replyCounter) replyCounter.textContent = comments.length;

  if (comments.length === 0) {
    stream.innerHTML = '<div style="font-size: 11px; color: var(--text-dim); padding: 8px;">Nenhuma resposta ainda. Seja o primeiro a responder.</div>';
    return;
  }

  stream.innerHTML = comments.map(c => `
    <div class="inline-comment-item">
      <img src="${c.author_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80'}" class="comment-avatar" alt="${c.author_username}" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80'" />
      <div class="comment-text-box">
        <div style="display: flex; gap: 6px; align-items: center;">
          <a href="#profile/${c.author_username}" style="color: var(--accent-amber); font-size: 11px; font-weight: bold; text-decoration: none;">@${c.author_username}</a>
          <span style="font-size: 10px; color: var(--text-dim);">${formatTimeAgo(new Date(c.created_at))}</span>
        </div>
        <p style="font-size: 12px; color: var(--text-main); margin-top: 2px;">${escapeHtml(c.content)}</p>
      </div>
    </div>
  `).join('');
}

function setupLightboxModal() {
  const modal = document.getElementById('timeline-lightbox-modal');
  const closeBtn = document.getElementById('lightbox-close-btn');
  const prevBtn = document.getElementById('lightbox-prev-btn');
  const nextBtn = document.getElementById('lightbox-next-btn');

  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.remove('visible');
  }

  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentLightboxImages.length > 0) {
        currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
        updateLightboxImage();
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentLightboxImages.length > 0) {
        currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
        updateLightboxImage();
      }
    };
  }
}

function openLightbox(images, initialIndex = 0) {
  const modal = document.getElementById('timeline-lightbox-modal');
  if (!modal || !images || images.length === 0) return;

  currentLightboxImages = images;
  currentLightboxIndex = initialIndex;
  updateLightboxImage();
  modal.classList.add('visible');
}

function updateLightboxImage() {
  const imgEl = document.getElementById('lightbox-main-img');
  const counterEl = document.getElementById('lightbox-counter');
  if (imgEl && currentLightboxImages[currentLightboxIndex]) {
    imgEl.src = currentLightboxImages[currentLightboxIndex];
  }
  if (counterEl) {
    counterEl.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
  }
}

export function renderTrendingSidebar() {
  const container = document.getElementById('timeline-trending-container');
  if (!container) return;

  // Extrai tags 100% reais dos posts existentes no banco
  const tagCounts = {};
  postsList.forEach(p => {
    (p.tags || []).forEach(t => {
      if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sortedTags.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); font-size: 11px; padding: 6px;">Nenhum tópico em alta no momento. Crie posts com #hashtags para indexar.</div>';
    return;
  }

  container.innerHTML = sortedTags.map(([tag, count]) => `
    <div class="trending-topic-item" data-tag="${tag}">
      <strong class="topic-tag">#${tag}</strong>
      <span class="topic-count">${count} transmissão(ões)</span>
    </div>
  `).join('');

  container.querySelectorAll('.trending-topic-item').forEach(item => {
    item.onclick = () => {
      activeSearchTag = item.dataset.tag;
      renderTimelineFeed();
    };
  });
}

export async function renderFollowSuggestionsSidebar() {
  const container = document.getElementById('timeline-suggestions-container');
  if (!container) return;

  let profiles = [];
  let followingIds = new Set();
  const currentUser = getCurrentUser();

  if (isConfigured) {
    try {
      let query = supabase.from('profiles').select('id, username, display_name, avatar_url, role').limit(5);
      if (currentUser?.id) {
        query = query.neq('id', currentUser.id);
      }
      const { data } = await query;
      if (data && Array.isArray(data)) profiles = data;

      // Buscar relações de follow reais do usuário logado
      if (currentUser?.id) {
        const { data: followRows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUser.id);
        if (followRows && Array.isArray(followRows)) {
          followingIds = new Set(followRows.map(r => r.following_id));
        }
      }
    } catch(e) {
      console.warn('Erro ao obter sugestões de operadores:', e);
    }
  }

  if (profiles.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); font-size: 11px; padding: 6px;">Nenhum outro operador registrado no momento.</div>';
    return;
  }

  container.innerHTML = profiles.map(p => {
    const isFollowing = followingIds.has(p.id);
    const followingClass = isFollowing ? ' following' : '';
    const btnText = isFollowing ? '✓ SEGUINDO' : '+ SEGUIR';
    const inlineStyle = isFollowing 
      ? 'border-color: var(--accent-amber); color: var(--accent-amber); background: rgba(229, 142, 38, 0.12);' 
      : '';

    return `
    <div class="suggestion-operator-card">
      <div style="display: flex; gap: 10px; align-items: center;">
        <img src="${p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80'}" class="suggestion-avatar" alt="${p.username}" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80'" />
        <div style="display: flex; flex-direction: column;">
          <a href="#profile/${p.username}" class="suggestion-name">${p.display_name || p.username}</a>
          <span class="suggestion-handle">@${p.username}</span>
        </div>
      </div>
      <button class="tarkov-btn-mini btn-follow-suggestion${followingClass}" data-profile-id="${p.id}" style="${inlineStyle}">
        ${btnText}
      </button>
    </div>
  `;
  }).join('');

  container.querySelectorAll('.btn-follow-suggestion').forEach(btn => {
    btn.onclick = async () => {
      if (!currentUser) {
        showAuthLockModal();
        return;
      }
      const profileId = btn.dataset.profileId;
      const isCurrentlyFollowing = btn.classList.contains('following');
      const nextState = !isCurrentlyFollowing;

      // Atualização Otimista imediata na interface
      if (nextState) {
        btn.classList.add('following');
        btn.textContent = '✓ SEGUINDO';
        btn.style.borderColor = 'var(--accent-amber)';
        btn.style.color = 'var(--accent-amber)';
        btn.style.background = 'rgba(229, 142, 38, 0.12)';
      } else {
        btn.classList.remove('following');
        btn.textContent = '+ SEGUIR';
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.style.background = '';
      }

      if (isConfigured) {
        try {
          if (nextState) {
            await supabase.from('follows').upsert([{ 
              follower_id: currentUser.id, 
              following_id: profileId 
            }], { onConflict: 'follower_id,following_id' });
          } else {
            await supabase.from('follows').delete()
              .eq('follower_id', currentUser.id)
              .eq('following_id', profileId);
          }
        } catch(e) {
          console.error('Erro ao persistir alternância de follow no Supabase:', e);
        }
      }
    };
  });
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
