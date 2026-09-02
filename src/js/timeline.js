/**
 * PZHub - Tactical Radar Social & Timeline Module (X / Twitter Style)
 * Timeline completa com posts, grid de fotos estilo Instagram (1 a 4 imagens),
 * embeds de vídeo do YouTube sem HUD e com autoplay no hover, comentários expansíveis,
 * feed "Para Você" vs "Seguindo", e sincronização total de curtidas e follows.
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser, getCurrentUserProfile } from './auth.js';
import { openImageCropperModal } from './imageCropper.js';

let postsList = [];
let activeFeedTab = 'discovery'; // 'discovery' | 'following'
let attachedMediaList = []; // Array de base64/URLs (máximo 4)
let attachedYoutubeId = null;
let activeSearchTag = '';
let currentLightboxImages = [];
let currentLightboxIndex = 0;

// Posts demonstrativos padrão para fallback offline imediato
const DEFAULT_TIMELINE_POSTS = [
  {
    id: "post-seed-1",
    author_name: "VICCS Tactical Command",
    author_username: "viccs",
    author_avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80",
    author_role: "admin",
    content: "🚨 ATENÇÃO SOBREVIVENTES DE KNOX COUNTY! O modpack militar oficial B42 foi atualizado para v1.4.0 com suporte nativo ao Live Radar do PZHub Desktop e novos blindados pesados dos anos 90. #Build42 #VICCSTactical #KnoxCounty",
    media_urls: [
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519074069444-1ba4ea16e6f4?auto=format&fit=crop&w=1200&q=80"
    ],
    youtube_id: "dQw4w9WgXcQ",
    likes_count: 42,
    reposts_count: 12,
    comments_count: 5,
    tags: ["Build42", "VICCSTactical", "KnoxCounty"],
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString()
  },
  {
    id: "post-seed-2",
    author_name: "Capitão Miller [VICCS]",
    author_username: "miller_sniper",
    author_avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=256&q=80",
    author_role: "creator",
    content: "Acabamos de fortificar o armazém industrial ao norte de Muldraugh! Mais de 40 caixotes de suprimentos e rota de fuga limpa pela ferrovia. Quem precisar de munição cal. 12 pode sintonizar na freq 92.4 MHz. #BaseBuilding #Muldraugh #Survival",
    media_urls: [
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519074069444-1ba4ea16e6f4?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80"
    ],
    youtube_id: null,
    likes_count: 88,
    reposts_count: 19,
    comments_count: 14,
    tags: ["BaseBuilding", "Muldraugh", "Survival"],
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString()
  }
];

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

  // 2. Anexo de Mídia (Imagens)
  if (addMediaBtn && mediaFileInput) {
    addMediaBtn.addEventListener('click', () => {
      if (attachedMediaList.length >= 4) {
        alert('Você pode anexar no máximo 4 imagens por postagem.');
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
        alert('URL do YouTube inválida. Insira um link como https://youtu.be/... ou https://youtube.com/watch?v=...');
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

  // 6. Configurar Lightbox Modal de Imagem em Tela Cheia
  setupLightboxModal();

  // Carrega posts do Supabase
  await loadTimelinePosts();
  renderTrendingSidebar();
  renderFollowSuggestionsSidebar();
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
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        postsList = data;
        renderTimelineFeed();
        return;
      }
    } catch (e) {
      console.warn('Erro ao ler posts da Timeline no Supabase:', e);
    }
  }

  // Fallback Local
  const saved = localStorage.getItem('PZHUB_TIMELINE_POSTS');
  if (saved) {
    try {
      postsList = JSON.parse(saved);
    } catch(e) {
      postsList = DEFAULT_TIMELINE_POSTS;
    }
  } else {
    postsList = DEFAULT_TIMELINE_POSTS;
  }

  renderTimelineFeed();
}

async function handlePublishTimelinePost() {
  const textarea = document.getElementById('timeline-compose-textarea');
  const content = textarea?.value.trim();

  if (!content && attachedMediaList.length === 0 && !attachedYoutubeId) {
    alert('Escreva uma mensagem ou anexe uma foto/vídeo antes de publicar.');
    return;
  }

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();

  if (!currentUser) {
    alert('Você precisa estar autenticado para publicar no Radar Social.');
    document.getElementById('auth-modal')?.classList.add('visible');
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
  document.getElementById('timeline-char-counter').textContent = '280';

  renderTimelineFeed();
  renderTrendingSidebar();
}

export function renderTimelineFeed() {
  const container = document.getElementById('timeline-feed-stream');
  if (!container) return;

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();

  let filtered = [...postsList];

  // Filtro por Tag Ativa se o usuário clicou num Trending Topic
  if (activeSearchTag) {
    filtered = filtered.filter(p => (p.tags || []).some(t => t.toLowerCase() === activeSearchTag.toLowerCase()) || p.content.toLowerCase().includes(`#${activeSearchTag.toLowerCase()}`));
  }

  // Filtro da Aba "Seguindo"
  if (activeFeedTab === 'following') {
    if (!currentUser) {
      container.innerHTML = `
        <div class="tarkov-empty-state" style="padding: 40px; background: rgba(0,0,0,0.4); border: 1px solid var(--panel-border); border-radius: 4px;">
          <div class="tarkov-empty-title" style="color: var(--accent-amber);">CONEXÃO NECESSÁRIA</div>
          <div class="tarkov-empty-desc">Faça login para visualizar apenas as transmissões dos sobreviventes que você segue.</div>
          <button id="btn-login-following-feed" class="tarkov-btn btn-amber" style="margin-top: 12px;">ENTRAR NA FREQUÊNCIA</button>
        </div>
      `;
      document.getElementById('btn-login-following-feed')?.addEventListener('click', () => {
        document.getElementById('auth-modal')?.classList.add('visible');
      });
      return;
    }
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="tarkov-empty-state" style="padding: 50px 20px; background: rgba(0,0,0,0.4); border: 1px dashed var(--panel-border); border-radius: 4px;">
        <div class="tarkov-empty-title" style="color: var(--text-muted);">NENHUMA TRANSMISSÃO ENCONTRADA</div>
        <div class="tarkov-empty-desc">Seja o primeiro operador a publicar uma mensagem ou imagem neste canal de rádio.</div>
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

    // Formatação de Texto com Hashtags e Menções destacadas
    const formattedContent = escapeHtml(post.content)
      .replace(/#(\w+)/g, '<span class="timeline-hashtag" data-tag="$1">#$1</span>')
      .replace(/@(\w+)/g, '<a href="#profile/$1" class="timeline-mention">@$1</a>');

    // Renderização do Grid de Mídia (1 a 4 fotos)
    const photoGridHtml = renderPostPhotoGrid(post.media_urls || [], post.id);

    // Renderização do Embed do YouTube (Clean, sem HUD, com Autoplay no Hover)
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
          </div>

          <!-- Conteúdo do Post -->
          <div class="tweet-content">
            <p class="tweet-text">${formattedContent}</p>
          </div>

          <!-- Grid de Fotos / Carrossel -->
          ${photoGridHtml}

          <!-- Player YouTube Tático (Sem HUD / Autoplay no Hover) -->
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

            <button class="tweet-action-btn btn-action-like" data-post-id="${post.id}" title="Curtir">
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
  if (!mediaUrls || mediaUrls.length === 0) return '';
  const count = mediaUrls.length;

  let gridClass = `photo-grid-${Math.min(count, 4)}`;

  const photosHtml = mediaUrls.map((url, idx) => `
    <div class="photo-cell" data-post-id="${postId}" data-photo-idx="${idx}" style="background-image: url('${url}');">
      <img src="${url}" alt="Mídia ${idx + 1}" loading="lazy" style="display: none;" />
    </div>
  `).join('');

  return `
    <div class="timeline-photo-grid ${gridClass}">
      ${photosHtml}
    </div>
  `;
}

function renderYoutubeEmbed(youtubeId, postId) {
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
          <span class="yt-hover-tip">Passe o mouse para reprodução automática sem HUD</span>
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

  // 1. Lightbox de Imagem
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

  // 2. YouTube Hover Autoplay sem HUD
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

  // 3. Curtir Post (Heart)
  container.querySelectorAll('.btn-action-like').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const postId = btn.dataset.postId;
      const post = postsList.find(p => p.id === postId);
      const currentUser = getCurrentUser();

      if (!currentUser) {
        alert('Faça login para curtir posts da Timeline.');
        document.getElementById('auth-modal')?.classList.add('visible');
        return;
      }

      if (post) {
        post.likes_count = (post.likes_count || 0) + 1;
        btn.classList.add('liked');
        const counter = btn.querySelector('.like-counter');
        if (counter) counter.textContent = post.likes_count;

        // Persistência no Supabase
        if (isConfigured) {
          try {
            await supabase.from('posts').update({ likes_count: post.likes_count }).eq('id', post.id);
            await supabase.from('post_likes').insert([{ post_id: post.id, user_id: currentUser.id }]);
          } catch(e) {}
        }
      }
    };
  });

  // 4. Comentários Expansíveis
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

  // 5. Envio de Comentário Inline
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
        alert('Faça login para comentar nesta transmissão.');
        document.getElementById('auth-modal')?.classList.add('visible');
        return;
      }

      const newComment = {
        id: `c-${Date.now()}`,
        post_id: postId,
        author_id: currentUser.id,
        author_name: currentProfile?.display_name || currentProfile?.username || currentUser.user_metadata?.username || 'Sobrevivente',
        author_username: currentProfile?.username || currentUser.user_metadata?.username || 'operador',
        author_avatar: currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80',
        content: text,
        created_at: new Date().toISOString()
      };

      if (isConfigured) {
        try {
          await supabase.from('post_comments').insert([newComment]);
          const post = postsList.find(p => p.id === postId);
          if (post) {
            post.comments_count = (post.comments_count || 0) + 1;
            await supabase.from('posts').update({ comments_count: post.comments_count }).eq('id', postId);
          }
        } catch(e) {}
      }

      if (input) input.value = '';
      await loadPostComments(postId);
    };
  });

  // 6. Clique em Hashtag para Filtrar
  container.querySelectorAll('.timeline-hashtag').forEach(tagEl => {
    tagEl.onclick = (e) => {
      e.stopPropagation();
      activeSearchTag = tagEl.dataset.tag;
      renderTimelineFeed();
    };
  });

  // 7. Compartilhar / Copiar Link
  container.querySelectorAll('.btn-action-share').forEach(btn => {
    btn.onclick = () => {
      const postId = btn.dataset.postId;
      navigator.clipboard.writeText(`${window.location.origin}/#timeline?post=${postId}`);
      alert('Link da transmissão copiado para a área de transferência!');
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
    } catch(e) {}
  }

  if (comments.length === 0) {
    stream.innerHTML = '<div style="font-size: 11px; color: var(--text-dim); padding: 8px;">Nenhuma resposta ainda. Seja o primeiro a responder.</div>';
    return;
  }

  stream.innerHTML = comments.map(c => `
    <div class="inline-comment-item">
      <img src="${c.author_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&q=80'}" class="comment-avatar" alt="${c.author_username}" />
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

  const topics = [
    { tag: "Build42", desc: "Atualização de física & iluminação", count: "1.4k transmissões" },
    { tag: "VICCSTactical", desc: "Blindados e equipamentos militares", count: "890 transmissões" },
    { tag: "KnoxCounty", desc: "Rotas seguras e bases comunitárias", count: "650 transmissões" },
    { tag: "MuldraughSafehouse", desc: "Pontos de encontro para esquadrões", count: "420 transmissões" },
    { tag: "LootWestPoint", desc: "Armazéns e lojas de armas", count: "310 transmissões" }
  ];

  container.innerHTML = topics.map(t => `
    <div class="trending-topic-item" data-tag="${t.tag}">
      <span class="topic-sub">${t.desc}</span>
      <strong class="topic-tag">#${t.tag}</strong>
      <span class="topic-count">${t.count}</span>
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
  if (isConfigured) {
    try {
      const { data } = await supabase.from('profiles').select('id, username, display_name, avatar_url, role').limit(4);
      if (data) profiles = data;
    } catch(e) {}
  }

  if (profiles.length === 0) {
    profiles = [
      { id: "viccs-official", username: "viccs", display_name: "VICCS Tactical Command", avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80", role: "admin" },
      { id: "miller-sniper", username: "miller_sniper", display_name: "Capitão Miller [VICCS]", avatar_url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=128&q=80", role: "creator" }
    ];
  }

  container.innerHTML = profiles.map(p => `
    <div class="suggestion-operator-card">
      <div style="display: flex; gap: 10px; align-items: center;">
        <img src="${p.avatar_url}" class="suggestion-avatar" alt="${p.username}" onerror="this.src='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80'" />
        <div style="display: flex; flex-direction: column;">
          <a href="#profile/${p.username}" class="suggestion-name">${p.display_name || p.username}</a>
          <span class="suggestion-handle">@${p.username}</span>
        </div>
      </div>
      <button class="tarkov-btn-mini btn-follow-suggestion" data-profile-id="${p.id}">+ SEGUIR</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-follow-suggestion').forEach(btn => {
    btn.onclick = () => {
      btn.textContent = '✓ SEGUINDO';
      btn.style.borderColor = 'var(--accent-emerald)';
      btn.style.color = 'var(--accent-emerald)';
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
