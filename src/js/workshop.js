/**
 * PZHub - Community Workshop Module (Popularity, Details, Comments, Changelogs)
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';
import { fetchModpackChangelogs } from './changelogs.js';

let modpacksList = [];
let activeCategory = 'all';
let searchQuery = '';
let currentSort = 'popular';
let activeModalModpack = null;
let activeModalTab = 'tab-ws-overview';

export async function initWorkshop() {
  const categoryBtns = document.querySelectorAll('.ws-category-btn');
  const searchInput = document.getElementById('ws-search-input');
  const sortSelect = document.getElementById('ws-sort-select');

  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category || 'all';
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
}

export async function loadWorkshopData() {
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('modpacks')
        .select('*')
        .eq('is_public', true)
        .order('downloads_count', { ascending: false });

      if (!error && Array.isArray(data)) {
        modpacksList = data;
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
    } catch(e) { 
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
            <span class="ws-stat">
              <svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
              <span>${pack.downloads_count || 0}</span>
            </span>
            <button class="btn-like-modpack ws-stat-btn" data-pack-id="${pack.id}" title="Curtir modpack">
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
      const packId = btn.dataset.packId;
      const pack = modpacksList.find(p => p.id === packId);
      if (pack) {
        pack.likes_count = (pack.likes_count || 0) + 1;
        const countEl = btn.querySelector('.like-count');
        if (countEl) countEl.textContent = pack.likes_count;
        btn.classList.add('liked');
        saveModpacksLocally();

        if (isConfigured) {
          try {
            await supabase.from('modpacks').update({ likes_count: pack.likes_count }).eq('id', pack.id);
          } catch(err) {
            console.warn('Erro ao atualizar curtida no Supabase:', err);
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
        alert(`Manifesto tático do pacote "${pack.name}" copiado para a área de transferência!`);
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

  const changelogs = await fetchModpackChangelogs(pack.slug || pack.id);

  const titleEl = document.getElementById('md-modal-title');
  const authorEl = document.getElementById('md-modal-author');
  const downloadsEl = document.getElementById('md-modal-downloads');
  const likesEl = document.getElementById('md-modal-likes');
  const bannerEl = document.getElementById('md-modal-banner');

  if (titleEl) titleEl.textContent = pack.name;
  if (authorEl) {
    authorEl.innerHTML = `Criado por <a href="#profile/${pack.author || 'operador'}" style="color: var(--accent-amber); font-weight: bold; text-decoration: none;">@${pack.author_name || pack.author || 'PZHub'}</a>`;
  }
  if (downloadsEl) downloadsEl.textContent = `🚀 ${pack.downloads_count || 0} Downloads`;
  if (likesEl) likesEl.textContent = `❤️ ${pack.likes_count || 0} Likes`;
  if (bannerEl) {
    bannerEl.src = pack.image || pack.banner_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80';
    bannerEl.onerror = () => {
      bannerEl.src = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80';
    };
  }

  renderModalTabContent(pack, changelogs);
  modal.classList.add('visible');

  // Modal close
  const closeBtn = document.getElementById('md-modal-close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => modal.classList.remove('visible');
  }

  // Click outside to close
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  };

  // Tab switching inside modal
  document.querySelectorAll('.md-tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.md-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeModalTab = btn.dataset.tab;
      renderModalTabContent(pack, changelogs);
    };
  });
}

function renderModalTabContent(pack, changelogs) {
  const bodyEl = document.getElementById('md-modal-tab-content');
  if (!bodyEl) return;

  if (activeModalTab === 'tab-ws-overview') {
    bodyEl.innerHTML = `
      <div class="md-overview-pane">
        <p class="md-desc-long">${pack.description || 'Sem descrição.'}</p>
        <h4 style="color: #fff; margin: 20px 0 10px 0; font-size: 13px; letter-spacing: 1px;">COMPONENTES & MODS INCLUSOS (${pack.mods?.length || 0}):</h4>
        <div class="md-mods-list">
          ${(pack.mods || []).map(m => `
            <div class="md-mod-item">
              <span class="mod-status-dot">✓</span>
              <div style="display: flex; flex-direction: column;">
                <strong style="color: var(--text-main); font-size: 12px;">${m.name}</strong>
                <span style="font-size: 10px; color: var(--text-dim); font-family: var(--font-mono);">${m.mod_type === 'workshop' ? `Steam Workshop ID: ${m.workshop_id || m.id}` : 'Módulo Nativo PZHub'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (activeModalTab === 'tab-ws-changelogs') {
    bodyEl.innerHTML = `
      <div class="md-changelogs-pane">
        <h4 style="color: var(--accent-amber); margin-bottom: 16px; font-size: 13px; letter-spacing: 1px;">HISTÓRICO OFICIAL DE VERSÕES</h4>
        <div class="changelogs-timeline">
          ${changelogs.length === 0 ? `
            <div style="color: var(--text-dim); font-size: 11px;">Nenhum changelog registrado para este modpack.</div>
          ` : changelogs.map(ch => `
            <div class="changelog-entry">
              <div class="ch-header">
                <span class="tarkov-tag badge-version">v${ch.version}</span>
                <strong class="ch-title">${ch.title}</strong>
                <span class="ch-date">${new Date(ch.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <div class="ch-notes" style="white-space: pre-line; font-size: 12px; color: var(--text-muted); line-height: 1.6; margin-top: 8px;">${ch.notes}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (activeModalTab === 'tab-ws-comments') {
    const comments = pack.comments || [];
    bodyEl.innerHTML = `
      <div class="md-comments-pane">
        <div class="comment-compose-box">
          <input type="text" id="input-new-comment" class="tarkov-input" placeholder="Escreva uma mensagem sobre este modpack..." />
          <button id="btn-submit-comment" class="tarkov-btn btn-amber">POSTAR</button>
        </div>

        <div class="comments-list" style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">
          ${comments.length === 0 ? `
            <div style="color: var(--text-dim); font-size: 11px; padding: 20px; text-align: center;">Nenhum comentário publicado ainda. Seja o primeiro!</div>
          ` : comments.map(c => `
            <div class="comment-card" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 12px; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: var(--accent-amber); font-size: 12px;">${c.author_name}</strong>
                <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-dim);">${new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <p style="font-size: 12px; color: var(--text-main); line-height: 1.5;">${c.content}</p>
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
        const newC = {
          id: `c-${Date.now()}`,
          target_id: pack.id,
          author_name: currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.username || 'Sobrevivente',
          content: text,
          likes_count: 0,
          created_at: new Date().toISOString()
        };
        pack.comments = pack.comments || [];
        pack.comments.unshift(newC);
        saveModpacksLocally();

        if (isConfigured) {
          try {
            await supabase.from('comments').insert([{
              target_id: pack.id,
              author_id: currentUser?.id,
              author_name: newC.author_name,
              content: text
            }]);
          } catch(err) {
            console.warn('Erro ao salvar comentário no Supabase:', err);
          }
        }

        renderModalTabContent(pack, changelogs);
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
        if (reason) {
          if (isConfigured) {
            const currentUser = getCurrentUser();
            try {
              await supabase.from('reports').insert([{
                target_type: 'modpack',
                target_id: pack.id,
                target_title: pack.name,
                reporter_id: currentUser?.id,
                reporter_name: currentUser?.user_metadata?.username || 'Anônimo',
                reason: reason,
                status: 'open'
              }]);
            } catch(e) {}
          }
          alert('Denúncia encaminhada com sucesso para a moderação da Staff.');
        }
      };
    }
  }
}

function updateDashboardView() {
  const container = document.getElementById('view-dashboard');
  if (!container) return;

  const totalModpacks = modpacksList.length;
  let totalMods = 0;
  let totalDownloads = 0;
  let totalLikes = 0;

  modpacksList.forEach(p => {
    totalMods += (p.mods?.length || 0);
    totalDownloads += (p.downloads_count || 0);
    totalLikes += (p.likes_count || 0);
  });

  const statBoxes = container.querySelectorAll('.dashboard-stats-grid .profile-stat-box .stat-value');
  if (statBoxes && statBoxes.length >= 4) {
    statBoxes[0].textContent = totalModpacks;
    statBoxes[1].textContent = `${totalMods} mods`;
    statBoxes[2].textContent = totalDownloads.toLocaleString('pt-BR');
    statBoxes[3].textContent = `❤️ ${totalLikes.toLocaleString('pt-BR')}`;
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
        <td>${pack.downloads_count || 0}</td>
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
