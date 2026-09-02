/**
 * PZHub - Creator Studio & Modpack Builder Module
 * Criação, edição, exclusão e gerenciamento de uploads do criador.
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';
import { getAllModpacks, loadWorkshopData } from './workshop.js';
import { createChangelog } from './changelogs.js';

let builderModsList = [];
let editingPackId = null;

export async function initModpackBuilder() {
  const addModBtn = document.getElementById('btn-builder-add-mod');
  const publishBtn = document.getElementById('btn-builder-publish');
  const saveLocalBtn = document.getElementById('btn-builder-save-local');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');

  if (addModBtn) {
    addModBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('builder-mod-name');
      const typeSelect = document.getElementById('builder-mod-type');
      const wsInput = document.getElementById('builder-mod-ws-id');
      const reqCheckbox = document.getElementById('builder-mod-required');

      const name = nameInput?.value.trim();
      const mod_type = typeSelect?.value || 'workshop';
      const workshop_id = wsInput?.value.trim();
      const required = reqCheckbox?.checked || false;

      if (!name) {
        alert('Informe o nome do mod.');
        return;
      }

      builderModsList.push({
        id: workshop_id || `mod-${Date.now()}`,
        name,
        mod_type,
        workshop_id,
        required
      });

      if (nameInput) nameInput.value = '';
      if (wsInput) wsInput.value = '';
      renderBuilderModsList();
    });
  }

  if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
      await handlePublishModpack();
    });
  }

  if (saveLocalBtn) {
    saveLocalBtn.addEventListener('click', () => {
      const pack = extractBuilderFormData();
      if (!pack) return;
      navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
      alert('Manifesto JSON copiado para a área de transferência!');
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      resetBuilderForm();
    });
  }

  renderCreatorUploadsList();
}

function extractBuilderFormData() {
  const name = document.getElementById('builder-pack-name')?.value.trim();
  const version = document.getElementById('builder-pack-version')?.value.trim() || '1.0.0';
  const category = document.getElementById('builder-pack-category')?.value || 'Militar';
  const zomboidVer = document.getElementById('builder-pack-zomboid-ver')?.value || '42.0+';
  const desc = document.getElementById('builder-pack-desc')?.value.trim();
  const image = document.getElementById('builder-pack-image')?.value.trim();

  if (!name || !desc) {
    alert('Preencha o Nome e a Descrição do modpack.');
    return null;
  }

  const currentUser = getCurrentUser();

  return {
    id: editingPackId || `pack-${Date.now()}`,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    name,
    version,
    category,
    zomboid_version: zomboidVer,
    description: desc,
    image: image || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    author: currentUser?.user_metadata?.username || 'operador_alpha',
    author_name: currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.username || 'Capitão Miller [VICCS]',
    downloads_count: 0,
    likes_count: 0,
    mods: builderModsList,
    updated_at: new Date().toISOString()
  };
}

async function handlePublishModpack() {
  const pack = extractBuilderFormData();
  if (!pack) return;

  const currentUser = getCurrentUser();
  if (!currentUser) {
    alert('Você precisa estar autenticado para publicar modpacks.');
    return;
  }

  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('modpacks')
        .upsert([pack]);

      if (error) throw error;
    } catch (err) {
      console.warn('Erro ao salvar no Supabase:', err);
    }
  }

  // Local fallback save
  const all = getAllModpacks();
  let updated;
  if (editingPackId) {
    updated = all.map(p => p.id === editingPackId ? pack : p);
  } else {
    updated = [pack, ...all];
  }
  localStorage.setItem('PZHUB_COMMUNITY_MODPACKS', JSON.stringify(updated));

  alert(editingPackId ? `Modpack "${pack.name}" atualizado com sucesso!` : `Modpack "${pack.name}" publicado com sucesso no catálogo!`);
  resetBuilderForm();
  await loadWorkshopData();
  renderCreatorUploadsList();
  window.location.hash = '#workshop';
}

export function renderBuilderModsList() {
  const container = document.getElementById('builder-mods-items-container');
  if (!container) return;

  if (builderModsList.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); font-size: 11px; padding: 12px;">Nenhum mod adicionado ainda. Adicione os mods acima.</div>';
    return;
  }

  container.innerHTML = builderModsList.map((m, idx) => `
    <div class="builder-mod-row" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 8px 12px; border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 6px;">
      <div>
        <strong style="color: var(--text-main); font-size: 12px;">${m.name}</strong>
        <span style="font-size: 10px; color: var(--text-dim); margin-left: 8px;">(${m.mod_type})</span>
      </div>
      <button class="tarkov-btn-mini btn-remove-mod-item" data-index="${idx}" style="color: var(--accent-red); border-color: rgba(214,48,49,0.3);">REMOVER</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-remove-mod-item').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.index, 10);
      builderModsList.splice(idx, 1);
      renderBuilderModsList();
    };
  });
}

export function renderCreatorUploadsList() {
  const container = document.getElementById('creator-my-uploads-container');
  if (!container) return;

  const currentUser = getCurrentUser();
  const all = getAllModpacks();
  const myPacks = all.filter(p => !currentUser || p.author === currentUser.user_metadata?.username || p.author === 'operador_alpha');

  if (myPacks.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); font-size: 11px; padding: 14px;">Você ainda não possui modpacks publicados. Use o formulário abaixo para criar seu primeiro pacote.</div>';
    return;
  }

  container.innerHTML = myPacks.map(pack => `
    <div class="my-upload-card" style="display: flex; justify-content: space-between; align-items: center; background: rgba(14,20,28,0.9); border: 1px solid var(--panel-border); padding: 14px 18px; border-radius: 4px; margin-bottom: 10px; gap: 14px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="${pack.image || pack.banner_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=120&q=80'}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" alt="${pack.name}" />
        <div>
          <h4 style="color: #fff; font-size: 14px; text-transform: uppercase;">${pack.name}</h4>
          <span style="font-size: 11px; color: var(--text-dim); font-family: var(--font-mono);">v${pack.version} • ${pack.mods?.length || 0} mods • ❤️ ${pack.likes_count || 0} likes • 🚀 ${pack.downloads_count || 0} downloads</span>
        </div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button class="tarkov-btn-mini btn-edit-mypack" data-pack-id="${pack.id}">✏️ EDITAR</button>
        <button class="tarkov-btn-mini btn-changelog-mypack" data-pack-id="${pack.id}" style="border-color: var(--accent-cyan); color: var(--accent-cyan);">🔄 NOVO CHANGELOG</button>
        <button class="tarkov-btn-mini btn-delete-mypack" data-pack-id="${pack.id}" style="border-color: var(--accent-red); color: var(--accent-red);">🗑️ DELETAR</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-edit-mypack').forEach(btn => {
    btn.onclick = () => {
      const packId = btn.dataset.packId;
      const pack = myPacks.find(p => p.id === packId);
      if (pack) loadPackIntoBuilder(pack);
    };
  });

  container.querySelectorAll('.btn-delete-mypack').forEach(btn => {
    btn.onclick = async () => {
      const packId = btn.dataset.packId;
      if (confirm('Tem certeza que deseja excluir permanentemente este modpack do catálogo?')) {
        const remaining = all.filter(p => p.id !== packId);
        localStorage.setItem('PZHUB_COMMUNITY_MODPACKS', JSON.stringify(remaining));
        await loadWorkshopData();
        renderCreatorUploadsList();
      }
    };
  });

  container.querySelectorAll('.btn-changelog-mypack').forEach(btn => {
    btn.onclick = async () => {
      const packId = btn.dataset.packId;
      const pack = myPacks.find(p => p.id === packId);
      if (!pack) return;

      const newVer = prompt(`Informe a nova versão para "${pack.name}" (Atual: v${pack.version}):`, '1.5.0');
      if (!newVer) return;
      const title = prompt('Título das melhorias:', 'Atualização de Compatibilidade Build 42');
      if (!title) return;
      const notes = prompt('Notas da versão (Changelog):', '- Otimização de performance e correção de bugs.');
      if (!notes) return;

      await createChangelog(pack.slug || pack.id, newVer, title, notes);
      pack.version = newVer;
      localStorage.setItem('PZHUB_COMMUNITY_MODPACKS', JSON.stringify(all));
      alert(`Changelog v${newVer} publicado com sucesso para "${pack.name}"!`);
      renderCreatorUploadsList();
    };
  });
}

function loadPackIntoBuilder(pack) {
  editingPackId = pack.id;
  const nameInput = document.getElementById('builder-pack-name');
  const versionInput = document.getElementById('builder-pack-version');
  const categorySelect = document.getElementById('builder-pack-category');
  const zomboidVerSelect = document.getElementById('builder-pack-zomboid-ver');
  const descInput = document.getElementById('builder-pack-desc');
  const imageInput = document.getElementById('builder-pack-image');
  const titleHeader = document.getElementById('builder-form-title');
  const cancelBtn = document.getElementById('btn-cancel-edit');

  if (nameInput) nameInput.value = pack.name;
  if (versionInput) versionInput.value = pack.version;
  if (categorySelect) categorySelect.value = pack.category || 'Militar';
  if (zomboidVerSelect) zomboidVerSelect.value = pack.zomboid_version || '42.0+';
  if (descInput) descInput.value = pack.description;
  if (imageInput) imageInput.value = pack.image || pack.banner_url || '';
  if (titleHeader) titleHeader.textContent = `EDITANDO MODPACK: ${pack.name}`;
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  builderModsList = [...(pack.mods || [])];
  renderBuilderModsList();

  // Scroll to builder
  document.getElementById('builder-form-card')?.scrollIntoView({ behavior: 'smooth' });
}

function resetBuilderForm() {
  editingPackId = null;
  const form = document.getElementById('builder-form');
  if (form) form.reset();
  const titleHeader = document.getElementById('builder-form-title');
  const cancelBtn = document.getElementById('btn-cancel-edit');
  if (titleHeader) titleHeader.textContent = 'CONSTRUTOR DE NOVO MODPACK';
  if (cancelBtn) cancelBtn.style.display = 'none';
  builderModsList = [];
  renderBuilderModsList();
}
