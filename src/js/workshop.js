/**
 * PZHub - Community Workshop Module (Popularity, Details, Comments, Changelogs)
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser, getCurrentUserProfile } from './auth.js';
import { fetchModpackChangelogs } from './changelogs.js';
import { i18n, PZ_CATEGORIES } from './i18n.js';
import { showTacticalAlert, showTacticalToast } from './tacticalModal.js';
import { parseMarkdown } from './modpackBuilder.js';

let modpacksList = [];
let userLikedModpackIds = new Set();
let activeCategory = 'all';
let searchQuery = '';
let currentSort = 'popular';
let activeModalModpack = null;
let activeModalTab = 'tab-ws-overview';

export async function initWorkshop() {
  const categoryBtns = document.querySelectorAll('.ws-category-btn');
  const searchInput = document.getElementById('ws-search-input');
  const sortSelect = document.getElementById('ws-sort-select');

  populateWebsiteCategoriesSelect();

  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category || 'all';
      const selectMore = document.getElementById('ws-more-categories-select');
      if (selectMore) selectMore.value = '';
      renderWorkshop();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderWorkshop();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderWorkshop();
    });
  }

  await loadWorkshopData();

  window.addEventListener('pzhub:auth-changed', async () => {
    await loadWorkshopData();
  });
}

export function populateWebsiteCategoriesSelect() {
  const select = document.getElementById('ws-more-categories-select');
  if (!select) return;

  select.innerHTML = `<option value="">+ ${i18n.t('ws_category_all', 'MAIS CATEGORIAS')}...</option>`;

  const groups = {
    elements: i18n.currentLang === 'pt' ? 'Mecânicas & Itens' : (i18n.currentLang === 'es' ? 'Mecánicas e Ítems' : 'Mechanics & Items'),
    gameplay: i18n.currentLang === 'pt' ? 'Estilo & Gameplay' : (i18n.currentLang === 'es' ? 'Estilo y Gameplay' : 'Style & Gameplay'),
    technical: i18n.currentLang === 'pt' ? 'Técnica & Estrutura' : (i18n.currentLang === 'es' ? 'Técnica y Estructura' : 'Technical & Overhaul'),
    versions: i18n.currentLang === 'pt' ? 'Versões Zomboid' : (i18n.currentLang === 'es' ? 'Versiones Zomboid' : 'Game Versions')
  };

  const groupedMap = {};
  PZ_CATEGORIES.forEach(cat => {
    if (!groupedMap[cat.group]) groupedMap[cat.group] = [];
    groupedMap[cat.group].push(cat);
  });

  Object.keys(groupedMap).forEach(grpKey => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = groups[grpKey] || grpKey;
    groupedMap[grpKey].forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.label[i18n.currentLang] || cat.label.pt || cat.id;
      optgroup.appendChild(opt);
    });
    select.appendChild(optgroup);
  });

  select.onchange = (e) => {
    const val = e.target.value;
    if (val) {
      document.querySelectorAll('.ws-category-btn').forEach(b => b.classList.remove('active'));
      activeCategory = val;
      renderWorkshop();
    }
  };
}

export async function loadWorkshopData() {
  const currentUser = getCurrentUser();
  const userId = currentUser?.id || currentUser?.user_metadata?.sub || 'guest';

  // 1. Restaura imediatamente do cache local para resposta instantânea no F5
  const cachedLikes = localStorage.getItem(`PZHUB_USER_LIKED_MODPACKS_${userId}`);
  if (cachedLikes) {
    try {
      const arr = JSON.parse(cachedLikes);
      if (Array.isArray(arr)) userLikedModpackIds = new Set(arr);
    } catch (e) {}
  }

  // 2. Sincroniza curtidas do usuário no Supabase
  if (currentUser && isConfigured) {
    try {
      const { data: likesData } = await supabase
        .from('modpack_likes')
        .select('modpack_id')
        .eq('user_id', currentUser.id);
      if (likesData && Array.isArray(likesData)) {
        likesData.forEach(l => userLikedModpackIds.add(l.modpack_id));
        localStorage.setItem(`PZHUB_USER_LIKED_MODPACKS_${currentUser.id}`, JSON.stringify([...userLikedModpackIds]));
      }
    } catch (e) {
      console.warn('Erro ao carregar modpack_likes no Supabase:', e);
    }
  }

  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('modpacks')
        .select('*')
        .eq('is_public', true)
        .order('downloads_count', { ascending: false });

      if (!error && Array.isArray(data)) {
        modpacksList = data;

        // Agrega contadores reais das tabelas secundárias para contornar qualquer delay ou falta de triggers
        try {
          const { data: allLikes } = await supabase.from('modpack_likes').select('modpack_id');
          const { data: allComments } = await supabase.from('comments').select('target_id');

          const likesCountMap = {};
          (allLikes || []).forEach(l => {
            likesCountMap[l.modpack_id] = (likesCountMap[l.modpack_id] || 0) + 1;
          });

          const commentsCountMap = {};
          (allComments || []).forEach(c => {
            commentsCountMap[c.target_id] = (commentsCountMap[c.target_id] || 0) + 1;
          });

          modpacksList.forEach(pack => {
            const trueLikes = likesCountMap[pack.id] || (pack.slug && likesCountMap[pack.slug]) || 0;
            const trueComments = commentsCountMap[pack.id] || (pack.slug && commentsCountMap[pack.slug]) || 0;
            pack.likes_count = Math.max(pack.likes_count || 0, trueLikes);
            pack.comments_count = Math.max(pack.comments_count || 0, trueComments);
          });
        } catch (aggErr) {
          console.warn('Aviso: agregação de likes/comentários dos modpacks:', aggErr);
        }

        saveModpacksLocally();
        renderWorkshop();
        updateDashboardView();
        return;
      }
    } catch (err) {
      console.warn('Erro ao carregar catálogo do Supabase:', err);
    }
  }

  // Fallback Local
  const saved = localStorage.getItem('PZHUB_COMMUNITY_MODPACKS');
  if (saved) {
    try { 
      modpacksList = JSON.parse(saved); 
    } catch (e) { 
      modpacksList = []; 
    }
  } else {
    modpacksList = [];
  }

  renderWorkshop();
  updateDashboardView();
}

export function getAllModpacks() {
  return modpacksList;
}

export function renderWorkshop() {
  const container = document.getElementById('workshop-feed-container');
  const totalCountEl = document.getElementById('workshop-total-count');
  if (!container) return;

  let filtered = modpacksList.filter(pack => {
    if (activeCategory !== 'all' && (pack.category || '').toLowerCase() !== activeCategory.toLowerCase()) {
      return false;
    }
    if (searchQuery) {
      const matchName = (pack.name || '').toLowerCase().includes(searchQuery);
      const matchDesc = (pack.description || '').toLowerCase().includes(searchQuery);
      const matchAuthor = (pack.author_name || pack.author || '').toLowerCase().includes(searchQuery);
      return matchName || matchDesc || matchAuthor;
    }
    return true;
  });

  // Ordenação por Popularidade
  filtered.sort((a, b) => {
    if (currentSort === 'popular') {
      const scoreA = (a.downloads_count || 0) * 2 + (a.likes_count || 0) * 5;
      const scoreB = (b.downloads_count || 0) * 2 + (b.likes_count || 0) * 5;
      return scoreB - scoreA;
    } else if (currentSort === 'likes') {
      return (b.likes_count || 0) - (a.likes_count || 0);
    } else if (currentSort === 'downloads') {
      return (b.downloads_count || 0) - (a.downloads_count || 0);
    } else if (currentSort === 'recent') {
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    }
    return 0;
  });

  if (totalCountEl) totalCountEl.textContent = `${filtered.length} MODPACKS ENCONTRADOS`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="tarkov-empty-state" style="grid-column: 1 / -1; padding: 48px 20px; background: var(--bg-surface-card); border: 1px dashed var(--panel-border); border-radius: var(--radius-md);">
        <div class="tarkov-empty-title" style="color: var(--accent-amber); font-size: 14px;">NENHUM MODPACK REGISTRADO NO BANCO DE DADOS</div>
        <div class="tarkov-empty-desc" style="margin: 10px 0 18px;">${isConfigured ? 'A tabela de modpacks do seu Supabase está vazia no momento. Publique seu primeiro modpack no Estúdio do Criador ou execute o script de Seed.' : 'O sistema não encontrou modpacks cadastrados. Conecte sua instância Supabase ou crie um modpack no Estúdio.'}</div>
        <a href="#studio" class="tarkov-btn btn-amber">+ CRIAR PRIMEIRO MODPACK</a>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(pack => {
    const totalMods = pack.mods?.length || 0;
    const bannerImg = pack.image || pack.banner_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80';

    return `
      <div class="workshop-card" data-pack-id="${pack.id}">
        <div class="ws-card-banner">
          <img src="${bannerImg}" class="ws-banner-img" alt="${pack.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80'" />
          <div class="ws-banner-overlay"></div>
          <div class="ws-badge-strip">
            <span class="tarkov-tag badge-amber">BUILD ${pack.zomboid_version || '42.0+'}</span>
            <span class="tarkov-tag badge-cyan">${pack.category || 'Militar'}</span>
            <span class="tarkov-tag badge-version">v${pack.version || '1.0.0'}</span>
          </div>
          <h3 class="ws-card-title">${pack.name}</h3>
        </div>

        <div class="ws-card-body">
          <div class="ws-meta-row">
            <span>OPERADOR: <a href="#profile/${pack.author || 'operador'}" class="author-link">@${pack.author_name || pack.author || 'PZHub'}</a></span>
            <span><strong>${totalMods}</strong> MODS INCLUSOS</span>
          </div>

          <p class="ws-card-desc">${pack.description || 'Sem descrição informada.'}</p>

          <div class="ws-stats-row">
            <button class="btn-like-modpack ws-stat-btn ${userLikedModpackIds.has(pack.id) ? 'liked' : ''}" data-pack-id="${pack.id}" title="Curtir modpack" style="${userLikedModpackIds.has(pack.id) ? 'color: var(--accent-red);' : ''}">
              ❤️ <strong class="like-count">${pack.likes_count || 0}</strong>
            </button>
          </div>
        </div>

        <div class="ws-card-actions">
          <button class="tarkov-btn btn-amber btn-open-modpack-details" data-pack-id="${pack.id}" style="flex: 1;">
            <span>VER DETALHES & CHANGELOG</span>
          </button>
          <button class="tarkov-btn-icon btn-quick-sync" data-pack-id="${pack.id}" title="Copiar manifesto para o PZHub Desktop">
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners nos cards
  container.querySelectorAll('.btn-open-modpack-details').forEach(btn => {
    btn.addEventListener('click', () => {
      const packId = btn.dataset.packId;
      const pack = modpacksList.find(p => p.id === packId);
      if (pack) openModpackDetailsModal(pack);
    });
  });

  container.querySelectorAll('.btn-like-modpack').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const currentUser = getCurrentUser();
      if (!currentUser) {
        showTacticalAlert('Você precisa entrar na sua conta para curtir modpacks da comunidade.', 'ACESSO RESTRITO', 'warning');
        return;
      }

      const packId = btn.dataset.packId;
      const pack = modpacksList.find(p => p.id === packId);
      if (!pack) return;

      const countEl = btn.querySelector('.like-count');
      const isAlreadyLiked = userLikedModpackIds.has(pack.id) || btn.classList.contains('liked');

      if (isAlreadyLiked) {
        // Toggle OFF: Descurtir
        userLikedModpackIds.delete(pack.id);
        pack.likes_count = Math.max(0, (pack.likes_count || 1) - 1);
        btn.classList.remove('liked');
        btn.style.color = '';
        if (countEl) countEl.textContent = pack.likes_count;
        localStorage.setItem(`PZHUB_USER_LIKED_MODPACKS_${currentUser.id}`, JSON.stringify([...userLikedModpackIds]));
        saveModpacksLocally();

        if (isConfigured) {
          try {
            await supabase.from('modpack_likes').delete().eq('modpack_id', pack.id).eq('user_id', currentUser.id);
          } catch (err) {
            console.warn('Erro ao remover curtida no Supabase:', err);
          }
        }
      } else {
        // Toggle ON: Curtir
        userLikedModpackIds.add(pack.id);
        pack.likes_count = (pack.likes_count || 0) + 1;
        btn.classList.add('liked');
        btn.style.color = 'var(--accent-red)';
        if (countEl) countEl.textContent = pack.likes_count;
        localStorage.setItem(`PZHUB_USER_LIKED_MODPACKS_${currentUser.id}`, JSON.stringify([...userLikedModpackIds]));
        saveModpacksLocally();

        if (isConfigured) {
          try {
            await supabase.from('modpack_likes').upsert([{ modpack_id: pack.id, user_id: currentUser.id }], { onConflict: 'modpack_id,user_id' });
          } catch (err) {
            console.warn('Erro ao gravar curtida no Supabase:', err);
          }
        }
      }
    });
  });

  container.querySelectorAll('.btn-quick-sync').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const packId = btn.dataset.packId;
      const pack = modpacksList.find(p => p.id === packId);
      if (pack) {
        navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
        showTacticalToast(`Manifesto "${pack.name}" copiado para a área de transferência!`, 'success');
      }
    });
  });
}

/**
 * Modal Detalhado com 4 Abas: Visão Geral, Changelog, Comentários e Créditos
 */
