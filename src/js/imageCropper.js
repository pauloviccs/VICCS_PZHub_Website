/**
 * PZHub - Tactical Image Cropper & Lossless/Perceptual Canvas Compressor
 * Permite Pan (arraste), Zoom com mouse/slider, Rotação e compressão WebP de alta qualidade.
 */

import { showTacticalAlert, showTacticalToast } from './tacticalModal.js';

let activeCropperState = {
  img: null,
  imgUrl: null,
  scale: 1,
  minScale: 0.2,
  maxScale: 5,
  rotation: 0, // 0, 90, 180, 270
  posX: 0,
  posY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  initialPosX: 0,
  initialPosY: 0,
  aspectRatio: 1,
  outputWidth: 512,
  outputHeight: 512,
  isCircle: false,
  quality: 0.85,
  originalFileSize: 0,
  onComplete: null,
  onCancel: null
};

/**
 * Abre o modal tático de recorte e compressão
 * @param {File} file Arquivo de imagem enviado
 * @param {Object} options Configurações de aspect ratio, resolução e callback
 */
export function openImageCropperModal(file, options = {}) {
  if (!file || !file.type.startsWith('image/')) {
    showTacticalAlert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WebP).', 'FORMATO INVÁLIDO', 'warning');
    return;
  }

  const modal = document.getElementById('image-cropper-modal');
  if (!modal) {
    console.error('Modal #image-cropper-modal não encontrado no DOM.');
    return;
  }

  activeCropperState.aspectRatio = options.aspectRatio || 1;
  activeCropperState.outputWidth = options.outputWidth || 512;
  activeCropperState.outputHeight = options.outputHeight || 512;
  activeCropperState.isCircle = Boolean(options.isCircle);
  activeCropperState.quality = options.quality || 0.85;
  activeCropperState.originalFileSize = file.size;
  activeCropperState.onComplete = options.onComplete || null;
  activeCropperState.onCancel = options.onCancel || null;
  activeCropperState.rotation = 0;

  const titleEl = document.getElementById('cropper-modal-title');
  if (titleEl) {
    titleEl.textContent = options.title || (activeCropperState.isCircle ? 'AJUSTE DE FOTO DE PERFIL' : 'AJUSTE DE BANNER PANORÂMICO');
  }

  // Carrega a imagem
  if (activeCropperState.imgUrl) {
    URL.revokeObjectURL(activeCropperState.imgUrl);
  }
  activeCropperState.imgUrl = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    activeCropperState.img = img;
    initCropperUI();
    modal.classList.add('visible');
  };
  img.onerror = () => {
    showTacticalAlert('Erro ao carregar e decodificar a imagem selecionada.', 'FALHA DE LEITURA', 'error');
  };
  img.src = activeCropperState.imgUrl;
}

function initCropperUI() {
  const viewport = document.getElementById('cropper-viewport');
  const cropBox = document.getElementById('cropper-crop-box');
  const previewCanvas = document.getElementById('cropper-canvas');
  const zoomSlider = document.getElementById('cropper-zoom-slider');
  const origSizeEl = document.getElementById('cropper-orig-size');
  const optSizeEl = document.getElementById('cropper-opt-size');

  if (!viewport || !cropBox || !previewCanvas) return;

  // Atualiza telemetria de tamanho original
  if (origSizeEl) {
    origSizeEl.textContent = formatBytes(activeCropperState.originalFileSize);
  }
  if (optSizeEl) {
    // Estimativa de compressão (WebP ~85% quality economiza tipicamente 80-95%)
    const estimated = Math.max(25 * 1024, Math.round(activeCropperState.outputWidth * activeCropperState.outputHeight * 0.12));
    optSizeEl.textContent = `~${formatBytes(estimated)} (WebP HD)`;
  }

  // Ajusta dimensões do Crop Box baseado no Aspect Ratio
  const viewportWidth = viewport.clientWidth || 560;
  const viewportHeight = viewport.clientHeight || 360;

  let boxW, boxH;
  const ar = activeCropperState.aspectRatio;

  if (viewportWidth / viewportHeight > ar) {
    boxH = Math.min(viewportHeight - 40, 320);
    boxW = boxH * ar;
  } else {
    boxW = Math.min(viewportWidth - 40, 520);
    boxH = boxW / ar;
  }

  cropBox.style.width = `${Math.round(boxW)}px`;
  cropBox.style.height = `${Math.round(boxH)}px`;
  cropBox.classList.toggle('circle-mask', activeCropperState.isCircle);

  // Escala inicial: cobrir toda a moldura de recorte (object-fit cover)
  const imgW = activeCropperState.img.width;
  const imgH = activeCropperState.img.height;
  const baseScale = Math.max(boxW / imgW, boxH / imgH);

  activeCropperState.scale = baseScale;
  activeCropperState.minScale = baseScale * 0.5;
  activeCropperState.maxScale = baseScale * 4;
  activeCropperState.posX = 0;
  activeCropperState.posY = 0;

  if (zoomSlider) {
    zoomSlider.min = '0';
    zoomSlider.max = '100';
    zoomSlider.value = '25';
  }

  renderCropperPreview();
  setupCropperEvents();
}

