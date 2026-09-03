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
import { createChangelog, updateChangelog, deleteChangelog, fetchModpackChangelogs, syncLatestModpackVersion } from './changelogs.js';
import { openImageCropperModal } from './imageCropper.js';
import { showTacticalAlert, showTacticalConfirm, showTacticalToast } from './tacticalModal.js';

let builderModsList = [];
let editingPackId = null;
let currentChangelogPack = null;
let editingChangelogId = null;
let changelogModalMode = 'history';

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

  if (addModBtn) {
    addModBtn.addEventListener('click', handleAddModComponent);
  }

  const wsInput = document.getElementById('builder-mod-ws-id');
  const wsFeedback = document.getElementById('builder-mod-ws-feedback');
  if (wsInput) {
    const handleWsInput = () => {
      const val = wsInput.value.trim();
      if (!val) {
        if (wsFeedback) {
          wsFeedback.style.display = 'none';
          wsFeedback.innerHTML = '';
        }
        return;
      }
      const extractedId = parseSteamWorkshopId(val);
      if (extractedId) {
        if (wsFeedback) {
          wsFeedback.style.display = 'inline-flex';
          wsFeedback.className = 'steam-extraction-badge valid';
          wsFeedback.innerHTML = `✓ ID Detectado: <strong>${extractedId}</strong>`;
        }
      } else {
        if (wsFeedback) {
          wsFeedback.style.display = 'inline-flex';
          wsFeedback.className = 'steam-extraction-badge invalid';
          wsFeedback.innerHTML = `⚠️ Insira um link válido da Steam ou o ID numérico`;
        }
      }
    };
    wsInput.addEventListener('input', handleWsInput);
    wsInput.addEventListener('paste', () => setTimeout(handleWsInput, 50));
  }

  renderCreatorUploadsList();
  setupMarkdownEditor();
  setupChangelogModal();
}

export function parseSteamWorkshopId(rawInput) {
  if (!rawInput) return null;
  const trimmed = rawInput.trim();
  // 1. Se já for estritamente numérico
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  // 2. Extração via query param ?id=XXXX ou &id=XXXX
  const queryMatch = trimmed.match(/[?&]id=(\d+)/i);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }
  // 3. Extração via path alternativo filedetails/XXXX ou sharedfiles/XXXX
  const pathMatch = trimmed.match(/(?:filedetails|sharedfiles)[^\d]*(\d+)/i);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }
  // 4. Sequência numérica isolada (6 a 12 dígitos)
  const broadMatch = trimmed.match(/\b(\d{6,12})\b/);
  if (broadMatch && broadMatch[1]) {
    return broadMatch[1];
  }
  return null;
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
  const wsFeedback = document.getElementById('builder-mod-ws-feedback');
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
    const rawVal = wsInput?.value.trim();
    const extractedId = parseSteamWorkshopId(rawVal);
    if (!extractedId) {
      showTacticalAlert('Por favor, informe o link completo do mod na Steam ou o Workshop ID numérico (ex: https://steamcommunity.com/sharedfiles/filedetails/?id=1510950729 ou 1510950729).', 'LINK OU ID INVÁLIDO', 'warning');
      return;
    }
    modObject = {
      id: extractedId,
      name,
      mod_type: 'workshop',
      workshop_id: extractedId,
      required,
      description: `Steam Workshop [ID: ${extractedId}]`
    };
    if (wsInput) wsInput.value = '';
    if (wsFeedback) {
      wsFeedback.style.display = 'none';
      wsFeedback.innerHTML = '';
    }
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
        <button class="tarkov-btn-mini btn-changelog-mypack" data-pack-id="${pack.id}" style="border-color: var(--accent-cyan); color: var(--accent-cyan);">🔄 CHANGELOGS</button>
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
    btn.onclick = () => {
      const packId = btn.dataset.packId;
      const pack = myPacks.find(p => p.id === packId);
      if (pack) openChangelogModal(pack);
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
  document.getElementById('btn-editor-tab-write')?.click();
}

/**
 * Parser Nativo e Seguro de Markdown (Zero Dependencies)
 */
