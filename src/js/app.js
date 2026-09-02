/**
 * PZHub Workshop - Main SPA Application Controller
 */

import { initAuth, getCurrentUser, getCurrentUserProfile } from './auth.js';
import { initWorkshop, loadWorkshopData } from './workshop.js';
import { initModpackBuilder, renderCreatorUploadsList } from './modpackBuilder.js';
import { loadUserProfileView } from './profile.js';
import { initAdminDashboard } from './admin.js';

class PZHubApp {
  constructor() {
    this.currentView = 'workshop';
  }

  async init() {
    // 1. Inicializa Autenticação e Perfil
    await initAuth();

    // 2. Inicializa Módulos de Catálogo e Construtor
    await initWorkshop();
    await initModpackBuilder();

    // 3. Configura Roteamento SPA e Botões Globais
    this.setupRouting();
    this.setupGlobalButtons();

    // 4. Trata a rota inicial
    this.handleRoute();
  }

  setupRouting() {
    window.addEventListener('hashchange', () => this.handleRoute());

    // Abas do topo
    document.querySelectorAll('.site-nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        if (view) window.location.hash = `#${view}`;
      });
    });
  }

  setupGlobalButtons() {
    const heroProfileBtn = document.getElementById('hero-btn-my-profile');
    if (heroProfileBtn) {
      heroProfileBtn.addEventListener('click', () => {
        const currentUser = getCurrentUser();
        const profile = getCurrentUserProfile();
        if (currentUser && profile?.username) {
          window.location.hash = `#profile/${profile.username}`;
        } else {
          document.getElementById('auth-modal')?.classList.add('visible');
        }
      });
    }
  }

  handleRoute() {
    const rawHash = window.location.hash.slice(1) || 'workshop';
    const parts = rawHash.split('/');
    const view = parts[0];
    const param = parts[1];

    this.switchView(view, param);
  }

  async switchView(viewName, param) {
    this.currentView = viewName;

    // Atualiza abas do topo
    document.querySelectorAll('.site-nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Oculta todas as seções e exibe a ativa
    document.querySelectorAll('.site-view').forEach(v => {
      v.classList.remove('active');
    });

    if (viewName === 'profile') {
      const profileView = document.getElementById('view-profile');
      if (profileView) {
        profileView.classList.add('active');
        await loadUserProfileView(param);
      }
    } else if (viewName === 'admin') {
      const adminView = document.getElementById('view-admin');
      if (adminView) {
        adminView.classList.add('active');
        await initAdminDashboard();
      }
    } else if (viewName === 'studio') {
      const studioView = document.getElementById('view-studio');
      if (studioView) {
        studioView.classList.add('active');
        renderCreatorUploadsList();
      }
    } else if (viewName === 'dashboard') {
      const dashView = document.getElementById('view-dashboard');
      if (dashView) {
        dashView.classList.add('active');
      }
    } else {
      // Default: workshop
      const workshopView = document.getElementById('view-workshop');
      if (workshopView) {
        workshopView.classList.add('active');
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new PZHubApp();
  app.init();
});
