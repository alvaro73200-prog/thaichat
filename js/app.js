// app.js — Controlador principal de ThaiChat Translator

import TranslationService from './api.js';
import * as Storage from './storage.js';
import { registerServiceWorker } from './pwa.js';

// ==================== APP CLASS ====================
class ThaiChatApp {
  constructor() {
    this.translator = null;
    this.currentTab = 'translate';
    this.isTranslating = false;
    this.lastResult = null;
    this.cooldownTimer = null;
    this.cooldownSeconds = 0;
    this.COOLDOWN_MS = 2000; // 2s anti doble-clic (free tier permite 30 RPM)
    this.isOffline = !navigator.onLine;
  }

  // ────────── INIT ──────────
  init() {
    try {
      console.log('[ThaiChat] Iniciando app...');

      // Si no hay API key → mostrar pantalla de onboarding
      const apiKey = Storage.getApiKey();
      console.log('[ThaiChat] API Key encontrada:', apiKey ? 'Sí' : 'No');

      if (!apiKey) {
        this.showOnboarding();
      } else {
        this.hideOnboarding();
      }

      // Cargar modelo guardado o usar por defecto
      const savedModel = Storage.getSettings().model || 'gemini-2.5-flash-lite';
      this.translator = new TranslationService(apiKey);
      this.translator.model = savedModel;
      console.log('[ThaiChat] Modelo:', savedModel);

      this.setupEventListeners();
      this.renderHistory();
      this.renderFavorites();
      this.loadChatHistory();
      this.setupOfflineDetection();

      // Registrar Service Worker para PWA (offline)
      registerServiceWorker();

      console.log('[ThaiChat] App inicializada correctamente');
    } catch (error) {
      console.error('[ThaiChat] Error al inicializar:', error);
    }
  }

