/**
 * PZHub Website - Main App Orchestrator
 */

import { initAuth } from './auth.js';
import { initWorkshop } from './workshop.js';
import { initModpackBuilder } from './modpackBuilder.js';
import { isConfigured } from './supabaseClient.js';

class WebsiteApp {
  constructor() {
    this.currentView = 'workshop';
  }

  async init() {
    this.setupNavigation();
    this.updateCloudStatus();

    await initAuth();
    await initWorkshop();
    initModpackBuilder();

    // Roteamento inicial por Hash
    this.handleHashChange();
    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  setupNavigation() {
    const navTabs = document.querySelectorAll('.site-nav-tab');
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        if (view) {
          window.location.hash = '#' + view;
        }
      });
    });
  }

  handleHashChange() {
    const hash = window.location.hash.replace('#', '') || 'workshop';
    this.switchView(hash);
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Atualiza tabs
    document.querySelectorAll('.site-nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Atualiza sections
    document.querySelectorAll('.site-view').forEach(sec => {
      sec.classList.toggle('active', sec.id === ('view-' + viewName));
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  updateCloudStatus() {
    const statusBadge = document.getElementById('cloud-status-badge');
    if (statusBadge) {
      statusBadge.textContent = isConfigured ? 'PZHUB CLOUD ATIVO' : 'MODO COMUNIDADE';
      statusBadge.className = 'tarkov-tag ' + (isConfigured ? 'badge-emerald' : 'badge-amber');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new WebsiteApp();
  app.init();
});
