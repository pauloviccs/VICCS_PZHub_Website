/**
 * PZHub - Creator Studio & Modpack Builder Module
 * Criação, edição, exclusão e gerenciamento de uploads do criador.
 * Suporta os tipos de mods sincronizáveis com o PZHub Desktop:
 * 1. Steam Workshop (workshop_id)
 * 2. Download Direto (direct_download: download_url + folder_name)
 */

import { supabase, isConfigured } from './supabaseClient.js';
import { getCurrentUser, getCurrentUserProfile } from './auth.js';
import { getAllModpacks, loadWorkshopData } from './workshop.js';
import { createChangelog } from './changelogs.js';
import { openImageCropperModal } from './imageCropper.js';

let builderModsList = [];
let editingPackId = null;

export async function initModpackBuilder() {
  const addModBtn = document.getElementById('btn-builder-add-mod');
  const publishBtn = document.getElementById('btn-builder-publish');
  const saveLocalBtn = document.getElementById('btn-builder-save-local');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  const coverFileInput = document.getElementById('input-upload-pack-cover');
  const modTypeSelect = document.getElementById('builder-mod-type');

  // Alternância dinâmica de campos conforme o tipo de mod (Workshop vs Download Direto)
  if (modTypeSelect) {
    modTypeSelect.addEventListener('change', () => {
      handleModTypeChange(modTypeSelect.value);
    });
  }

  // Upload e Ajuste Tático da Capa do Modpack
  if (coverFileInput) {
    coverFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        openImageCropperModal(file, {
          title: 'AJUSTE DE CAPA DE MODPACK (HD)',
          aspectRatio: 16 / 9,
          outputWidth: 1200,
          outputHeight: 675,
          quality: 0.85,
          onComplete: (compressedBase64) => {
            const imageInput = document.getElementById('builder-pack-image');
            if (imageInput) imageInput.value = compressedBase64;
          }
        });
      }
    });
  }

  const customUploadBtn = document.getElementById('btn-trigger-pack-cover-upload');
  if (customUploadBtn && coverFileInput) {
    customUploadBtn.addEventListener('click', () => {
      coverFileInput.click();
    });
  }

  if (publishBtn) {
    publishBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handlePublishModpack();
    });
  }

  if (saveLocalBtn) {
    saveLocalBtn.addEventListener('click', () => {
      const pack = extractBuilderFormData();
      if (!pack) return;
      navigator.clipboard.writeText(JSON.stringify(pack, null, 2));
      showTacticalToast('Manifesto JSON copiado para a área de transferência!', 'success');
    });
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      resetBuilderForm();
    });
  }

  renderCreatorUploadsList();
}

function handleModTypeChange(selectedType) {
  const nameInput = document.getElementById('builder-mod-name');
  const groupWorkshop = document.getElementById('field-group-workshop');
  const groupDirectUrl = document.getElementById('field-group-direct-url');
  const groupDirectFolder = document.getElementById('field-group-direct-folder');

  if (groupWorkshop) groupWorkshop.style.display = selectedType === 'workshop' ? 'block' : 'none';
  if (groupDirectUrl) groupDirectUrl.style.display = selectedType === 'direct_download' ? 'block' : 'none';
  if (groupDirectFolder) groupDirectFolder.style.display = selectedType === 'direct_download' ? 'block' : 'none';

  if (nameInput) {
    if (selectedType === 'workshop') {
      nameInput.placeholder = "Ex: Filibuster Rhymes' Used Cars! B42";
    } else if (selectedType === 'direct_download') {
      nameInput.placeholder = "Ex: Armas Especiais B42";
    }
  }
}

function handleAddModComponent() {
  const typeSelect = document.getElementById('builder-mod-type');
  const nameInput = document.getElementById('builder-mod-name');
  const reqCheckbox = document.getElementById('builder-mod-required');
  const wsInput = document.getElementById('builder-mod-ws-id');
  const directUrlInput = document.getElementById('builder-mod-direct-url');
  const directFolderInput = document.getElementById('builder-mod-folder-name');

  const mod_type = typeSelect?.value || 'workshop';
  const name = nameInput?.value.trim();
  const required = reqCheckbox?.checked || false;

  if (!name) {
    showTacticalAlert('Informe o nome do mod componente antes de adicionar.', 'VALOR OBRIGATÓRIO', 'warning');
    return;
  }

  let modObject = null;

  if (mod_type === 'workshop') {
    const workshop_id = wsInput?.value.trim();
    if (!workshop_id) {
      showTacticalAlert('Por favor, informe o Steam Workshop ID (apenas números, ex: 1510950729).', 'ID INVÁLIDO', 'warning');
      return;
    }
    modObject = {
      id: workshop_id,
      name,
      mod_type: 'workshop',
      workshop_id: workshop_id,
      required,
      description: `Steam Workshop [ID: ${workshop_id}]`
    };
    if (wsInput) wsInput.value = '';
  } else if (mod_type === 'direct_download') {
    const download_url = directUrlInput?.value.trim();
    const folder_name = directFolderInput?.value.trim() || name.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!download_url || !download_url.startsWith('http')) {
      showTacticalAlert('Por favor, informe uma URL válida (.ZIP ou .RAR) para o download direto do mod.', 'URL INVÁLIDA', 'warning');
      return;
    }

    modObject = {
      id: folder_name,
      name,
      mod_type: 'direct_download',
      download_url: download_url,
      folder_name: folder_name,
      required,
      description: `Download Direto (.ZIP) ➔ Zomboid/mods/${folder_name}`
    };

    if (directUrlInput) directUrlInput.value = '';
    if (directFolderInput) directFolderInput.value = '';
  }

  if (modObject) {
    builderModsList.push(modObject);
    if (nameInput) nameInput.value = '';
    renderBuilderModsList();
  }
}

