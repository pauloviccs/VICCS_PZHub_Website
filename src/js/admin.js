/**
 * PZHub - Admin & Moderation Dashboard Module
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser, getCurrentUserProfile } from './auth.js';
import { showTacticalToast } from './tacticalModal.js';

let reportsList = [];
let usersManagementList = [];

export const DEFAULT_DESKTOP_DOWNLOAD_URL = 'https://www.dropbox.com/scl/fi/u1zxwky8utdzwdv4spv91/PZHub_Setup.exe?rlkey=nguj8499hj314a1f5rcsxkwdu&st=pcntmhga&dl=1';
export let activeDownloadUrl = DEFAULT_DESKTOP_DOWNLOAD_URL;

export async function fetchActiveDownloadUrl() {
  const cached = localStorage.getItem('PZHUB_DESKTOP_DOWNLOAD_URL');
  if (cached) {
    activeDownloadUrl = cached;
    applyDownloadUrlToDom(cached);
  }

  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('modpack_changelogs')
        .select('notes')
        .eq('modpack_id', 'system_config')
        .eq('title', 'desktop_download_url')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.notes) {
        activeDownloadUrl = data.notes.trim();
        localStorage.setItem('PZHUB_DESKTOP_DOWNLOAD_URL', activeDownloadUrl);
        applyDownloadUrlToDom(activeDownloadUrl);
        return activeDownloadUrl;
      }
    } catch (err) {
      console.warn('Erro ao carregar download URL do Supabase:', err);
    }
  }

  if (!activeDownloadUrl) {
    activeDownloadUrl = DEFAULT_DESKTOP_DOWNLOAD_URL;
  }
  applyDownloadUrlToDom(activeDownloadUrl);
  return activeDownloadUrl;
}

export function applyDownloadUrlToDom(url) {
  if (!url) return;
  const heroBtn = document.getElementById('hero-btn-download-app');
  if (heroBtn) {
    heroBtn.href = url;
  }
}

export async function initAdminDashboard() {
  const container = document.getElementById('view-admin');
  if (!container) return;

  const currentProfile = getCurrentUserProfile();
  const isStaff = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'moderator');

  if (!isStaff && currentProfile?.username !== 'admin') {
    container.innerHTML = `
      <div class="tarkov-empty-state" style="padding: 60px 20px;">
        <div class="tarkov-empty-title" style="color: var(--accent-red);">ACESSO RESTRITO // CÓDIGO VERMELHO</div>
        <div class="tarkov-empty-desc">Esta central de comando é exclusiva para membros da Staff e Moderadores do PZHub.</div>
        <a href="#workshop" class="tarkov-btn btn-amber" style="margin-top: 20px; display: inline-flex;">VOLTAR AO CATÁLOGO</a>
      </div>
    `;
    return;
  }

  await loadAdminReports();
  await loadUsersList();
  await fetchActiveDownloadUrl();
  renderAdminDashboard();
}

async function loadAdminReports() {
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        reportsList = data;
        return;
      }
    } catch (e) {
      console.warn('Erro ao ler reports do Supabase:', e);
    }
  }

  const saved = localStorage.getItem('PZHUB_ADMIN_REPORTS');
  if (saved) {
    try { reportsList = JSON.parse(saved); return; } catch(e) {}
  }

  reportsList = [];
}

async function loadUsersList() {
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, display_name, role');

      if (!error && Array.isArray(data)) {
        usersManagementList = data.map(u => ({ ...u, total_uploads: 0 }));
        return;
      }
    } catch (e) {
      console.warn('Erro ao ler profiles do Supabase:', e);
    }
  }

  const saved = localStorage.getItem('PZHUB_USER_ROLES');
  if (saved) {
    try { usersManagementList = JSON.parse(saved); return; } catch(e) {}
  }

  usersManagementList = [];
}

export function renderAdminDashboard() {
  const container = document.getElementById('view-admin');
  if (!container) return;

  const openReportsCount = reportsList.filter(r => r.status === 'open').length;

  container.innerHTML = `
    <div class="admin-dashboard-container">
      <!-- Header do Painel Admin -->
      <div class="admin-header-strip">
        <div class="admin-title-group">
          <span class="view-sub">PAINEL DE CONTROLE DE STAFF</span>
          <h1 class="view-title" style="color: #fff; font-size: 22px;">CENTRAL DE MODERAÇÃO & QUALIDADE</h1>
        </div>
        <div class="admin-quick-stats">
          <div class="stat-pill"><span class="pill-dot red"></span> <strong>${openReportsCount}</strong> DENÚNCIAS PENDENTES</div>
          <div class="stat-pill"><span class="pill-dot cyan"></span> <strong>${usersManagementList.length}</strong> OPERADORES REGISTRADOS</div>
        </div>
      </div>

      <!-- Abas de Moderação -->
      <div class="admin-tabs-bar">
        <button class="admin-tab-btn active" data-tab="admin-reports">TRIAGEM DE DENÚNCIAS (${openReportsCount})</button>
        <button class="admin-tab-btn" data-tab="admin-users">GERENCIAMENTO DE CARGOS & PERMISSÕES</button>
        <button class="admin-tab-btn" data-tab="admin-settings">⚙️ CONFIGURAÇÕES DE SOFTWARE & DOWNLOADS</button>
      </div>

      <!-- CONTEÚDO 1: TRIAGEM DE REPORTS -->
      <div id="admin-reports" class="admin-tab-pane active">
        <div class="admin-table-wrapper">
          <table class="tarkov-table">
            <thead>
              <tr>
                <th>TIPO</th>
                <th>ALVO / TÍTULO</th>
                <th>DENUNCIANTE</th>
                <th>MOTIVO DO REPORTE</th>
                <th>DATA</th>
                <th>STATUS</th>
                <th>AÇÕES DA STAFF</th>
              </tr>
            </thead>
            <tbody>
              ${reportsList.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 30px;">Nenhuma denúncia pendente no momento.</td></tr>
              ` : reportsList.map(rep => `
                <tr class="report-row ${rep.status}">
                  <td><span class="tarkov-tag ${rep.target_type === 'modpack' ? 'badge-amber' : 'badge-cyan'}">${rep.target_type.toUpperCase()}</span></td>
                  <td><strong>${rep.target_title || rep.target_id}</strong></td>
                  <td style="color: var(--accent-amber);">${rep.reporter_name}</td>
                  <td style="max-width: 280px; font-size: 11px;">${rep.reason}</td>
                  <td style="font-family: var(--font-mono); font-size: 10px;">${new Date(rep.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <span class="tarkov-tag ${rep.status === 'open' ? 'badge-red' : 'badge-emerald'}">
                      ${rep.status === 'open' ? 'PENDENTE' : 'RESOLVIDO'}
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="tarkov-btn-mini btn-dismiss-report" data-rep-id="${rep.id}" title="Descartar como denúncia inválida">IGNORAR</button>
                      <button class="tarkov-btn-mini btn-resolve-report" data-rep-id="${rep.id}" style="border-color: var(--accent-emerald); color: var(--accent-emerald);" title="Marcar como resolvido">RESOLVER</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- CONTEÚDO 2: GESTÃO DE CARGOS -->
      <div id="admin-users" class="admin-tab-pane">
        <div class="admin-table-wrapper">
          <table class="tarkov-table">
            <thead>
              <tr>
                <th>OPERADOR</th>
                <th>NOME DE EXIBIÇÃO</th>
                <th>UPLOADS ATIVOS</th>
                <th>CARGO ATUAL</th>
                <th>ATRIBUIR NOVA PATENTE (SUPABASE)</th>
              </tr>
            </thead>
            <tbody>
              ${usersManagementList.length === 0 ? `
                <tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 30px;">Nenhum operador registrado no Supabase ainda.</td></tr>
              ` : usersManagementList.map(user => `
                <tr>
                  <td><strong>@${user.username}</strong></td>
                  <td>${user.display_name || user.username}</td>
                  <td><span class="tarkov-tag badge-emerald">${user.total_uploads || 0} MODS</span></td>
                  <td>
                    <span class="tarkov-tag ${
                      user.role === 'admin' ? 'badge-role-admin' :
                      user.role === 'moderator' ? 'badge-role-mod' :
                      user.role === 'creator' ? 'badge-role-creator' : 'badge-role-user'
                    }">
                      ${(user.role || 'user').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <select class="tarkov-select select-user-role" data-username="${user.username}" style="padding: 4px 8px; font-size: 11px;">
                      <option value="user" ${user.role === 'user' ? 'selected' : ''}>🎖️ Operador (User)</option>
                      <option value="creator" ${user.role === 'creator' ? 'selected' : ''}>💎 Criador Oficial</option>
                      <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>🛡️ Moderador</option>
                      <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>👑 Administrador (Staff)</option>
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- CONTEÚDO 3: CONFIGURAÇÕES DE SOFTWARE & DOWNLOADS -->
      <div id="admin-settings" class="admin-tab-pane">
        <div class="admin-table-wrapper" style="padding: 24px; background: rgba(15, 20, 28, 0.85); border: 1px solid var(--panel-border); border-radius: 6px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div>
              <span class="tarkov-tag badge-emerald" style="margin-bottom: 6px;">DISTRIBUIÇÃO OFICIAL // DESKTOP CLIENT</span>
              <h2 style="font-size: 17px; font-weight: 800; color: #fff; letter-spacing: 0.5px; margin: 4px 0 0 0;">DISTRIBUIÇÃO DO EXECUTÁVEL (.EXE) DO PZHUB</h2>
            </div>
            <span class="tarkov-tag badge-amber">ACESSO EXCLUSIVO STAFF</span>
          </div>

          <p style="font-size: 12px; color: var(--text-muted); line-height: 1.6; margin-bottom: 22px; max-width: 820px;">
            Altere o link direto de download vinculado ao botão principal <strong>"⬇️ BAIXAR PZHUB DESKTOP (.EXE)"</strong> na Hero da página inicial. Qualquer atualização feita aqui é sincronizada imediatamente com a nuvem do Supabase e propagada para todos os operadores.
          </p>

          <div style="display: flex; flex-direction: column; gap: 18px; max-width: 850px;">
            <div class="form-group" style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-size: 11px; font-weight: 700; color: var(--accent-amber); letter-spacing: 1px;">
                URL DO EXECUTÁVEL WINDOWS (.EXE)
              </label>
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <input 
                  type="url" 
                  id="admin-input-download-url" 
                  class="tarkov-input" 
                  style="flex: 1; min-width: 280px; font-family: var(--font-mono); font-size: 12px; padding: 10px 14px;" 
                  placeholder="https://exemplo.com/downloads/PZHub_Setup.exe" 
                  value="${activeDownloadUrl}" 
                />
                <button type="button" id="btn-admin-copy-download-url" class="tarkov-btn" title="Copiar link atual">
                  📋 COPIAR
                </button>
                <a id="btn-admin-test-download-url" href="${activeDownloadUrl}" target="_blank" class="tarkov-btn btn-cyan" title="Testar abertura direta do link">
                  🔗 TESTAR LINK
                </a>
              </div>
              <span style="font-size: 11px; color: var(--text-dim);">
                💡 Dica: Suporta links diretos do Dropbox (com ?dl=1), GitHub Releases, Google Drive direto ou CDN próprio.
              </span>
            </div>

            <!-- Card de Status do Botão da Hero -->
            <div style="background: rgba(0,0,0,0.45); border: 1px dashed rgba(229, 142, 38, 0.4); border-radius: 4px; padding: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 26px;">🎯</span>
                <div>
                  <div style="font-size: 12px; font-weight: 700; color: #fff;">Status do Botão Hero Principal:</div>
                  <div id="admin-hero-preview-status" style="font-size: 11px; font-family: var(--font-mono); color: var(--accent-emerald);">
                    CONECTADO AO HERO // ${activeDownloadUrl ? activeDownloadUrl.slice(0, 50) + '...' : 'PADRÃO'}
                  </div>
                </div>
              </div>
              <button type="button" id="btn-admin-save-download-url" class="tarkov-btn btn-amber" style="padding: 10px 24px; font-size: 12px; font-weight: 800;">
                💾 SALVAR NOVO LINK (.EXE)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupAdminEventListeners();
}

function setupAdminEventListeners() {
  // Tab switching
  const tabs = document.querySelectorAll('.admin-tab-btn');
  const panes = document.querySelectorAll('.admin-tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetId = tab.dataset.tab;
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Dismiss report
  document.querySelectorAll('.btn-dismiss-report').forEach(btn => {
    btn.addEventListener('click', async () => {
      const repId = btn.dataset.repId;
      reportsList = reportsList.map(r => r.id === repId ? { ...r, status: 'dismissed' } : r);
      saveReportsLocally();
      if (isConfigured) {
        try {
          await supabase.from('reports').update({ status: 'dismissed' }).eq('id', repId);
          showTacticalToast('Denúncia descartada no Supabase.', 'info');
        } catch(err) {
          console.warn('Erro ao atualizar status do report no Supabase:', err);
        }
      }
      renderAdminDashboard();
    });
  });

  // Resolve report
  document.querySelectorAll('.btn-resolve-report').forEach(btn => {
    btn.addEventListener('click', async () => {
      const repId = btn.dataset.repId;
      reportsList = reportsList.map(r => r.id === repId ? { ...r, status: 'resolved' } : r);
      saveReportsLocally();
      if (isConfigured) {
        try {
          await supabase.from('reports').update({ status: 'resolved' }).eq('id', repId);
          showTacticalToast('Denúncia marcada como resolvida no Supabase.', 'success');
        } catch(err) {
          console.warn('Erro ao atualizar status do report no Supabase:', err);
        }
      }
      renderAdminDashboard();
    });
  });

  // Alterar cargo do usuário
  document.querySelectorAll('.select-user-role').forEach(select => {
    select.addEventListener('change', async (e) => {
      const username = select.dataset.username;
      const newRole = e.target.value;

      usersManagementList = usersManagementList.map(u => u.username === username ? { ...u, role: newRole } : u);
      localStorage.setItem('PZHUB_USER_ROLES', JSON.stringify(usersManagementList));

      if (isConfigured) {
        try {
          await supabase.from('profiles').update({ role: newRole }).eq('username', username);
        } catch (err) {
          console.warn('Erro ao atualizar cargo no Supabase:', err);
        }
      }

      showTacticalToast(`Cargo de @${username} atualizado para ${newRole.toUpperCase()} com sucesso.`, 'success');
      renderAdminDashboard();
    });
  });

  // 4. Gestão do Link do Executável (.exe)
  const downloadInput = document.getElementById('admin-input-download-url');
  const copyBtn = document.getElementById('btn-admin-copy-download-url');
  const testLink = document.getElementById('btn-admin-test-download-url');
  const saveBtn = document.getElementById('btn-admin-save-download-url');

  if (downloadInput && testLink) {
    downloadInput.addEventListener('input', () => {
      const val = downloadInput.value.trim();
      testLink.href = val || '#';
    });
  }

  if (copyBtn && downloadInput) {
    copyBtn.addEventListener('click', () => {
      const val = downloadInput.value.trim();
      if (val) {
        navigator.clipboard.writeText(val);
        showTacticalToast('Link copiado para a área de transferência!', 'info');
      }
    });
  }

  if (saveBtn && downloadInput) {
    saveBtn.addEventListener('click', async () => {
      const val = downloadInput.value.trim();
      if (!val || (!val.startsWith('http://') && !val.startsWith('https://'))) {
        showTacticalToast('Insira uma URL válida iniciando com http:// ou https://', 'warning');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ SINCRONIZANDO...';

      activeDownloadUrl = val;
      localStorage.setItem('PZHUB_DESKTOP_DOWNLOAD_URL', val);
      applyDownloadUrlToDom(val);

      if (isConfigured) {
        try {
          const { data: existing } = await supabase
            .from('modpack_changelogs')
            .select('id')
            .eq('modpack_id', 'system_config')
            .eq('title', 'desktop_download_url')
            .limit(1)
            .maybeSingle();

          if (existing?.id) {
            await supabase
              .from('modpack_changelogs')
              .update({ notes: val, version: '2.0.0' })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('modpack_changelogs')
              .insert([{
                modpack_id: 'system_config',
                title: 'desktop_download_url',
                version: '2.0.0',
                notes: val
              }]);
          }
        } catch (err) {
          console.warn('Erro ao salvar URL no Supabase:', err);
        }
      }

      saveBtn.disabled = false;
      saveBtn.textContent = '💾 SALVAR NOVO LINK (.EXE)';
      showTacticalToast('Link do executável atualizado no site e no Supabase com sucesso!', 'success');

      const previewStatus = document.getElementById('admin-hero-preview-status');
      if (previewStatus) {
        previewStatus.textContent = `SINCRONIZADO // ${val.slice(0, 50)}...`;
      }
    });
  }
}

function saveReportsLocally() {
  localStorage.setItem('PZHUB_ADMIN_REPORTS', JSON.stringify(reportsList));
}