  // ────────── EVENT LISTENERS ──────────
  setupEventListeners() {
    // Helper seguro: si el elemento no existe, no crashea
    const $ = (sel) => {
      const el = document.querySelector(sel);
      if (!el) console.warn(`[ThaiChat] Elemento no encontrado: ${sel}`);
      return el;
    };
    const $$ = (sel) => document.querySelectorAll(sel);

    // Chat: botón enviar
    $('#chat-send-btn')?.addEventListener('click', () => this.handleSend());

    // Chat: Enter = enviar, Shift+Enter = nueva línea
    $('#chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Chat: auto-resize del textarea
    $('#chat-input')?.addEventListener('input', () => {
      const el = $('#chat-input');
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    });

    // Navegación inferior (tabs)
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.switchTab(item.dataset.tab));
    });

    // Ajustes
    $('#settings-btn')?.addEventListener('click', () => this.showSettings());
    $('#close-settings')?.addEventListener('click', () => this.hideSettings());
    $('#save-settings')?.addEventListener('click', () => this.saveSettings());
    $('#settings-overlay')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideSettings();
    });

    // Borrar historial
    $('#clear-history')?.addEventListener('click', () => {
      if (Storage.getHistory().length === 0) return;
      Storage.clearHistory();
      this.renderHistory();
      this.clearChat();
      this.showToast('Historial borrado');
    });

    // Borrar favoritos
    $('#clear-favorites')?.addEventListener('click', () => {
      if (Storage.getFavorites().length === 0) return;
      Storage.clearFavorites();
      this.renderFavorites();
      this.showToast('Favoritos borrados');
    });

    // Frases rápidas → insertar en chat y enviar
    $$('.phrase-item').forEach(item => {
      item.addEventListener('click', () => {
        const text = item.dataset.phrase;
        const input = $('#chat-input');
        if (!input) return;
        input.value = text;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        this.switchTab('translate');
        setTimeout(() => this.handleSend(), 150);
      });
    });

    // Onboarding
    this.setupOnboarding();
  }

  // ────────── ONBOARDING ──────────
  showOnboarding() {
    const screen = document.getElementById('onboarding-screen');
    if (screen) {
      screen.classList.remove('hidden');
      screen.style.display = '';  // Reset any inline display style
      console.log('[ThaiChat] Mostrando onboarding');
    }
  }

  hideOnboarding() {
    const screen = document.getElementById('onboarding-screen');
    if (screen) {
      screen.classList.add('hidden');
      console.log('[ThaiChat] Ocultando onboarding');
    }
  }

  setupOnboarding() {
    const pasteBtn  = document.getElementById('onboarding-paste-btn');
    const startBtn  = document.getElementById('onboarding-start-btn');
    const keyInput  = document.getElementById('onboarding-key-input');
    const modelSel  = document.getElementById('onboarding-model-select');

    console.log('[ThaiChat] Configurando onboarding, elementos encontrados:', {
      pasteBtn: !!pasteBtn,
      startBtn: !!startBtn,
      keyInput: !!keyInput,
      modelSel: !!modelSel
    });

    // Botón pegar: lee del portapapeles con un toque
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        keyInput.value = text.trim();
        pasteBtn.textContent = '✅ Pegado';
        pasteBtn.classList.add('pasted');
        setTimeout(() => {
          pasteBtn.textContent = '📋 Pegar';
          pasteBtn.classList.remove('pasted');
        }, 2000);
      } catch {
        keyInput.focus();
        this.showToast('📱 Pega manualmente con Ctrl+V o mantén presionado');
      }
    });

    // Botón empezar
    startBtn.addEventListener('click', () => {
      console.log('[ThaiChat] Botón "Empezar" presionado');
      try {
        const key   = keyInput.value.trim();
        const model = modelSel.value;

        console.log('[ThaiChat] Key:', key ? `${key.substring(0, 8)}...` : '(vacía)');
        console.log('[ThaiChat] Modelo seleccionado:', model);

        if (!key) {
          keyInput.focus();
          keyInput.style.borderColor = 'var(--accent-coral)';
          this.showToast('⚠️ Pega tu API Key primero');
          return;
        }

        Storage.setApiKey(key);
        Storage.updateSettings({ model });
        this.translator.setApiKey(key);
        this.translator.model = model;

        this.hideOnboarding();
        this.showToast('🇹🇭 ¡Listo! Ya puedes traducir');
        console.log('[ThaiChat] Onboarding completado exitosamente');
      } catch (error) {
        console.error('[ThaiChat] Error en onboarding:', error);
        this.showToast('❌ Error: ' + error.message);
      }
    });

    // Enter en el input de key = empezar
    keyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') startBtn.click();
    });
  }

  // ────────── SEND MESSAGE (CHAT) ──────────
  async handleSend() {
    const inputEl = document.getElementById('chat-input');
    const input = inputEl.value.trim();
    if (!input || this.isTranslating || this.cooldownSeconds > 0) return;

    if (!Storage.getApiKey()) {
      this.showOnboarding();
      this.showToast('⚠️ Configura tu API key primero');
      return;
    }

    // Vibración al enviar
    this.haptic('send');

    // Limpiar input
    inputEl.value = '';
    inputEl.style.height = 'auto';

    // Ocultar pantalla de bienvenida si es el primer mensaje
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.remove();

    // Detectar idioma
    const isThai = /[\u0E00-\u0E7F]/.test(input);
    const direction = isThai ? 'th-es' : 'es-th';

    // Burbuja del usuario
    this.addUserBubble(input, isThai);

    // Indicador "traduciendo..."
    const typingEl = this.addTypingIndicator();

    this.isTranslating = true;
    this.setSendBtnState(true);

    try {
      const result = await this.translator.translate(input);

      // Quitar typing indicator
      typingEl.remove();

      // Guardar en historial
      const entry = {
        input,
        direction: result.direction,
        translation: result.translation,
        romanization: result.romanization || '',
        literal: result.literal || '',
        tone_note: result.tone_note || '',
        explanation: result.explanation || '',
        key_words: result.key_words || '',
        emotional_tone: result.emotional_tone || ''
      };
      Storage.addToHistory(entry);
      const history = Storage.getHistory();
      const savedEntry = history[0];

      // Burbuja de traducción
      this.addBotBubble(result, savedEntry);
      this.renderHistory();

      // Vibración al recibir traducción
      this.haptic('receive');

    } catch (error) {
      typingEl.remove();
      this.addErrorBubble(error.message);
      this.haptic('error');
    } finally {
      this.isTranslating = false;
      this.startCooldown();
    }
  }

  // ────────── BURBUJAS ──────────

  addUserBubble(text, isThai = false) {
    const msgs = document.getElementById('chat-messages');
    const now = new Date();
    const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

    const bubble = document.createElement('div');
    bubble.className = 'bubble-group bubble-group--user';
    bubble.innerHTML = `
      <div class="chat-bubble chat-bubble--user">
        <div class="chat-bubble__text${isThai ? ' thai-text' : ''}">${this.esc(text)}</div>
        <div class="chat-bubble__time">${time}</div>
      </div>
    `;
    msgs.appendChild(bubble);
    this.scrollToBottom();
  }

  addBotBubble(result, savedEntry) {
    const msgs = document.getElementById('chat-messages');
    const now = new Date();
    const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    const isThai = result.direction === 'es-th';
    const flag = isThai ? '🇹🇭 TH' : '🇪🇸 ES';

    // Construir detalles según dirección
    let detailsHTML = '';
    if (isThai) {
      // ES → TH: mostrar pronunciación, literal, nota
      if (result.romanization) detailsHTML += `<div class="chat-detail-row roman"><strong>📖 Pronunciación</strong>${this.esc(result.romanization)}</div>`;
      if (result.literal)      detailsHTML += `<div class="chat-detail-row"><strong>📝 Literal</strong>${this.esc(result.literal)}</div>`;
      if (result.tone_note)    detailsHTML += `<div class="chat-detail-row"><strong>💡 Nota</strong>${this.esc(result.tone_note)}</div>`;
    } else {
      // TH → ES: mostrar explicación, tono emocional, palabras clave
      if (result.explanation)   detailsHTML += `<div class="chat-detail-row"><strong>💬 Explicación</strong>${this.esc(result.explanation)}</div>`;
      if (result.emotional_tone) detailsHTML += `<div class="chat-detail-row"><strong>💕 Tono</strong>${this.esc(result.emotional_tone)}</div>`;
      if (result.key_words)     detailsHTML += `<div class="chat-detail-row"><strong>📚 Palabras clave</strong>${this.esc(result.key_words)}</div>`;
    }

    const hasDetails = detailsHTML.length > 0;
    const isFav = savedEntry ? Storage.isFavorite(savedEntry.id) : false;

    const bubble = document.createElement('div');
    bubble.className = 'bubble-group bubble-group--bot';
    bubble.innerHTML = `
      <div class="chat-bubble chat-bubble--bot" data-id="${savedEntry?.id || ''}">
        <div class="chat-bubble__lang">${flag}</div>
        <div class="chat-bubble__text${isThai ? ' thai-text' : ''}">${this.esc(result.translation)}</div>
        ${hasDetails ? `
        <div class="chat-bubble__details">
          <div class="chat-bubble__divider"></div>
          ${detailsHTML}
          <div class="chat-bubble__actions">
            <button class="chat-action-btn btn-copy-bubble" data-text="${this.escAttr(result.translation)}">📋 Copiar</button>
            <button class="chat-action-btn btn-fav-bubble ${isFav ? 'fav-active' : ''}" data-id="${savedEntry?.id || ''}">${isFav ? '⭐' : '☆'} Favorito</button>
          </div>
        </div>` : ''}
        <div class="chat-bubble__time">${time}${hasDetails ? ' • toca para ver más' : ''}</div>
      </div>
    `;

    // Expandir al tocar
    const bubbleEl = bubble.querySelector('.chat-bubble');
    if (hasDetails) {
      bubbleEl.addEventListener('click', (e) => {
        if (e.target.closest('.chat-action-btn')) return;
        bubbleEl.classList.toggle('expanded');
        const timeEl = bubbleEl.querySelector('.chat-bubble__time');
        if (bubbleEl.classList.contains('expanded')) {
          timeEl.textContent = time;
        } else {
          timeEl.textContent = time + ' • toca para ver más';
        }
      });
    }

    // Copiar desde burbuja
    const copyBtn = bubble.querySelector('.btn-copy-bubble');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyText(result.translation);
        copyBtn.textContent = '✅ Copiado';
        this.haptic('tap');
        setTimeout(() => copyBtn.textContent = '📋 Copiar', 1500);
      });
    }

    // Favorito desde burbuja
    const favBtn = bubble.querySelector('.btn-fav-bubble');
    if (favBtn && savedEntry) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(favBtn.dataset.id);
        if (Storage.isFavorite(id)) {
          Storage.removeFavorite(id);
          favBtn.textContent = '☆ Favorito';
          favBtn.classList.remove('fav-active');
          this.showToast('Eliminado de favoritos');
          this.haptic('tap');
        } else {
          Storage.addFavorite(savedEntry);
          favBtn.textContent = '⭐ Favorito';
          favBtn.classList.add('fav-active');
          this.showToast('⭐ Guardado en favoritos');
          this.haptic('success');
        }
        this.renderFavorites();
      });
    }

    msgs.appendChild(bubble);
    this.scrollToBottom();
  }

  addErrorBubble(message) {
    const msgs = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'bubble-group bubble-group--bot';
    el.innerHTML = `<div class="chat-bubble chat-bubble--bot" style="border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);"><div class="chat-bubble__text" style="color:#fca5a5;font-size:13px;">⚠️ ${this.esc(message)}</div></div>`;
    msgs.appendChild(el);
    this.scrollToBottom();
  }

  addTypingIndicator() {
    const msgs = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'bubble-group bubble-group--bot';
    el.innerHTML = `<div class="chat-typing"><span></span><span></span><span></span></div>`;
    msgs.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  scrollToBottom() {
    const msgs = document.getElementById('chat-messages');
    setTimeout(() => msgs.scrollTop = msgs.scrollHeight, 50);
  }

  // ────────── CARGAR HISTORIAL EN CHAT ──────────
  loadChatHistory() {
    const history = Storage.getHistory();
    if (history.length === 0) return;

    // Quitar welcome screen
    const welcome = document.getElementById('chat-welcome');
    if (welcome) welcome.remove();

    // Mostrar últimas 20 traducciones en orden cronológico
    const recent = [...history].reverse().slice(-20);

    // Separador "Conversación anterior"
    const msgs = document.getElementById('chat-messages');
    const divider = document.createElement('div');
    divider.className = 'chat-date-divider';
    divider.textContent = 'Conversación anterior';
    msgs.appendChild(divider);

    recent.forEach(entry => {
      const isThai = /[\u0E00-\u0E7F]/.test(entry.input);

      // Burbuja usuario (sin animación para no saturar)
      const userGroup = document.createElement('div');
      userGroup.className = 'bubble-group bubble-group--user';
      const entryTime = this.formatBubbleTime(entry.timestamp);
      userGroup.innerHTML = `<div class="chat-bubble chat-bubble--user" style="animation:none"><div class="chat-bubble__text${isThai ? ' thai-text' : ''}">${this.esc(entry.input)}</div><div class="chat-bubble__time">${entryTime}</div></div>`;
      msgs.appendChild(userGroup);

      // Burbuja bot simplificada del historial
      const botGroup = document.createElement('div');
      botGroup.className = 'bubble-group bubble-group--bot';
      const isThaiResult = entry.direction === 'es-th';
      const flag = isThaiResult ? '🇹🇭 TH' : '🇪🇸 ES';
      botGroup.innerHTML = `<div class="chat-bubble chat-bubble--bot" style="animation:none"><div class="chat-bubble__lang">${flag}</div><div class="chat-bubble__text${isThaiResult ? ' thai-text' : ''}">${this.esc(entry.translation)}</div><div class="chat-bubble__time">${entryTime}</div></div>`;
      msgs.appendChild(botGroup);
    });

    // Separador "Ahora"
    const nowDivider = document.createElement('div');
    nowDivider.className = 'chat-date-divider';
    nowDivider.textContent = 'Ahora';
    msgs.appendChild(nowDivider);

    this.scrollToBottom();
  }

  clearChat() {
    const msgs = document.getElementById('chat-messages');
    msgs.innerHTML = `
      <div class="chat-welcome" id="chat-welcome">
        <div class="chat-welcome__icon">🇹🇭</div>
        <div class="chat-welcome__title">ThaiChat</div>
        <div class="chat-welcome__sub">Escribe algo para traducir</div>
      </div>
    `;
  }

  // ────────── COOLDOWN ──────────
  startCooldown() {
    const btn = document.getElementById('chat-send-btn');
    this.cooldownSeconds = Math.ceil(this.COOLDOWN_MS / 1000);
    clearInterval(this.cooldownTimer);
    btn.disabled = true;

    this.cooldownTimer = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) {
        clearInterval(this.cooldownTimer);
        this.cooldownSeconds = 0;
        btn.disabled = false;
      }
    }, 1000);
  }

  setSendBtnState(disabled) {
    document.getElementById('chat-send-btn').disabled = disabled;
  }

  // ────────── RENDER HISTORY ──────────
  renderHistory() {
    const history = Storage.getHistory();
    const container = document.getElementById('history-list');

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          <div class="empty-text">No hay traducciones aún</div>
          <div class="empty-subtext">Tus traducciones aparecerán aquí</div>
        </div>
      `;
      return;
    }

    container.innerHTML = history.map(item => `
      <div class="history-item glass-card" data-id="${item.id}">
        <div class="history-time">${this.timeAgo(item.timestamp)}</div>
        <div class="history-input ${item.direction === 'th-es' ? 'thai-text' : ''}">${this.esc(item.input)}</div>
        <div class="history-arrow">${item.direction === 'es-th' ? '🇪🇸 → 🇹🇭' : '🇹🇭 → 🇪🇸'}</div>
        <div class="history-output ${item.direction === 'es-th' ? 'thai-text' : ''}">${this.esc(item.translation)}</div>
        ${item.romanization ? `<div class="history-roman">📖 ${this.esc(item.romanization)}</div>` : ''}
        <div class="history-actions">
          <button class="btn-icon-sm btn-copy-h" data-text="${this.escAttr(item.translation)}" title="Copiar">📋</button>
        </div>
      </div>
    `).join('');

    // Event listeners para copiar en historial
    container.querySelectorAll('.btn-copy-h').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyText(btn.dataset.text);
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = '📋', 1500);
      });
    });
  }

  // ────────── RENDER FAVORITES ──────────
  renderFavorites() {
    const favorites = Storage.getFavorites();
    const container = document.getElementById('favorites-list');

    if (favorites.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⭐</div>
          <div class="empty-text">Sin favoritos</div>
          <div class="empty-subtext">Guarda traducciones tocando ⭐</div>
        </div>
      `;
      return;
    }

    container.innerHTML = favorites.map(item => `
      <div class="favorite-item glass-card" data-id="${item.id}">
        <div class="history-input ${item.direction === 'th-es' ? 'thai-text' : ''}">${this.esc(item.input)}</div>
        <div class="history-arrow">${item.direction === 'es-th' ? '🇪🇸 → 🇹🇭' : '🇹🇭 → 🇪🇸'}</div>
        <div class="history-output ${item.direction === 'es-th' ? 'thai-text' : ''}">${this.esc(item.translation)}</div>
        ${item.romanization ? `<div class="history-roman">📖 ${this.esc(item.romanization)}</div>` : ''}
        <div class="history-actions">
          <button class="btn-icon-sm btn-copy-f" data-text="${this.escAttr(item.translation)}" title="Copiar">📋</button>
          <button class="btn-icon-sm btn-remove-fav" data-id="${item.id}" title="Quitar">❌</button>
        </div>
      </div>
    `).join('');

    // Copiar en favoritos
    container.querySelectorAll('.btn-copy-f').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyText(btn.dataset.text);
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = '📋', 1500);
      });
    });

    // Quitar favorito
    container.querySelectorAll('.btn-remove-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Storage.removeFavorite(parseInt(btn.dataset.id));
        this.renderFavorites();
        this.showToast('Eliminado de favoritos');
      });
    });
  }

  // ────────── TAB NAVIGATION ──────────
  switchTab(tab) {
    if (tab === this.currentTab) return;
    this.currentTab = tab;
    this.haptic('tap');

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tab}`);
    });
  }


  // ────────── SETTINGS ──────────
  showSettings() {
    const overlay = document.getElementById('settings-overlay');
    const input = document.getElementById('api-key-input');
    const modelSelect = document.getElementById('model-select');
    overlay.classList.add('visible');
    input.value = Storage.getApiKey();
    modelSelect.value = this.translator.model;
  }

  hideSettings() {
    document.getElementById('settings-overlay').classList.remove('visible');
  }

  saveSettings() {
    const key = document.getElementById('api-key-input').value.trim();
    const model = document.getElementById('model-select').value;
    if (!key) {
      this.showToast('⚠️ Ingresa una API key válida');
      return;
    }
    Storage.setApiKey(key);
    Storage.updateSettings({ model });
    this.translator.setApiKey(key);
    this.translator.model = model;
    this.hideSettings();
    this.showToast(`✅ Guardado — Usando ${model}`);
  }

  // ────────── COPY TEXT ──────────
  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('📋 Copiado al portapapeles');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('📋 Copiado al portapapeles');
    }
  }

  // ────────── TOAST ──────────
  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2500);
  }

  // ────────── HELPERS ──────────
  esc(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escAttr(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  timeAgo(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Hace un momento';
    if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)}h`;

    const day = date.getDate();
    const month = date.toLocaleString('es', { month: 'short' });
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month}, ${hours}:${mins}`;
  }

  formatBubbleTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    if (isToday) return `${hours}:${mins}`;
    const day = date.getDate();
    const month = date.toLocaleString('es', { month: 'short' });
    return `${day} ${month} ${hours}:${mins}`;
  }

  // ────────── HAPTIC FEEDBACK ──────────
  haptic(type = 'tap') {
    if (!navigator.vibrate) return;
    switch (type) {
      case 'tap':     navigator.vibrate(10); break;
      case 'send':    navigator.vibrate(15); break;
      case 'receive': navigator.vibrate([10, 30, 10]); break;
      case 'success': navigator.vibrate([10, 50, 20]); break;
      case 'error':   navigator.vibrate([30, 50, 30, 50, 30]); break;
      default:        navigator.vibrate(10);
    }
  }

  // ────────── OFFLINE DETECTION ──────────
  setupOfflineDetection() {
    // Crear el banner de offline
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.innerHTML = '📡 Sin conexión — puedes ver tu historial y favoritos';
    document.querySelector('.app').prepend(banner);

    const updateStatus = () => {
      this.isOffline = !navigator.onLine;
      banner.classList.toggle('visible', this.isOffline);
      if (!this.isOffline) {
        this.showToast('✅ Conexión restaurada');
        this.haptic('success');
      } else {
        this.haptic('error');
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Estado inicial
    if (this.isOffline) banner.classList.add('visible');
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  try {
    const app = new ThaiChatApp();
    app.init();
    window.__thaichat_loaded = true;
    console.log('[ThaiChat] DOMContentLoaded — app ready');
  } catch (error) {
    console.error('[ThaiChat] Error fatal al iniciar:', error);
  }
});