export async function openModpackDetailsModal(pack) {
  activeModalModpack = pack;
  activeModalTab = 'tab-ws-overview';

  const modal = document.getElementById('modpack-details-modal');
  if (!modal) return;

  // Busca changelogs tanto por slug quanto por ID
  const changelogs = await fetchModpackChangelogs(pack.slug || pack.id);

  // Carregar comentários reais da nuvem Supabase
  if (isConfigured) {
    try {
      const { data: dbComments, error: comErr } = await supabase
        .from('comments')
        .select('*')
        .or(`target_id.eq.${pack.id},target_id.eq.${pack.slug || pack.id}`)
        .order('created_at', { ascending: false });
      if (!comErr && Array.isArray(dbComments)) {
        pack.comments = dbComments;
      }
    } catch(e) {
      console.warn('Erro ao carregar comentários do modpack no Supabase:', e);
    }
  }

  const titleEl = document.getElementById('md-modal-title');
  const authorEl = document.getElementById('md-modal-author');
  const likesEl = document.getElementById('md-modal-likes');
  const bannerEl = document.getElementById('md-modal-banner');

  if (titleEl) titleEl.textContent = pack.name;
  if (authorEl) {
    authorEl.innerHTML = `Criado por <a href="#profile/${pack.author || 'operador'}" style="color: var(--accent-amber); font-weight: bold; text-decoration: none;">@${pack.author_name || pack.author || 'PZHub'}</a>`;
  }

  // Like interativo dentro do cabeçalho do Modal sincronizado com Supabase
  if (likesEl) {
    const isLiked = userLikedModpackIds.has(pack.id);
    likesEl.style.cursor = 'pointer';
    likesEl.style.userSelect = 'none';
    likesEl.innerHTML = `<button class="tarkov-btn-mini btn-modal-like ${isLiked ? 'liked' : ''}" style="color: ${isLiked ? 'var(--accent-red)' : 'var(--text-dim)'}; border-color: ${isLiked ? 'rgba(235, 77, 75, 0.4)' : 'var(--panel-border)'};">❤️ <span class="like-counter">${pack.likes_count || 0}</span> Likes</button>`;
    
    likesEl.onclick = async (e) => {
      e.stopPropagation();
      const currentUser = getCurrentUser();
      if (!currentUser) {
        openAuthModal();
        return;
      }
      
      const btn = likesEl.querySelector('.btn-modal-like');
      const counter = likesEl.querySelector('.like-counter');
      const currentlyLiked = userLikedModpackIds.has(pack.id);

      if (currentlyLiked) {
        userLikedModpackIds.delete(pack.id);
        pack.likes_count = Math.max(0, (pack.likes_count || 1) - 1);
        btn?.classList.remove('liked');
        if (btn) btn.style.color = 'var(--text-dim)';
        if (counter) counter.textContent = pack.likes_count;
        if (isConfigured) {
          try {
            await supabase.from('modpack_likes').delete().eq('modpack_id', pack.id).eq('user_id', currentUser.id);
          } catch(err) {
            console.warn('Erro ao remover curtida no Supabase:', err);
          }
        }
      } else {
        userLikedModpackIds.add(pack.id);
        pack.likes_count = (pack.likes_count || 0) + 1;
        btn?.classList.add('liked');
        if (btn) btn.style.color = 'var(--accent-red)';
        if (counter) counter.textContent = pack.likes_count;
        if (isConfigured) {
          try {
            await supabase.from('modpack_likes').upsert([{ modpack_id: pack.id, user_id: currentUser.id }], { onConflict: 'modpack_id,user_id' });
          } catch (err) {
            console.warn('Erro ao gravar curtida no Supabase:', err);
          }
        }
      }
      localStorage.setItem(`PZHUB_USER_LIKED_MODPACKS_${currentUser.id}`, JSON.stringify([...userLikedModpackIds]));
      saveModpacksLocally();
      renderWorkshopFeed(); // Sincroniza os cards de fundo
    };
  }

  if (bannerEl) {
    bannerEl.src = pack.image || pack.banner_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80';
    bannerEl.onerror = () => {
      bannerEl.src = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80';
    };
  }

  // Render da aba ativa inicial
  renderModalTabContent(pack, changelogs);
  modal.classList.add('visible');

  // Fechamento
  const closeBtn = document.getElementById('md-modal-close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('visible');
  }

  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  };

  // Alternador de Abas corrigido com data-tab e id
  document.querySelectorAll('.md-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.md-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeModalTab = btn.dataset.tab || btn.id;
      renderModalTabContent(pack, changelogs);
    };
  });
}