export function renderBuilderModsList() {
  const container = document.getElementById('builder-mods-items-container');
  if (!container) return;

  if (builderModsList.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); font-size: 11px; padding: 12px;">Nenhum mod adicionado ainda. Adicione os componentes do seu pacote no formulário acima.</div>';
    return;
  }

  container.innerHTML = builderModsList.map((m, idx) => {
    let typeTag = '';
    let metaDetails = '';

    if (m.mod_type === 'workshop') {
      typeTag = `<span class="tarkov-tag badge-amber">🌐 STEAM WORKSHOP [${m.workshop_id || m.id}]</span>`;
      metaDetails = `<span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-dim);">ID: ${m.workshop_id || m.id}</span>`;
    } else {
      typeTag = `<span class="tarkov-tag badge-emerald">📦 DOWNLOAD DIRETO (.ZIP)</span>`;
      metaDetails = `<span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-dim);">Pasta: Zomboid/mods/${m.folder_name || m.id}</span>`;
    }

    return `
      <div class="builder-mod-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border: 1px solid var(--panel-border); border-radius: 4px; margin-bottom: 6px; gap: 10px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <strong style="color: #fff; font-size: 12px;">${m.name}</strong>
          ${typeTag}
          ${metaDetails}
          ${m.required ? '<span class="tarkov-tag" style="font-size: 9px; padding: 1px 4px; color: var(--accent-amber); border-color: rgba(229,142,38,0.3);">OBRIGATÓRIO</span>' : '<span class="tarkov-tag" style="font-size: 9px; padding: 1px 4px; color: var(--text-dim);">OPCIONAL</span>'}
        </div>
        <button type="button" class="tarkov-btn-mini btn-remove-mod-item" data-index="${idx}" style="color: var(--accent-red); border-color: rgba(214,48,49,0.3);">✕ REMOVER</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-remove-mod-item').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.index, 10);
      builderModsList.splice(idx, 1);
      renderBuilderModsList();
    };
  });
}

function extractBuilderFormData() {
  const name = document.getElementById('builder-pack-name')?.value.trim();
  const version = document.getElementById('builder-pack-version')?.value.trim() || '1.0.0';
  const category = document.getElementById('builder-pack-category')?.value || 'Militar';
  const zomboidVer = document.getElementById('builder-pack-zomboid-ver')?.value || '42.0+';
  const desc = document.getElementById('builder-pack-desc')?.value.trim();
  const image = document.getElementById('builder-pack-image')?.value.trim();

  if (!name || !desc) {
    showTacticalAlert('Preencha o Nome e a Descrição completa do modpack antes de continuar.', 'CAMPOS OBRIGATÓRIOS', 'warning');
    return null;
  }

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser?.id || '');

  const packData = {
    id: editingPackId || slug,
    slug: slug,
    name: name,
    title: name,
    version: version,
    category: category,
    zomboid_version: zomboidVer,
    description: desc,
    banner_url: image || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    image: image || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    author_id: isUUID ? currentUser.id : null,
    author_name: currentProfile?.display_name || currentProfile?.username || currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.username || 'Operador Comunitário',
    downloads_count: 0,
    likes_count: 0,
    mods: builderModsList,
    is_public: true,
    updated_at: new Date().toISOString()
  };

  if (!editingPackId) {
    packData.created_at = new Date().toISOString();
  }

  return packData;
}

async function handlePublishModpack() {
  const pack = extractBuilderFormData();
  if (!pack) return;

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();
  if (!currentUser) {
    await showTacticalAlert('Você precisa estar autenticado para publicar modpacks na rede.', 'AUTENTICAÇÃO NECESSÁRIA', 'warning');
    document.getElementById('auth-modal')?.classList.add('visible');
    return;
  }

  if (builderModsList.length === 0) {
    const confirmed = await showTacticalConfirm(
      'Este modpack não possui nenhum mod componente adicionado. Deseja publicar apenas o manifesto informativo?',
      'MODPACK SEM COMPONENTES'
    );
    if (!confirmed) return;
  }

  if (isConfigured) {
    try {
      // 1. Garante que o profile do usuário exista no Supabase para não falhar a FK author_id
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser.id || '');
      if (isUUID) {
        try {
          await supabase.from('profiles').upsert([{
            id: currentUser.id,
            username: currentProfile?.username || currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'operador',
            display_name: currentProfile?.display_name || currentUser.user_metadata?.display_name || currentProfile?.username || 'Operador',
            updated_at: new Date().toISOString()
          }], { onConflict: 'id' });
        } catch (profileErr) {
          console.warn('Aviso ao sincronizar perfil do autor:', profileErr);
        }
      }

      // 2. Salva o modpack
      const { data, error } = await supabase
        .from('modpacks')
        .upsert([pack], { onConflict: 'id' });

      if (error) {
        console.error('Erro detalhado Supabase:', error);
        throw error;
      }

      await showTacticalAlert(
        editingPackId ? `Modpack "${pack.name}" atualizado no Supabase com sucesso!` : `Modpack "${pack.name}" publicado com sucesso no banco de dados!`,
        'OPERAÇÃO CONCLUÍDA',
        'success'
      );
    } catch (err) {
      console.error('Erro ao salvar no Supabase:', err);
      await showTacticalAlert(`Falha ao gravar no Supabase: ${err.message || JSON.stringify(err)}`, 'ERRO DE SINCRONIZAÇÃO', 'error');
      return;
    }
  } else {
    // Gravação local se Supabase estiver em modo demo
    const all = getAllModpacks();
    let updated;
    if (editingPackId) {
      updated = all.map(p => p.id === editingPackId ? pack : p);
    } else {
      updated = [pack, ...all];
    }
    localStorage.setItem('PZHUB_COMMUNITY_MODPACKS', JSON.stringify(updated));
    await showTacticalAlert(`Modpack "${pack.name}" gravado localmente.`, 'MODO LOCAL', 'info');
  }

  resetBuilderForm();
  await loadWorkshopData();
  renderCreatorUploadsList();
  window.location.hash = '#workshop';
}

export function renderCreatorUploadsList() {
  const container = document.getElementById('creator-my-uploads-container');
  if (!container) return;

  const currentUser = getCurrentUser();
  const currentProfile = getCurrentUserProfile();

  if (!currentUser) {
    container.innerHTML = `
      <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--panel-border); padding: 18px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 12px;">
        <div style="font-size: 12px; color: var(--text-muted);">
          Você não está autenticado. Faça login para gerenciar e publicar seus modpacks no banco de dados.
        </div>
        <button id="btn-login-from-studio" class="tarkov-btn btn-amber">ENTRAR / CADASTRAR</button>
      </div>
    `;

    document.getElementById('btn-login-from-studio')?.addEventListener('click', () => {
      document.getElementById('auth-modal')?.classList.add('visible');
    });
    return;
  }

  const all = getAllModpacks();
  const currentUsername = currentProfile?.username || currentUser.user_metadata?.username;
  const myPacks = all.filter(p => p.author_id === currentUser.id || (currentUsername && (p.author === currentUsername || p.author_name === currentUsername)));

  if (myPacks.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); font-size: 11px; padding: 14px; background: rgba(0,0,0,0.3); border: 1px dashed var(--panel-border); border-radius: 4px;">Você ainda não possui modpacks publicados no banco de dados. Use o construtor abaixo para criar seu primeiro pacote.</div>';
    return;
  }

  container.innerHTML = myPacks.map(pack => `
    <div class="my-upload-card" style="display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--panel-border); padding: 14px 18px; border-radius: 4px; margin-bottom: 10px; gap: 14px; flex-wrap: wrap;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="${pack.image || pack.banner_url || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=120&q=80'}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" alt="${pack.name}" onerror="this.src='https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=120&q=80'" />
        <div>
          <h4 class="upload-card-title" style="font-size: 14px; text-transform: uppercase;">${pack.name}</h4>
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
        if (isConfigured) {
          try {
            await supabase.from('modpacks').delete().eq('id', packId);
          } catch(e) {
            console.warn('Erro ao deletar do Supabase:', e);
          }
        }
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
      if (isConfigured) {
        try {
          await supabase.from('modpacks').update({ version: newVer }).eq('id', packId);
        } catch(e) {}
      }
      localStorage.setItem('PZHUB_COMMUNITY_MODPACKS', JSON.stringify(all));
      showTacticalAlert(`Changelog v${newVer} publicado com sucesso para "${pack.name}"!`, 'CHANGELOG PUBLICADO', 'success');
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
