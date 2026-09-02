/**
 * PZHub Website - Tactical Modals & Toast System (Escape from Tarkov Aesthetic)
 * Substitui alerts e confirms nativos do navegador por diálogos táteis elegantes e animados.
 */

let modalContainer = null;
let toastContainer = null;

function ensureContainers() {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'tactical-modal-root';
    modalContainer.className = 'tactical-modal-overlay';
    document.body.appendChild(modalContainer);
  }

  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'tactical-toast-root';
    toastContainer.className = 'tactical-toast-container';
    document.body.appendChild(toastContainer);
  }
}

/**
 * Exibe um alerta tático estilizado
 * @param {string} message 
 * @param {string} [title="TRANSMISSÃO // PZHUB"] 
 * @param {string} [type="info"] "info" | "success" | "warning" | "error"
 */
export function showTacticalAlert(message, title = 'TRANSMISSÃO // PZHUB', type = 'info') {
  ensureContainers();

  const colorMap = {
    info: 'var(--accent-cyan, #00d2d3)',
    success: 'var(--accent-emerald, #2ecc71)',
    warning: 'var(--accent-amber, #e58e26)',
    error: 'var(--accent-red, #ff4757)'
  };

  const borderCol = colorMap[type] || colorMap.info;

  return new Promise((resolve) => {
    modalContainer.innerHTML = `
      <div class="tactical-modal-dialog animate-pop" style="border-top: 3px solid ${borderCol};">
        <div class="modal-dialog-header">
          <div class="modal-dialog-code" style="color: ${borderCol};">${title}</div>
          <button class="modal-dialog-close-btn" id="btn-dialog-close">✕</button>
        </div>
        <div class="modal-dialog-body">
          <p class="modal-dialog-msg">${message}</p>
        </div>
        <div class="modal-dialog-footer">
          <button class="tarkov-btn btn-amber" id="btn-dialog-ok" style="min-width: 120px;">
            <span>ENTENDIDO // OK</span>
          </button>
        </div>
      </div>
    `;

    modalContainer.classList.add('visible');

    const close = () => {
      modalContainer.classList.remove('visible');
      setTimeout(() => {
        modalContainer.innerHTML = '';
        resolve(true);
      }, 200);
    };

    document.getElementById('btn-dialog-ok')?.addEventListener('click', close);
    document.getElementById('btn-dialog-close')?.addEventListener('click', close);
  });
}

/**
 * Exibe uma confirmação tática estilizada
 * @param {string} message 
 * @param {string} [title="CONFIRMAÇÃO OPERACIONAL"] 
 * @param {string} [confirmText="CONFIRMAR"] 
 * @param {string} [cancelText="CANCELAR"] 
 */
export function showTacticalConfirm(message, title = 'CONFIRMAÇÃO OPERACIONAL', confirmText = 'CONFIRMAR', cancelText = 'CANCELAR') {
  ensureContainers();

  return new Promise((resolve) => {
    modalContainer.innerHTML = `
      <div class="tactical-modal-dialog animate-pop" style="border-top: 3px solid var(--accent-amber);">
        <div class="modal-dialog-header">
          <div class="modal-dialog-code" style="color: var(--accent-amber);">${title}</div>
          <button class="modal-dialog-close-btn" id="btn-confirm-cancel-x">✕</button>
        </div>
        <div class="modal-dialog-body">
          <p class="modal-dialog-msg">${message}</p>
        </div>
        <div class="modal-dialog-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="tarkov-btn" id="btn-confirm-cancel">
            <span>${cancelText}</span>
          </button>
          <button class="tarkov-btn btn-amber" id="btn-confirm-ok">
            <span>${confirmText}</span>
          </button>
        </div>
      </div>
    `;

    modalContainer.classList.add('visible');

    const handleConfirm = () => {
      modalContainer.classList.remove('visible');
      setTimeout(() => {
        modalContainer.innerHTML = '';
        resolve(true);
      }, 200);
    };

    const handleCancel = () => {
      modalContainer.classList.remove('visible');
      setTimeout(() => {
        modalContainer.innerHTML = '';
        resolve(false);
      }, 200);
    };

    document.getElementById('btn-confirm-ok')?.addEventListener('click', handleConfirm);
    document.getElementById('btn-confirm-cancel')?.addEventListener('click', handleCancel);
    document.getElementById('btn-confirm-cancel-x')?.addEventListener('click', handleCancel);
  });
}

/**
 * Exibe um toast militar no canto inferior direito
 * @param {string} message 
 * @param {string} [type="info"] 
 * @param {number} [duration=4000] 
 */
export function showTacticalToast(message, type = 'info', duration = 4000) {
  ensureContainers();

  const toast = document.createElement('div');
  toast.className = `tactical-toast toast-${type} animate-slide-in`;

  const iconMap = {
    info: '📡',
    success: '✓',
    warning: '⚠️',
    error: '✕'
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || '📡'}</span>
    <span class="toast-text">${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