function renderCropperPreview() {
  const canvas = document.getElementById('cropper-canvas');
  const viewport = document.getElementById('cropper-viewport');
  if (!canvas || !viewport || !activeCropperState.img) return;

  const ctx = canvas.getContext('2d');
  const w = viewport.clientWidth || 560;
  const h = viewport.clientHeight || 360;

  canvas.width = w;
  canvas.height = h;

  ctx.clearRect(0, 0, w, h);

  // Desenha imagem com transformações (Centro do Viewport + Pan + Zoom + Rotação)
  ctx.save();
  ctx.translate(w / 2 + activeCropperState.posX, h / 2 + activeCropperState.posY);
  ctx.rotate((activeCropperState.rotation * Math.PI) / 180);
  ctx.scale(activeCropperState.scale, activeCropperState.scale);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const img = activeCropperState.img;
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}

function setupCropperEvents() {
  const viewport = document.getElementById('cropper-viewport');
  const zoomSlider = document.getElementById('cropper-zoom-slider');
  const zoomInBtn = document.getElementById('btn-cropper-zoom-in');
  const zoomOutBtn = document.getElementById('btn-cropper-zoom-out');
  const rotateBtn = document.getElementById('btn-cropper-rotate');
  const resetBtn = document.getElementById('btn-cropper-reset');
  const applyBtn = document.getElementById('btn-cropper-apply');
  const cancelBtn = document.getElementById('btn-cropper-cancel');
  const closeIcon = document.getElementById('cropper-modal-close');

  if (!viewport) return;

  // Pointer drag unificado (Mouse + Touch)
  viewport.onpointerdown = (e) => {
    activeCropperState.isDragging = true;
    activeCropperState.dragStartX = e.clientX;
    activeCropperState.dragStartY = e.clientY;
    activeCropperState.initialPosX = activeCropperState.posX;
    activeCropperState.initialPosY = activeCropperState.posY;
    viewport.setPointerCapture(e.pointerId);
    viewport.style.cursor = 'grabbing';
  };

  viewport.onpointermove = (e) => {
    if (!activeCropperState.isDragging) return;
    const dx = e.clientX - activeCropperState.dragStartX;
    const dy = e.clientY - activeCropperState.dragStartY;
    activeCropperState.posX = activeCropperState.initialPosX + dx;
    activeCropperState.posY = activeCropperState.initialPosY + dy;
    renderCropperPreview();
  };

  viewport.onpointerup = viewport.onpointercancel = (e) => {
    activeCropperState.isDragging = false;
    viewport.style.cursor = 'grab';
    try { viewport.releasePointerCapture(e.pointerId); } catch(err) {}
  };

  // Zoom com a rodinha do mouse (Wheel)
  viewport.onwheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.08 : 0.92;
    setZoomScale(activeCropperState.scale * delta);
  };

  // Slider de Zoom
  if (zoomSlider) {
    zoomSlider.oninput = () => {
      const pct = parseFloat(zoomSlider.value) / 100;
      const newScale = activeCropperState.minScale + pct * (activeCropperState.maxScale - activeCropperState.minScale);
      activeCropperState.scale = newScale;
      renderCropperPreview();
    };
  }

  // Botões de Zoom
  if (zoomInBtn) {
    zoomInBtn.onclick = () => setZoomScale(activeCropperState.scale * 1.15);
  }
  if (zoomOutBtn) {
    zoomOutBtn.onclick = () => setZoomScale(activeCropperState.scale * 0.85);
  }

  // Rotação 90°
  if (rotateBtn) {
    rotateBtn.onclick = () => {
      activeCropperState.rotation = (activeCropperState.rotation + 90) % 360;
      renderCropperPreview();
    };
  }

  // Resetar Ajustes
  if (resetBtn) {
    resetBtn.onclick = () => {
      activeCropperState.posX = 0;
      activeCropperState.posY = 0;
      activeCropperState.rotation = 0;
      setZoomScale(activeCropperState.minScale * 2);
    };
  }

  // Fechar / Cancelar
  const closeModal = () => {
    const modal = document.getElementById('image-cropper-modal');
    if (modal) modal.classList.remove('visible');
    if (activeCropperState.onCancel) activeCropperState.onCancel();
  };

  if (cancelBtn) cancelBtn.onclick = closeModal;
  if (closeIcon) closeIcon.onclick = closeModal;

  // Confirmar e Comprimir
  if (applyBtn) {
    applyBtn.onclick = async () => {
      applyBtn.disabled = true;
      applyBtn.textContent = 'PROCESSANDO...';

      try {
        const compressedBase64 = await exportCroppedAndCompressedImage();
        const modal = document.getElementById('image-cropper-modal');
        if (modal) modal.classList.remove('visible');

        if (activeCropperState.onComplete) {
          activeCropperState.onComplete(compressedBase64);
        }
      } catch (err) {
        console.error('Erro ao processar imagem:', err);
        showTacticalAlert('Erro ao processar e comprimir a imagem.', 'FALHA DE PROCESSAMENTO', 'error');
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = '🚀 CONFIRMAR & APLICAR';
      }
    };
  }
}