export function parseMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Cabeçalhos (h1 a h4)
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Citações
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Blocos de código multilinhas
  html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');

  // Código inline
  html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

  // Negrito e Itálico
  html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/___(.*?)___/gim, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

  // Links seguros
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Listas não ordenadas
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>(\n|$))+/gim, '<ul>$&</ul>');

  // Linhas horizontais
  html = html.replace(/^(?:---|\*\*\*|___)\s*$/gim, '<hr />');

  // Quebras de linha e parágrafos
  html = html.replace(/\n\n+/g, '</p><p>');
  html = html.replace(/\n/g, '<br />');

  return `<div class="md-rendered-content">${html}</div>`;
}

/**
 * Configura os ouvintes do Editor de Descrição de Modpack
 */
export function setupMarkdownEditor() {
  const textarea = document.getElementById('builder-pack-desc');
  const previewBox = document.getElementById('builder-pack-desc-preview');
  const tabWrite = document.getElementById('btn-editor-tab-write');
  const tabPreview = document.getElementById('btn-editor-tab-preview');
  const toolsGroup = document.getElementById('editor-tools-group');
  const charCounter = document.getElementById('editor-char-counter');
  const uploadBtn = document.getElementById('btn-trigger-md-upload');
  const fileInput = document.getElementById('input-upload-md-file');
  const editorWrap = document.getElementById('tarkov-desc-editor');

  if (!textarea) return;

  const updateCount = () => {
    if (charCounter) charCounter.textContent = `${textarea.value.length} CARACTERES`;
  };
  textarea.addEventListener('input', updateCount);
  updateCount();

  if (tabWrite && tabPreview && previewBox) {
    tabWrite.addEventListener('click', () => {
      tabWrite.classList.add('active');
      tabPreview.classList.remove('active');
      textarea.style.display = 'block';
      previewBox.style.display = 'none';
      if (toolsGroup) toolsGroup.style.opacity = '1';
      textarea.focus();
    });

    tabPreview.addEventListener('click', () => {
      tabPreview.classList.add('active');
      tabWrite.classList.remove('active');
      textarea.style.display = 'none';
      previewBox.style.display = 'block';
      if (toolsGroup) toolsGroup.style.opacity = '0.35';

      const content = textarea.value.trim();
      previewBox.innerHTML = content ? parseMarkdown(content) : '<span class="preview-empty-hint">Nenhum conteúdo para pré-visualizar. Digite na aba "Escrever" ou carregue um arquivo .md.</span>';
    });
  }

  document.querySelectorAll('.editor-tool-btn[data-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      applyMarkdownFormat(textarea, btn.dataset.format);
      updateCount();
    });
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') { e.preventDefault(); applyMarkdownFormat(textarea, 'bold'); updateCount(); }
      else if (key === 'i') { e.preventDefault(); applyMarkdownFormat(textarea, 'italic'); updateCount(); }
      else if (key === 'k') { e.preventDefault(); applyMarkdownFormat(textarea, 'link'); updateCount(); }
    }
  });

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        processMarkdownFile(file, textarea, updateCount);
        fileInput.value = '';
      }
    });
  }

  if (editorWrap) {
    ['dragenter', 'dragover'].forEach(eventName => {
      editorWrap.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        editorWrap.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      editorWrap.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        editorWrap.classList.remove('drag-over');
      });
    });

    editorWrap.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        processMarkdownFile(file, textarea, updateCount);
      }
    });
  }
}

/**
 * Alterna a visualização entre o Histórico e o Formulário de Despacho
 */
function switchChangelogModalMode(mode) {
  changelogModalMode = mode;
  const historyPane = document.getElementById('changelog-history-pane');
  const formPane = document.getElementById('changelog-form');
  const btnHistory = document.getElementById('btn-ch-mode-history');
  const btnCreate = document.getElementById('btn-ch-mode-create');
  const headerTitle = document.getElementById('changelog-modal-header-title');

  if (mode === 'history') {
    if (historyPane) historyPane.style.display = 'flex';
    if (formPane) formPane.style.display = 'none';
    if (btnHistory) btnHistory.classList.add('active');
    if (btnCreate) btnCreate.classList.remove('active');
    if (headerTitle) headerTitle.textContent = 'GERENCIADOR DE CHANGELOGS & HISTÓRICO';
  } else {
    if (historyPane) historyPane.style.display = 'none';
    if (formPane) formPane.style.display = 'flex';
    if (btnCreate) btnCreate.classList.add('active');
    if (btnHistory) btnHistory.classList.remove('active');
  }
}