function renderModalTabContent(pack, changelogs) {
  // Captura garantida do container (suporta md-modal-tab-content e md-modal-body-content)
  const bodyEl = document.getElementById('md-modal-tab-content') || document.getElementById('md-modal-body-content');
  if (!bodyEl) return;

  if (activeModalTab === 'tab-ws-overview') {
    const rawDesc = pack.detailed_description || pack.description || 'Nenhuma descrição estendida informada pelo autor.';
    bodyEl.innerHTML = `
      <div class="md-rendered-content" style="font-size: 13px; color: var(--text-main); line-height: 1.7; word-break: break-word;">
        ${parseMarkdown(rawDesc)}
      </div>
    `;
  } else if (activeModalTab === 'tab-ws-changelogs' || activeModalTab === 'tab-ws-changelog') {
    bodyEl.innerHTML = `
      <div class="md-changelogs-pane">
        <div class="changelog-timeline-stream" style="display: flex; flex-direction: column; gap: 16px;">
          ${!changelogs || changelogs.length === 0 ? `
            <div style="color: var(--text-dim); font-size: 11px; padding: 24px; text-align: center; border: 1px dashed var(--panel-border); border-radius: 4px;">
              ⚠️ Nenhum registro de changelog anterior documentado para este modpack.
            </div>
          ` : changelogs.map(ch => `
            <div class="changelog-entry" style="background: rgba(0,0,0,0.3); border-left: 3px solid var(--accent-amber); padding: 14px; border-radius: 4px;">
              <div class="ch-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="tarkov-tag badge-version">v${ch.version}</span>
                  <strong class="ch-title" style="color: #fff; font-size: 13px;">${ch.title}</strong>
                </div>
                <span class="ch-date" style="font-family: var(--font-mono); font-size: 10px; color: var(--text-dim);">${new Date(ch.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <div class="ch-notes" style="font-size: 12px; color: var(--text-muted); line-height: 1.6; word-break: break-word;">
                ${parseMarkdown(ch.notes)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (activeModalTab === 'tab-ws-comments') {
    const comments = pack.comments || [];
    bodyEl.innerHTML = `
      <div class="md-comments-pane">
        <div class="comment-compose-box" style="display: flex; gap: 10px; margin-bottom: 20px;">
          <input type="text" id="input-new-comment" class="tarkov-input" placeholder="Escreva uma mensagem sobre este modpack..." style="flex: 1;" />
          <button id="btn-submit-comment" class="tarkov-btn btn-amber">POSTAR</button>
        </div>

        <div class="comments-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${comments.length === 0 ? `
            <div style="color: var(--text-dim); font-size: 11px; padding: 24px; text-align: center; border: 1px dashed var(--panel-border); border-radius: 4px;">
              💬 Nenhum comentário publicado ainda. Seja o primeiro a comentar!
            </div>
          ` : comments.map(c => `
            <div class="comment-card" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 12px; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <img src="${c.author_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=32&q=80'}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover;" />
                  <strong style="color: var(--accent-amber); font-size: 12px;">${c.author_name}</strong>
                </div>
                <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-dim);">${new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <p style="font-size: 12px; color: var(--text-main); line-height: 1.5; margin: 0; word-break: break-word;">${c.content}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const submitCommentBtn = document.getElementById('btn-submit-comment');
    const commentInput = document.getElementById('input-new-comment');
    if (submitCommentBtn && commentInput) {
      submitCommentBtn.onclick = async () => {
        const text = commentInput.value.trim();
        if (!text) return;
        const currentUser = getCurrentUser();
        const currentProfile = getCurrentUserProfile();

        if (!currentUser) {
          showTacticalAlert('Você precisa entrar na sua conta para comentar neste modpack.', 'ACESSO RESTRITO', 'warning');
          return;
        }

        const authorName = currentProfile?.display_name || currentProfile?.username || currentUser?.user_metadata?.username || 'Sobrevivente';
        const authorAvatar = currentProfile?.avatar_url || currentUser?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=128&q=80';

        const commentPayload = {
          target_id: pack.id,
          author_id: currentUser.id,
          author_name: authorName,
          author_avatar: authorAvatar,
          content: text
        };

        if (isConfigured) {
          try {
            const { data, error } = await supabase.from('comments').insert([commentPayload]).select();
            if (error) throw error;
            if (data && data[0]) {
              pack.comments = pack.comments || [];
              pack.comments.unshift(data[0]);
            }
            showTacticalToast('Comentário registrado com sucesso!', 'success');
          } catch(err) {
            console.warn('Erro ao salvar comentário no Supabase:', err);
            showTacticalToast('Erro ao gravar comentário na rede.', 'error');
          }
        } else {
          pack.comments = pack.comments || [];
          pack.comments.unshift({
            ...commentPayload,
            id: `c-${Date.now()}`,
            created_at: new Date().toISOString()
          });
          showTacticalToast('Comentário salvo localmente!', 'success');
        }

        pack.comments_count = (pack.comments_count || 0) + 1;
        saveModpacksLocally();
        commentInput.value = '';
        renderModalTabContent(pack, changelogs);
        renderWorkshopFeed();
      };
    }
  } else if (activeModalTab === 'tab-ws-credits') {
    bodyEl.innerHTML = `
      <div class="md-credits-pane" style="font-size: 12px; color: var(--text-muted); line-height: 1.8;">
        <p>Desenvolvido e mantido por <strong>${pack.author_name || pack.author}</strong> com apoio da comunidade Project Zomboid.</p>
        <p>Compatível nativamente com o ecossistema <strong>PZHub Desktop</strong> e servidores dedicados Build 42.</p>
        <div style="margin-top: 20px;">
          <button id="btn-report-pack" class="tarkov-btn" style="color: var(--accent-red); border-color: rgba(214, 48, 49, 0.4);">
            🚩 DENUNCIAR ESTE MODPACK PARA A STAFF
          </button>
        </div>
      </div>
    `;

    const reportBtn = document.getElementById('btn-report-pack');
    if (reportBtn) {
      reportBtn.onclick = async () => {
        const reason = prompt(`Por que você deseja denunciar o modpack "${pack.name}"?`);
        if (reason && reason.trim()) {
          const currentUser = getCurrentUser();
          const currentProfile = getCurrentUserProfile();

          if (isConfigured) {
            try {
              const reporterId = currentUser ? currentUser.id : null;
              const reporterName = currentProfile?.username || currentUser?.user_metadata?.username || 'Anônimo';

              const { error } = await supabase.from('reports').insert([{
                target_type: 'modpack',
                target_id: pack.id,
                target_title: pack.name,
                reporter_id: reporterId,
                reporter_name: reporterName,
                reason: reason.trim(),
                status: 'open'
              }]);
              if (error) throw error;
              showTacticalAlert('Denúncia encaminhada com sucesso para a moderação da Staff.', 'DENÚNCIA REGISTRADA', 'success');
            } catch(e) {
              console.warn('Erro ao registrar denúncia no Supabase:', e);
              showTacticalToast('Erro ao registrar denúncia no servidor.', 'error');
            }
          } else {
            showTacticalAlert('Denúncia simulada gravada com sucesso.', 'DENÚNCIA REGISTRADA', 'success');
          }
        }
      };
    }
  }
}

function updateDashboardView() {
  const container = document.getElementById('view-dashboard');
  if (!container) return;

  window.modpacksList = modpacksList;
  window.renderWorkshopFeed = renderWorkshop;

  const totalModpacks = modpacksList.length;
  let totalMods = 0;
  let totalModpackDownloads = 0;
  let totalLikes = 0;

  modpacksList.forEach(p => {
    totalMods += (p.mods?.length || 0);
    totalModpackDownloads += (p.downloads_count || 0);
    totalLikes += (p.likes_count || 0);
  });

  const statBoxes = container.querySelectorAll('.dashboard-stats-grid .profile-stat-box .stat-value');
  if (statBoxes && statBoxes.length >= 5) {
    statBoxes[0].textContent = totalModpacks;
    statBoxes[1].textContent = `${totalMods} mods`;
    // statBoxes[2] é o stat-software-downloads (atualizado via admin.js)
    statBoxes[3].textContent = totalModpackDownloads.toLocaleString('pt-BR');
    statBoxes[4].textContent = `❤️ ${totalLikes.toLocaleString('pt-BR')}`;
  } else if (statBoxes && statBoxes.length >= 4) {
    statBoxes[0].textContent = totalModpacks;
    statBoxes[1].textContent = `${totalMods} mods`;
    statBoxes[2].textContent = totalModpackDownloads.toLocaleString('pt-BR');
    statBoxes[3].textContent = `❤️ ${totalLikes.toLocaleString('pt-BR')}`;
  }

  const modpackDownloadsEl = document.getElementById('stat-modpack-downloads');
  if (modpackDownloadsEl) {
    modpackDownloadsEl.textContent = totalModpackDownloads.toLocaleString('pt-BR');
  }

  const tbody = container.querySelector('.tarkov-table tbody');
  if (tbody) {
    if (modpacksList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 30px;">Nenhum modpack registrado no banco de dados.</td></tr>';
      return;
    }

    tbody.innerHTML = modpacksList.map(pack => `
      <tr>
        <td><strong>${pack.name}</strong></td>
        <td><a href="#profile/${pack.author || 'operador'}" style="color: var(--accent-amber); text-decoration: none; font-weight: bold;">@${pack.author_name || pack.author || 'PZHub'}</a></td>
        <td><span class="tarkov-tag badge-amber">B${pack.zomboid_version || '42.0+'}</span></td>
        <td>${pack.category || 'Militar'}</td>
        <td>${pack.mods?.length || 0} mods</td>
        <td>${(pack.downloads_count || 0).toLocaleString('pt-BR')}</td>
        <td>❤️ ${pack.likes_count || 0}</td>
        <td>
          <button class="tarkov-btn-mini btn-open-dash-pack" data-pack-id="${pack.id}">DETALHES</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-open-dash-pack').forEach(btn => {
      btn.onclick = () => {
        const p = modpacksList.find(x => x.id === btn.dataset.packId);
        if (p) openModpackDetailsModal(p);
      };
    });
  }
}

function saveModpacksLocally() {
  localStorage.setItem('PZHUB_COMMUNITY_MODPACKS', JSON.stringify(modpacksList));
  updateDashboardView();
}

export function updateModpackInList(packId, updatedFields) {
  const pack = modpacksList.find(p => p.id === packId || p.slug === packId);
  if (pack) {
    Object.assign(pack, updatedFields);
    saveModpacksLocally();
    renderWorkshop();
  }
}