function setZoomScale(newScale) {
  activeCropperState.scale = Math.max(activeCropperState.minScale, Math.min(activeCropperState.maxScale, newScale));
  const zoomSlider = document.getElementById('cropper-zoom-slider');
  if (zoomSlider) {
    const pct = ((activeCropperState.scale - activeCropperState.minScale) / (activeCropperState.maxScale - activeCropperState.minScale)) * 100;
    zoomSlider.value = Math.max(0, Math.min(100, pct));
  }
  renderCropperPreview();
}

/**
 * Renderiza o recorte final em alta resolução e comprime com sub-amostragem bicúbica
 */
async function exportCroppedAndCompressedImage() {
  const viewport = document.getElementById('cropper-viewport');
  const cropBox = document.getElementById('cropper-crop-box');
  if (!viewport || !cropBox || !activeCropperState.img) return null;

  const targetW = activeCropperState.outputWidth;
  const targetH = activeCropperState.outputHeight;

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = targetW;
  offscreenCanvas.height = targetH;
  const ctx = offscreenCanvas.getContext('2d');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Obter posição relativa da caixa de corte em relação ao centro do viewport
  const vpRect = viewport.getBoundingClientRect();
  const boxRect = cropBox.getBoundingClientRect();

  const boxCenterX = boxRect.left + boxRect.width / 2 - vpRect.left;
  const boxCenterY = boxRect.top + boxRect.height / 2 - vpRect.top;

  const vpCenterX = vpRect.width / 2;
  const vpCenterY = vpRect.height / 2;

  // Escala de conversão entre a caixa visual e a resolução final de saída
  const renderScaleFactor = targetW / boxRect.width;

  // Posição ajustada
  const finalPosX = (activeCropperState.posX + (vpCenterX - boxCenterX)) * renderScaleFactor;
  const finalPosY = (activeCropperState.posY + (vpCenterY - boxCenterY)) * renderScaleFactor;
  const finalScale = activeCropperState.scale * renderScaleFactor;

  ctx.save();
  ctx.translate(targetW / 2 + finalPosX, targetH / 2 + finalPosY);
  ctx.rotate((activeCropperState.rotation * Math.PI) / 180);
  ctx.scale(finalScale, finalScale);

  const img = activeCropperState.img;
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();

  // Se for avatar circular com fundo transparente / refinado
  if (activeCropperState.isCircle) {
    // Mantém transparente ou renderiza limpo
  }

  // Compressão inteligente: tenta WebP primeiro (85% qualidade), com fallback para JPEG
  return new Promise((resolve) => {
    let outputType = 'image/webp';
    let dataUrl = offscreenCanvas.toDataURL(outputType, activeCropperState.quality);

    // Se o browser não suportar WebP (retorna png padrão), usa JPEG
    if (!dataUrl.startsWith('data:image/webp')) {
      outputType = 'image/jpeg';
      dataUrl = offscreenCanvas.toDataURL(outputType, activeCropperState.quality);
    }

    resolve(dataUrl);
  });
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