/**
 * Prepara o formulário para um NOVO changelog com sugestão de versão
 */
function prepareNewChangelogForm() {
  editingChangelogId = null;
  const headerTitle = document.getElementById('changelog-modal-header-title');
  const submitBtn = document.getElementById('btn-submit-changelog-modal');
  const verInput = document.getElementById('changelog-version-input');
  const titleInput = document.getElementById('changelog-title-input');
  const notesInput = document.getElementById('changelog-notes-input');
  const editingIdInput = document.getElementById('changelog-editing-id');
  const tabWrite = document.getElementById('btn-ch-tab-write');

  if (headerTitle) headerTitle.textContent = 'DESPACHO DE ATUALIZAÇÃO // NOVO CHANGELOG';
  if (submitBtn) submitBtn.innerHTML = '🚀 PUBLICAR CHANGELOG OFICIAL';
  if (editingIdInput) editingIdInput.value = '';

  if (currentChangelogPack) {
    const currentVer = currentChangelogPack.version || '1.0.0';
    const parts = currentVer.split('.').map(n => parseInt(n, 10) || 0);
    if (parts.length >= 2) {
      parts[1] += 1;
      if (parts.length >= 3) parts[2] = 0;
      if (verInput) verInput.value = parts.join('.');
    } else {
      if (verInput) verInput.value = '1.1.0';
    }
  }

  if (titleInput) titleInput.value = 'Atualização de Compatibilidade Build 42';
  if (notesInput) notesInput.value = '- Melhorias de performance e estabilidade.\n- Ajustes de compatibilidade com os mods recentes.\n- Correções de bugs relatados pela comunidade.';

  if (tabWrite) tabWrite.click();
}

/**
 * Recarrega e renderiza a lista de histórico de changelogs no modal
 */
