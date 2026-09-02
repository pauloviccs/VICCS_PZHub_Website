/**
 * PZHub - Admin & Moderation Dashboard Module
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser, getCurrentUserProfile } from './auth.js';

let reportsList = [];
let usersManagementList = [];

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
  renderAdminDashboard();
}

async function loadAdminReports() {
  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
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

  reportsList = [
    {
      id: "rep-101",
      target_type: "modpack",
      target_id: "apocalypse-roleplay-heavy",
      target_title: "Overhaul Apocalipse Total",
      reporter_name: "Survivor99",
      reason: "Link do modpack contém arquivo quebrado na Build 42 sem aviso prévio.",
      status: "open",
      created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: "rep-102",
      target_type: "comment",
      target_id: "c-44",
      target_title: "Comentário Ofensivo",
      reporter_name: "Rick_Grimes",
      reason: "Spam repetitivo e conduta anti-jogo no mural público.",
      status: "open",
      created_at: new Date(Date.now() - 3600000 * 8).toISOString()
    }
  ];
}

async function loadUsersList() {
  const saved = localStorage.getItem('PZHUB_USER_ROLES');
  if (saved) {
    try { usersManagementList = JSON.parse(saved); return; } catch(e) {}
  }

  usersManagementList = [
    { username: 'admin', display_name: 'Comandante Supremo', role: 'admin', total_uploads: 6 },
    { username: 'operador_alpha', display_name: 'Capitão Miller [VICCS]', role: 'creator', total_uploads: 4 },
    { username: 'mod_tatico', display_name: 'Sargento Harper', role: 'moderator', total_uploads: 1 },
    { username: 'rick_grimes', display_name: 'Rick Grimes', role: 'user', total_uploads: 0 }
  ];
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
              ${usersManagementList.map(user => `
                <tr>
                  <td><strong>@${user.username}</strong></td>
                  <td>${user.display_name}</td>
                  <td><span class="tarkov-tag badge-emerald">${user.total_uploads} MODS</span></td>
                  <td>
                    <span class="tarkov-tag ${
                      user.role === 'admin' ? 'badge-role-admin' :
                      user.role === 'moderator' ? 'badge-role-mod' :
                      user.role === 'creator' ? 'badge-role-creator' : 'badge-role-user'
                    }">
                      ${user.role.toUpperCase()}
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
    btn.addEventListener('click', () => {
      const repId = btn.dataset.repId;
      reportsList = reportsList.map(r => r.id === repId ? { ...r, status: 'dismissed' } : r);
      saveReportsLocally();
      renderAdminDashboard();
    });
  });

  // Resolve report
  document.querySelectorAll('.btn-resolve-report').forEach(btn => {
    btn.addEventListener('click', () => {
      const repId = btn.dataset.repId;
      reportsList = reportsList.map(r => r.id === repId ? { ...r, status: 'resolved' } : r);
      saveReportsLocally();
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

      alert(`Cargo de @${username} atualizado para ${newRole.toUpperCase()} com sucesso.`);
      renderAdminDashboard();
    });
  });
}

function saveReportsLocally() {
  localStorage.setItem('PZHUB_ADMIN_REPORTS', JSON.stringify(reportsList));
}
