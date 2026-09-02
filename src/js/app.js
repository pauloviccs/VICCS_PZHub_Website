/**
 * PZHub Workshop - Main SPA Application Controller
 */

import { initAuth, getCurrentUser, getCurrentUserProfile } from './auth.js';
import { initWorkshop, loadWorkshopData, populateWebsiteCategoriesSelect } from './workshop.js';
import { initModpackBuilder, renderCreatorUploadsList } from './modpackBuilder.js';
import { loadUserProfileView } from './profile.js';
import { initAdminDashboard } from './admin.js';
import { initTimeline, loadTimelinePosts } from './timeline.js';
import { i18n } from './i18n.js';
import { showTacticalAlert, showTacticalConfirm, showTacticalToast } from './tacticalModal.js';

// Expõe globalmente para que qualquer script possa usar diálogos elegantes
window.showTacticalAlert = showTacticalAlert;
window.showTacticalConfirm = showTacticalConfirm;
window.showTacticalToast = showTacticalToast;

class PZHubApp {
  constructor() {
    this.currentView = 'workshop';
  }

  async init() {
    // 0. Inicializa o Tema (Dark / Light White Mode)
    this.initTheme();

    // 0.1 Inicializa o Sistema de Internacionalização (i18n)
    this.setupLanguageSelector();

    // 1. Inicializa Autenticação e Perfil
    await initAuth();

    // 2. Inicializa Módulos de Catálogo, Construtor e Timeline Social
    await initWorkshop();
    await initModpackBuilder();
    await initTimeline();

    // 3. Configura Roteamento SPA e Botões Globais
    this.setupRouting();
    this.setupGlobalButtons();
    this.setupMobileNavigation();

    // 4. Trata a rota inicial
    this.handleRoute();
  }

  initTheme() {
    const savedTheme = localStorage.getItem('pzhub_web_theme') || 'dark';
    const isLight = savedTheme === 'light';
    document.body.classList.toggle('theme-light', isLight);
    const themeIcon = document.getElementById('theme-toggle-icon');
    if (themeIcon) themeIcon.textContent = isLight ? '🌙' : '☀️';

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const currentlyLight = document.body.classList.contains('theme-light');
        const nextLight = !currentlyLight;
        document.body.classList.toggle('theme-light', nextLight);
        localStorage.setItem('pzhub_web_theme', nextLight ? 'light' : 'dark');
        if (themeIcon) themeIcon.textContent = nextLight ? '🌙' : '☀️';
        showTacticalToast(nextLight ? 'Modo Claro Ativado' : 'Modo Escuro Ativado', 'info', 2000);
      });
    }
  }

  setupLanguageSelector() {
    const langBtns = document.querySelectorAll('.web-lang-btn');
    langBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        if (lang) {
          i18n.setLanguage(lang);
          populateWebsiteCategoriesSelect();
        }
      });
    });
    i18n.updateDom();
  }

  setupMobileNavigation() {
    const hamburgerBtn = document.getElementById('btn-mobile-nav-toggle');
    const closeBtn = document.getElementById('btn-mobile-nav-close');
    const drawer = document.getElementById('mobile-nav-drawer');
    const backdrop = document.getElementById('mobile-nav-backdrop');

    const openDrawer = () => {
      if (drawer) drawer.classList.add('open');
      if (backdrop) backdrop.classList.add('visible');
    };

    const closeDrawer = () => {
      if (drawer) drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('visible');
    };

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    document.querySelectorAll('.mobile-nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        if (view) window.location.hash = `#${view}`;
        closeDrawer();
      });
    });
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

    // Atualiza abas do topo desktop e gaveta mobile
    document.querySelectorAll('.site-nav-tab, .mobile-nav-tab').forEach(tab => {
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
    } else if (viewName === 'timeline' || viewName === 'feed') {
      const timelineView = document.getElementById('view-timeline');
      if (timelineView) {
        timelineView.classList.add('active');
        await loadTimelinePosts();
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