async function refreshChangelogHistoryList(pack) {
  const container = document.getElementById('ch-history-list');
  const countEl = document.getElementById('ch-history-count');
  const targetNameEl = document.getElementById('ch-history-target-name');
  const currentVerEl = document.getElementById('ch-history-current-ver');
  const formTargetName = document.getElementById('changelog-target-name');
  const formCurrentVer = document.getElementById('changelog-current-ver');

  if (targetNameEl) targetNameEl.textContent = pack.name;
  if (currentVerEl) currentVerEl.textContent = `v${pack.version || '1.0.0'}`;
  if (formTargetName) formTargetName.textContent = pack.name;
  if (formCurrentVer) formCurrentVer.textContent = `v${pack.version || '1.0.0'}`;

  if (!container) return;
  container.innerHTML = '<div style="color: var(--text-dim); font-size: 11px; padding: 20px; text-align: center;">Carregando histórico na nuvem...</div>';

  const changelogs = await fetchModpackChangelogs(pack.slug || pack.id);
  if (countEl) countEl.textContent = changelogs.length;

  if (changelogs.length === 0) {
    container.innerHTML = `
      <div style="color: var(--text-dim); font-size: 12px; padding: 24px; text-align: center; background: rgba(0,0,0,0.2); border: 1px dashed var(--panel-border); border-radius: 4px;">
        <p style="margin-bottom: 10px;">Nenhum changelog publicado ainda para este modpack.</p>
        <button type="button" class="tarkov-btn btn-amber btn-create-first-ch" style="font-size: 11px; padding: 6px 14px;">
          ➕ CRIAR PRIMEIRO CHANGELOG
        </button>
      </div>
    `;
    const btnFirst = container.querySelector('.btn-create-first-ch');
    if (btnFirst) {
      btnFirst.onclick = () => {
        prepareNewChangelogForm();
        switchChangelogModalMode('create');
      };
    }
    return;
  }

  container.innerHTML = changelogs.map((ch, idx) => `
    <div class="ch-history-item" data-ch-id="${ch.id}">
      <div class="ch-history-item-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="tarkov-tag badge-version" style="font-weight: bold;">v${ch.version}</span>
          ${idx === 0 ? '<span class="tarkov-tag" style="background: rgba(0, 206, 201, 0.15); color: var(--accent-cyan); border-color: rgba(0, 206, 201, 0.4); font-size: 9px;">VERSÃO ATIVA</span>' : ''}
          <strong style="color: #fff; font-size: 12px;">${ch.title}</strong>
        </div>
        <div class="ch-history-actions">
          <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-dim); margin-right: 6px;">
            ${new Date(ch.created_at).toLocaleDateString('pt-BR')}
          </span>
          <button type="button" class="tarkov-btn-mini btn-edit-ch" data-ch-id="${ch.id}" title="Editar notas e título desta versão">
            ✏️ EDITAR
          </button>
          <button type="button" class="tarkov-btn-mini btn-delete-ch" data-ch-id="${ch.id}" style="border-color: var(--accent-red); color: var(--accent-red);" title="Excluir changelog permanentemente">
            🗑️ EXCLUIR
          </button>
        </div>
      </div>
      <div class="ch-history-notes-preview">${ch.notes || 'Sem notas registradas.'}</div>
    </div>
  `).join('');

  // Ações nos itens da lista
  container.querySelectorAll('.btn-edit-ch').forEach(btn => {
    btn.onclick = () => {
      const chId = btn.dataset.chId;
      const targetCh = changelogs.find(c => c.id === chId);
      if (!targetCh) return;

      editingChangelogId = targetCh.id;
      const headerTitle = document.getElementById('changelog-modal-header-title');
      const submitBtn = document.getElementById('btn-submit-changelog-modal');
      const verInput = document.getElementById('changelog-version-input');
      const titleInput = document.getElementById('changelog-title-input');
      const notesInput = document.getElementById('changelog-notes-input');
      const editingIdInput = document.getElementById('changelog-editing-id');
      const tabWrite = document.getElementById('btn-ch-tab-write');

      if (headerTitle) headerTitle.textContent = `EDITANDO CHANGELOG // v${targetCh.version}`;
      if (submitBtn) submitBtn.innerHTML = '💾 SALVAR ALTERAÇÕES';
      if (editingIdInput) editingIdInput.value = targetCh.id;

      if (verInput) verInput.value = targetCh.version;
      if (titleInput) titleInput.value = targetCh.title;
      if (notesInput) notesInput.value = targetCh.notes;

      if (tabWrite) tabWrite.click();
      switchChangelogModalMode('create');
    };
  });

  container.querySelectorAll('.btn-delete-ch').forEach(btn => {
    btn.onclick = async () => {
      const chId = btn.dataset.chId;
      const targetCh = changelogs.find(c => c.id === chId);
      if (!targetCh) return;

      if (confirm(`Tem certeza que deseja excluir o changelog v${targetCh.version} ("${targetCh.title}")?`)) {
        await deleteChangelog(chId, pack.slug || pack.id);
        const newVersion = await syncLatestModpackVersion(pack.id);
        if (newVersion) {
          pack.version = newVersion;
          const allPacks = getAllModpacks();
          const targetInAll = allPacks.find(p => p.id === pack.id);
          if (targetInAll) targetInAll.version = newVersion;
          localStorage.setItem('PZHUB_COMMUNITY_MODPACKS', JSON.stringify(allPacks));
        }

        showTacticalToast(`Changelog v${targetCh.version} excluído com sucesso!`, 'success');
        await refreshChangelogHistoryList(pack);
        renderCreatorUploadsList();
        await loadWorkshopData();
      }
    };
  });
}

/**
 * Configura o Modal Tático de Changelog e sua Estação de Redação
 */
