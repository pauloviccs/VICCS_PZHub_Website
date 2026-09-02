/**
 * PZHub - Authentication & User Profile Module (Supabase Auth)
 */

import { supabase, isConfigured } from './supabaseClient.js';

let currentUser = null;
let currentUserProfile = null;

export async function initAuth() {
  const authBtn = document.getElementById('nav-auth-btn');
  const authModal = document.getElementById('auth-modal');
  const authCloseBtn = document.getElementById('auth-modal-close');
  const authForm = document.getElementById('auth-form');
  const toggleAuthModeBtn = document.getElementById('btn-toggle-auth-mode');
  const logoutBtn = document.getElementById('nav-logout-btn');
  const userProfileLink = document.getElementById('nav-user-profile-link');

  let isRegisterMode = false;

  if (isConfigured) {
    const { data: { session } } = await supabase.auth.getSession();
    currentUser = session?.user || null;
    if (currentUser) {
      currentUserProfile = await fetchOrCreateProfile(currentUser);
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) {
        currentUserProfile = await fetchOrCreateProfile(currentUser);
      } else {
        currentUserProfile = null;
      }
      updateAuthUI();
    });
  } else {
    // Modo simulação local
    const savedLocalUser = localStorage.getItem('PZHUB_DEMO_USER');
    if (savedLocalUser) {
      currentUser = JSON.parse(savedLocalUser);
      currentUserProfile = {
        id: currentUser.id,
        username: currentUser.user_metadata?.username || 'operador_alpha',
        display_name: currentUser.user_metadata?.display_name || 'Capitão Miller [VICCS]',
        role: currentUser.user_metadata?.username === 'admin' ? 'admin' : 'creator',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
        banner_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80'
      };
    }
  }

  updateAuthUI();

  if (authBtn) {
    authBtn.addEventListener('click', () => {
      if (currentUser) {
        window.location.hash = `#profile/${currentUserProfile?.username || 'operador_alpha'}`;
      } else {
        if (authModal) authModal.classList.add('visible');
      }
    });
  }

  if (userProfileLink) {
    userProfileLink.addEventListener('click', () => {
      if (currentUser) {
        window.location.hash = `#profile/${currentUserProfile?.username || 'operador_alpha'}`;
      }
    });
  }

  if (authCloseBtn && authModal) {
    authCloseBtn.addEventListener('click', () => {
      authModal.classList.remove('visible');
    });
  }

  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      const titleEl = document.getElementById('auth-modal-title');
      const submitBtn = document.getElementById('auth-submit-btn');
      const usernameGroup = document.getElementById('auth-username-group');

      if (titleEl) titleEl.textContent = isRegisterMode ? 'CADASTRO DE OPERADOR' : 'AUTENTICAÇÃO TÁTICA';
      if (submitBtn) submitBtn.textContent = isRegisterMode ? 'CRIAR CONTA DE CRIADOR' : 'ENTRAR NO PZHUB';
      if (usernameGroup) usernameGroup.style.display = isRegisterMode ? 'block' : 'none';
      toggleAuthModeBtn.textContent = isRegisterMode ? 'Já possui conta? Faça Login' : 'Não tem conta? Cadastre-se como Criador';
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value.trim();
      const username = document.getElementById('auth-username')?.value.trim() || email.split('@')[0];
      const statusMsg = document.getElementById('auth-status-msg');

      if (statusMsg) statusMsg.textContent = 'Processando...';

      if (isConfigured) {
        try {
          if (isRegisterMode) {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: { data: { username } }
            });
            if (error) throw error;
            currentUser = data.user;
          } else {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            if (error) throw error;
            currentUser = data.user;
          }
          currentUserProfile = await fetchOrCreateProfile(currentUser);
          if (authModal) authModal.classList.remove('visible');
          updateAuthUI();
        } catch (err) {
          if (statusMsg) statusMsg.textContent = `Erro: ${err.message}`;
        }
      } else {
        // Simulação instantânea
        currentUser = {
          id: `demo-${username}`,
          email,
          user_metadata: { username, display_name: username }
        };
        currentUserProfile = {
          id: currentUser.id,
          username,
          display_name: username,
          role: username === 'admin' ? 'admin' : 'creator',
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
          banner_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80'
        };
        localStorage.setItem('PZHUB_DEMO_USER', JSON.stringify(currentUser));
        if (authModal) authModal.classList.remove('visible');
        updateAuthUI();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (isConfigured) {
        await supabase.auth.signOut();
      }
      currentUser = null;
      currentUserProfile = null;
      localStorage.removeItem('PZHUB_DEMO_USER');
      updateAuthUI();
      window.location.hash = '#workshop';
    });
  }
}

async function fetchOrCreateProfile(user) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) return data;
  } catch (e) {
    console.warn('Erro ao consultar profile:', e);
  }

  return {
    id: user.id,
    username: user.user_metadata?.username || user.email?.split('@')[0] || 'operador',
    display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Operador',
    role: user.user_metadata?.username === 'admin' ? 'admin' : 'user',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
    banner_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80'
  };
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentUserProfile() {
  return currentUserProfile;
}

export function updateAuthUI() {
  const authBtn = document.getElementById('nav-auth-btn');
  const userProfileStrip = document.getElementById('nav-user-profile');
  const userNameEl = document.getElementById('nav-username');
  const userRoleBadge = document.getElementById('nav-user-role-badge');
  const navAdminTab = document.getElementById('nav-admin-tab');

  if (currentUser) {
    if (authBtn) authBtn.style.display = 'none';
    if (userProfileStrip) userProfileStrip.style.display = 'flex';
    if (userNameEl) {
      userNameEl.textContent = currentUserProfile?.display_name || currentUserProfile?.username || 'Operador';
    }

    if (userRoleBadge && currentUserProfile) {
      const role = currentUserProfile.role || 'user';
      if (role === 'admin') {
        userRoleBadge.textContent = '👑 ADMIN';
        userRoleBadge.className = 'tarkov-tag badge-role-admin';
      } else if (role === 'moderator') {
        userRoleBadge.textContent = '🛡️ MOD';
        userRoleBadge.className = 'tarkov-tag badge-role-mod';
      } else if (role === 'creator') {
        userRoleBadge.textContent = '💎 CRIADOR';
        userRoleBadge.className = 'tarkov-tag badge-role-creator';
      } else {
        userRoleBadge.textContent = '🎖️ OPERADOR';
        userRoleBadge.className = 'tarkov-tag badge-role-user';
      }
    }

    // Exibe a aba de moderação se for staff
    if (navAdminTab) {
      const isStaff = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'moderator';
      navAdminTab.style.display = isStaff ? 'flex' : 'none';
    }
  } else {
    if (authBtn) authBtn.style.display = 'flex';
    if (userProfileStrip) userProfileStrip.style.display = 'none';
    if (navAdminTab) navAdminTab.style.display = 'none';
  }
}