export function setupChangelogModal() {
  const modal = document.getElementById('changelog-modal');
  const closeBtn = document.getElementById('changelog-modal-close');
  const historyCloseBtn = document.getElementById('btn-ch-history-close');
  const cancelBtn = document.getElementById('btn-cancel-changelog-modal');
  const form = document.getElementById('changelog-form');
  const textarea = document.getElementById('changelog-notes-input');
  const previewBox = document.getElementById('changelog-notes-preview');
  const tabWrite = document.getElementById('btn-ch-tab-write');
  const tabPreview = document.getElementById('btn-ch-tab-preview');
  const toolsGroup = document.getElementById('ch-editor-tools-group');
  const charCounter = document.getElementById('ch-editor-char-counter');
  const uploadBtn = document.getElementById('btn-trigger-ch-md-upload');
  const fileInput = document.getElementById('input-upload-ch-md-file');
  const editorWrap = document.getElementById('tarkov-changelog-editor');

  const btnModeHistory = document.getElementById('btn-ch-mode-history');
  const btnModeCreate = document.getElementById('btn-ch-mode-create');
  const btnHistoryAddNew = document.getElementById('btn-ch-history-add-new');

  if (!modal) return;

  const closeModal = () => modal.classList.remove('visible');

  if (closeBtn) closeBtn.onclick = closeModal;
  if (historyCloseBtn) historyCloseBtn.onclick = closeModal;

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      if (editingChangelogId) {
        editingChangelogId = null;
        switchChangelogModalMode('history');
      } else {
        closeModal();
      }
    };
  }

  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      closeModal();
    }
  });

  if (btnModeHistory) {
    btnModeHistory.onclick = () => switchChangelogModalMode('history');
  }

  if (btnModeCreate) {
    btnModeCreate.onclick = () => {
      prepareNewChangelogForm();
      switchChangelogModalMode('create');
    };
  }

  if (btnHistoryAddNew) {
    btnHistoryAddNew.onclick = () => {
      prepareNewChangelogForm();
      switchChangelogModalMode('create');
    };
  }

  const updateChCount = () => {
    if (charCounter && textarea) charCounter.textContent = `${textarea.value.length} CARACTERES`;
  };
  if (textarea) textarea.addEventListener('input', updateChCount);

  if (tabWrite && tabPreview && previewBox && textarea) {
    tabWrite.addEventListener('click', () => {
      tabWrite.classList.add('active');
      tabPreview.classList.remove('active');
      textarea.style.display = 'block';
      previewBox.style.display = 'none';
      if (toolsGroup) toolsGroup.style.opacity = '1';
      textarea.focus();
    });

    tabPreview.addEventListener('click', () => {
      tabPreview.classList.add('active');
      tabWrite.classList.remove('active');
      textarea.style.display = 'none';
      previewBox.style.display = 'block';
      if (toolsGroup) toolsGroup.style.opacity = '0.35';

      const content = textarea.value.trim();
      previewBox.innerHTML = content ? parseMarkdown(content) : '<span class="preview-empty-hint">Nenhum conteúdo para pré-visualizar. Digite na aba "Escrever" ou carregue um arquivo .md.</span>';
    });
  }

  document.querySelectorAll('.editor-tool-btn[data-ch-format]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (textarea) {
        applyMarkdownFormat(textarea, btn.dataset.chFormat);
        updateChCount();
      }
    });
  });

  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'b') { e.preventDefault(); applyMarkdownFormat(textarea, 'bold'); updateChCount(); }
        else if (key === 'i') { e.preventDefault(); applyMarkdownFormat(textarea, 'italic'); updateChCount(); }
        else if (key === 'k') { e.preventDefault(); applyMarkdownFormat(textarea, 'link'); updateChCount(); }
      }
    });
  }

  if (uploadBtn && fileInput && textarea) {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        processMarkdownFile(file, textarea, updateChCount);
        fileInput.value = '';
      }
    });
  }

  if (editorWrap && textarea) {
    ['dragenter', 'dragover'].forEach(eventName => {
      editorWrap.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        editorWrap.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      editorWrap.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        editorWrap.classList.remove('drag-over');
      });
    });

    editorWrap.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        processMarkdownFile(file, textarea, updateChCount);
      }
    });
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!currentChangelogPack) return;

      const verInput = document.getElementById('changelog-version-input');
      const titleInput = document.getElementById('changelog-title-input');
      const notesInput = document.getElementById('changelog-notes-input');

      const version = verInput?.value.trim();
      const title = titleInput?.value.trim();
      const notes = notesInput?.value.trim();

      if (!version || !title || !notes) {
        showTacticalAlert('Preencha a versão, título e as notas detalhadas do changelog.', 'CAMPOS OBRIGATÓRIOS', 'warning');
        return;
      }

      if (editingChangelogId) {
        // Modo Edição
        await updateChangelog(editingChangelogId, version, title, notes, currentChangelogPack.slug || currentChangelogPack.id);
        editingChangelogId = null;
        showTacticalAlert(`Changelog v${version} atualizado com sucesso!`, 'CHANGELOG ATUALIZADO', 'success');
      } else {
        // Modo Criação
        await createChangelog(currentChangelogPack.slug || currentChangelogPack.id, version, title, notes);
        currentChangelogPack.version = version;

        if (isConfigured) {
          try {
            await supabase.from('modpacks').update({ version: version }).eq('id', currentChangelogPack.id);
          } catch (err) {
            console.warn('Erro ao sincronizar versão do modpack no Supabase:', err);
          }
        }

        const allPacks = getAllModpacks();
        const targetInAll = allPacks.find(p => p.id === currentChangelogPack.id);
        if (targetInAll) targetInAll.version = version;
        localStorage.setItem('PZHUB_COMMUNITY_MODPACKS', JSON.stringify(allPacks));

        showTacticalAlert(`Changelog v${version} publicado com sucesso para "${currentChangelogPack.name}"!`, 'CHANGELOG PUBLICADO', 'success');
      }

      await refreshChangelogHistoryList(currentChangelogPack);
      switchChangelogModalMode('history');
      renderCreatorUploadsList();
      await loadWorkshopData();
    };
  }
}

/**
 * Abre o Modal de Changelog para um modpack específico no modo Histórico/Gerenciador
 */
export async function openChangelogModal(pack) {
  currentChangelogPack = pack;
  editingChangelogId = null;
  const modal = document.getElementById('changelog-modal');
  if (!modal) return;

  await refreshChangelogHistoryList(pack);
  switchChangelogModalMode('history');
  modal.classList.add('visible');
}

/**
 * Função Auxiliar de Inserção de Formatação no Cursor
 */
function applyMarkdownFormat(textarea, formatType) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;

  switch (formatType) {
    case 'bold':
      replacement = selectedText ? `**${selectedText}**` : '**texto em negrito**';
      cursorOffset = selectedText ? replacement.length : 2;
      break;
    case 'italic':
      replacement = selectedText ? `*${selectedText}*` : '*texto em itálico*';
      cursorOffset = selectedText ? replacement.length : 1;
      break;
    case 'heading':
      replacement = selectedText ? `\n### ${selectedText}\n` : '\n### Título da Seção\n';
      cursorOffset = replacement.length;
      break;
    case 'list':
      if (selectedText) {
        replacement = selectedText.split('\n').map(l => l ? `- ${l}` : '').join('\n');
      } else {
        replacement = '\n- Item 1\n- Item 2\n- Item 3\n';
      }
      cursorOffset = replacement.length;
      break;
    case 'link':
      replacement = selectedText ? `[${selectedText}](https://link-aqui.com)` : '[Título do Link](https://link-aqui.com)';
      cursorOffset = replacement.length;
      break;
    case 'quote':
      replacement = selectedText ? `\n> ${selectedText}\n` : '\n> Instrução ou lore tática...\n';
      cursorOffset = replacement.length;
      break;
    case 'code':
      if (selectedText.includes('\n') || !selectedText) {
        replacement = `\n\`\`\`\n${selectedText || 'bloco de código ou comando'}\n\`\`\`\n`;
      } else {
        replacement = `\`${selectedText}\``;
      }
      cursorOffset = replacement.length;
      break;
    default:
      return;
  }

  textarea.focus();
  textarea.setRangeText(replacement, start, end, 'end');
  textarea.dispatchEvent(new Event('input'));
}

/**
 * Processa e Valida Arquivos .md ou .txt com Leitura Local Nativa
 */
async function processMarkdownFile(file, textarea, onUpdate) {
  const validExtensions = ['.md', '.txt', '.markdown'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  if (!validExtensions.includes(ext)) {
    showTacticalAlert('Formato de arquivo incompatível. Selecione um arquivo .md ou .txt.', 'ARQUIVO INVÁLIDO', 'warning');
    return;
  }

  if (file.size > 1024 * 1024) {
    showTacticalAlert('O arquivo excede o limite máximo de 1MB.', 'TAMANHO EXCESSIVO', 'warning');
    return;
  }

  if (textarea.value.trim().length > 0) {
    const confirmOverwrite = await showTacticalConfirm(
      `O campo já contém texto. Deseja substituir pelo conteúdo do arquivo "${file.name}"?`,
      'CONFIRMAÇÃO DE SUBSTITUIÇÃO'
    );
    if (!confirmOverwrite) return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    textarea.value = event.target.result || '';
    textarea.dispatchEvent(new Event('input'));
    if (onUpdate) onUpdate();
    showTacticalToast(`Arquivo "${file.name}" carregado com sucesso!`, 'success');
  };
  reader.onerror = () => {
    showTacticalAlert('Falha ao ler o arquivo local.', 'ERRO DE LEITURA', 'error');
  };
  reader.readAsText(file);
}
