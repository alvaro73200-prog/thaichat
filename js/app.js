// app.js — Controlador principal de ThaiChat Translator

import TranslationService from './api.js';
import * as Storage from './storage.js';
import { registerServiceWorker } from './pwa.js';
import * as i18n from './i18n.js';
import * as FirebaseChat from './firebase-chat.js';

// ==================== APP CLASS ====================
class ThaiChatApp {
  constructor() {
    this.translator = null;
    this.currentTab = 'translate';
    this.isTranslating = false;
    this.lastResult = null;
    this.cooldownTimer = null;
    this.cooldownSeconds = 0;
    this.COOLDOWN_MS = 4000;      // 4s cooldown normal entre mensajes
    this.COOLDOWN_429_MS = 20000; // 20s cooldown cuando hay rate limit
    this.isOffline = !navigator.onLine;
  }

  // ────────── INIT ──────────
  async init() {
    try {
      console.log('[ThaiChat] Iniciando app...');

      // 1. Magic Link Setup
      const hash = window.location.hash;
      if (hash.startsWith('#setup=')) {
        const base64Str = hash.replace('#setup=', '');
        try {
          const config = JSON.parse(atob(base64Str));
          if (config.firebase) Storage.setFirebaseConfig(config.firebase);
          if (config.apiKey) Storage.setApiKey(config.apiKey);
          history.replaceState(null, null, ' '); // Limpiar URL
          this.showToast('✅ Configuración mágica aplicada');
        } catch (e) {
          console.error("Link de configuración inválido", e);
        }
      }

      // Cargar idioma guardado (el idioma lo define el usuario más adelante, pero cargamos el fallback)
      const savedLang = Storage.getSettings().lang || 'es';
      i18n.setLang(savedLang);
      i18n.applyAll();
      this.syncLangToggles(savedLang);

      // Cargar zoom guardado
      const savedZoom = Storage.getSettings().zoom || 100;
      this.applyZoom(savedZoom);

      // Bloqueos UI de seguridad
      this.setupSecurityLocks();

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

      // Callback cuando la API rota automáticamente de modelo por 429
      this.translator.onModelSwitch = (newModel, prevModel) => {
        console.log(`[ThaiChat] Auto-switch: ${prevModel} → ${newModel} (429)`);
        Storage.updateSettings({ model: newModel });
        const modelShort = newModel.replace('gemini-', '').replace(/-/g, ' ');
        this.showToast(`${i18n.t('toast.model-switch')} ${modelShort}`);
        // Aplicar cooldown de 429 en la barra
        this._pendingCooldown429 = true;
      };

      this.setupEventListeners();
      this.renderHistory();
      this.renderFavorites();
      this.loadChatHistory();
      this.setupOfflineDetection();

      // Registrar Service Worker para PWA (offline)
      registerServiceWorker();

      // Iniciar Chat en vivo
      this.initLiveChat();

      // Setup Modo Admin
      this.setupAdminMode();

      console.log('[ThaiChat] App inicializada correctamente');
    } catch (error) {
      console.error('[ThaiChat] Error al inicializar:', error);
    }
  }

  // ────────── SECURITY LOCKS (PIN & USER) ──────────
  setupSecurityLocks() {
    const pin = Storage.getPin();
    const chatUser = Storage.getChatUser();

    if (!pin) {
      this.showPinScreen();
    } else if (!chatUser) {
      this.showUserSelectScreen();
    }
  }

  showPinScreen() {
    const screen = document.getElementById('pin-screen');
    const dots = document.querySelectorAll('#pin-dots span');
    const container = document.getElementById('pin-dots');
    if (!screen) return;
    
    screen.style.display = 'flex';
    let currentPin = '';

    document.querySelectorAll('.pin-btn:not(.pin-btn-dummy)').forEach(btn => {
      // Remover event listeners anteriores clonando
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', () => {
        if (newBtn.classList.contains('pin-btn-clear')) {
          currentPin = currentPin.slice(0, -1);
        } else {
          if (currentPin.length < 4) currentPin += newBtn.textContent;
        }

        // Update dots
        dots.forEach((dot, idx) => {
          dot.classList.toggle('filled', idx < currentPin.length);
        });

        // Check PIN
        if (currentPin.length === 4) {
          if (currentPin === '7878') {
            Storage.setPin('7878');
            screen.style.display = 'none';
            if (!Storage.getChatUser()) {
              this.showUserSelectScreen();
            }
          } else {
            container.classList.add('error');
            this.haptic('error');
            setTimeout(() => {
              container.classList.remove('error');
              currentPin = '';
              dots.forEach(d => d.classList.remove('filled'));
            }, 400);
          }
        }
      });
    });
  }

  showUserSelectScreen() {
    const screen = document.getElementById('user-select-screen');
    if (!screen) return;
    screen.style.display = 'flex';

    const input = document.getElementById('user-name-input');
    
    ['me', 'her'].forEach(user => {
      const btn = document.getElementById(`user-card-${user}`);
      if (!btn) return;
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', () => {
        const name = input.value.trim() || (user === 'me' ? 'Él' : 'Ella');
        Storage.setChatUser(user);
        Storage.setUserName(name);
        Storage.updateSettings({ profile: user, lang: user === 'me' ? 'es' : 'th' });
        
        // Aplicar idioma inmediatamente
        i18n.setLang(user === 'me' ? 'es' : 'th');
        i18n.applyAll();
        
        screen.style.display = 'none';
        
        // Recargar para aplicar configuración
        window.location.reload();
      });
    });
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

    // Botón pegar en barra de input → pega y envía automáticamente
    document.getElementById('chat-paste-btn')?.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) { this.showToast(i18n.t('toast.clipboard-empty')); return; }
        const inputEl = document.getElementById('chat-input');
        inputEl.value = text.trim();
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
        this.haptic('tap');
        setTimeout(() => this.handleSend(), 80);
      } catch {
        this.showToast(i18n.t('toast.paste-manual'));
      }
    });

    // Zoom header
    document.getElementById('zoom-out-btn')?.addEventListener('click', () => this.changeZoom(-10));
    document.getElementById('zoom-in-btn')?.addEventListener('click',  () => this.changeZoom(+10));

    // Zoom settings
    document.getElementById('settings-zoom-out')?.addEventListener('click', () => this.changeZoom(-10));
    document.getElementById('settings-zoom-in')?.addEventListener('click',  () => this.changeZoom(+10));
    document.getElementById('settings-zoom-reset')?.addEventListener('click', () => { this.applyZoom(100); Storage.updateSettings({ zoom: 100 }); });

    // Lang toggles (onboarding + settings)
    document.querySelectorAll('.lang-toggle').forEach(toggle => {
      toggle.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const lang = btn.dataset.lang;
          i18n.setLang(lang);
          i18n.applyAll();
          this.syncLangToggles(lang);
          Storage.updateSettings({ lang });
          this.haptic('tap');
        });
      });
    });

    // Profile toggles
    document.querySelectorAll('.profile-toggle').forEach(toggle => {
      toggle.querySelectorAll('.profile-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const profile = btn.dataset.profile;
          Storage.updateSettings({ profile });
          this.syncProfileToggles(profile);
          this.haptic('tap');
          this.loadChatHistory(); // Re-render chat con el nuevo perfil
          this.renderHistory();
        });
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
    const isThaiInput = /[\u0E00-\u0E7F]/.test(input);
    const direction = isThaiInput ? 'th-es' : 'es-th';

    // Burbuja temporal (cargando)
    const bubbleEl = this.addDualBubble(input, null, isThaiInput, null, true);

    this.isTranslating = true;
    this.setSendBtnState(true);

    try {
      const result = await this.translator.translate(input);
      result.inputText = input; // guardamos para lazy explain

      // Guardar en historial (solo traducción, sin detalles)
      const entry = {
        input,
        direction: result.direction,
        translation: result.translation
      };
      Storage.addToHistory(entry);
      const history = Storage.getHistory();
      const savedEntry = history[0];

      // Actualizar burbuja con la traducción real
      this.updateDualBubble(bubbleEl, result.translation, savedEntry);
      this.renderHistory(); // Re-render everything smoothly

      // Vibración al recibir traducción
      this.haptic('receive');

    } catch (error) {
      // Remover la burbuja de carga que quedó en espera
      if (bubbleEl && bubbleEl.parentNode) bubbleEl.remove();

      if (error.message === 'RATE_LIMIT_ALL') {
        this.showToast(i18n.t('toast.all-busy'));
        this.haptic('error');
        this.isTranslating = false;
        this.startCooldown(this.COOLDOWN_429_MS, true);
        return;
      }
      this.addErrorBubble(error.message, input);
      this.haptic('error');
    } finally {
      this.isTranslating = false;
      // Si hubo un auto-switch de modelo, aplicamos cooldown largo
      const cooldownMs = this._pendingCooldown429 ? this.COOLDOWN_429_MS : this.COOLDOWN_MS;
      const isUrgent = this._pendingCooldown429;
      this._pendingCooldown429 = false;
      this.startCooldown(cooldownMs, isUrgent);
    }
  }

  // ────────── BURBUJAS DUAL CHAT ──────────

  addDualBubble(input, translation, isThaiInput, savedEntry, isLoading = false) {
    const profile = Storage.getSettings().profile || 'me';
    const isMe = (profile === 'me' && !isThaiInput) || (profile === 'her' && isThaiInput);

    const msgs = document.getElementById('chat-messages');
    const now = new Date();
    const time = savedEntry ? this.formatBubbleTime(savedEntry.timestamp) : now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');

    const sideClass = isMe ? 'bubble-group--user' : 'bubble-group--bot';
    const bubbleClass = isMe ? 'chat-bubble--user' : 'chat-bubble--bot';
    const isFav = savedEntry ? Storage.isFavorite(savedEntry.id) : false;

    const bubbleGroup = document.createElement('div');
    bubbleGroup.className = `bubble-group ${sideClass}`;

    let avatarHTML = '';
    if (!isMe) {
      avatarHTML = `<div class="chat-bubble-avatar">${profile === 'me' ? '👱‍♀️' : '👦'}</div>`;
    }

    bubbleGroup.innerHTML = `
      ${avatarHTML}
      <div class="chat-bubble ${bubbleClass}" data-id="${savedEntry?.id || ''}" title="${i18n.t('toast.copied')}">
        <div class="chat-bubble__text original-text${isThaiInput ? ' thai-text' : ''}">${this.esc(input)}</div>
        <div class="chat-bubble__divider"></div>
        <div class="chat-bubble__text translated-text${(!isThaiInput && !isLoading) ? ' thai-text' : ''}">${isLoading ? '<span class="typing-text">...</span>' : this.esc(translation)}</div>
        <div class="chat-bubble__meta" style="${isLoading ? 'display:none;' : ''}">
          <span class="chat-bubble__time">${time}</span>
          <button class="bubble-expand-btn" aria-label="Ver explicación">&#9660;</button>
        </div>
        <div class="chat-bubble__explain" style="display:none;"></div>
        <div class="chat-bubble__actions" style="display:none;">
          <button class="chat-action-btn btn-fav-bubble ${isFav ? 'fav-active' : ''}" data-id="${savedEntry?.id || ''}">${isFav ? '⭐' : '☆'} ${i18n.t('btn.favorite')}</button>
        </div>
      </div>
    `;

    const bubbleEl = bubbleGroup.querySelector('.chat-bubble');
    
    // Si no está cargando, configuramos eventos
    if (!isLoading) {
      this.attachBubbleEvents(bubbleEl, {
        input, translation, direction: isThaiInput ? 'th-es' : 'es-th', savedEntry
      });
    }

    msgs.appendChild(bubbleGroup);
    this.scrollToBottom();
    
    return bubbleGroup;
  }

  updateDualBubble(bubbleGroup, translation, savedEntry) {
    const bubbleEl = bubbleGroup.querySelector('.chat-bubble');
    const translatedText = bubbleEl.querySelector('.translated-text');
    const metaEl = bubbleEl.querySelector('.chat-bubble__meta');
    
    const isThaiTranslation = !bubbleEl.querySelector('.original-text').classList.contains('thai-text');
    if (isThaiTranslation) {
      translatedText.classList.add('thai-text');
    }
    
    translatedText.innerHTML = this.esc(translation);
    metaEl.style.display = '';

    // Guardar id
    if (savedEntry) {
      bubbleEl.dataset.id = savedEntry.id;
      bubbleEl.querySelector('.btn-fav-bubble').dataset.id = savedEntry.id;
    }

    // Configurar eventos
    const input = bubbleEl.querySelector('.original-text').textContent;
    this.attachBubbleEvents(bubbleEl, {
      input, translation, direction: isThaiTranslation ? 'es-th' : 'th-es', savedEntry
    });
  }

  attachBubbleEvents(bubbleEl, result) {
    const expandBtn = bubbleEl.querySelector('.bubble-expand-btn');
    const explainEl = bubbleEl.querySelector('.chat-bubble__explain');
    const actionsEl = bubbleEl.querySelector('.chat-bubble__actions');
    const favBtn = bubbleEl.querySelector('.btn-fav-bubble');

    // Toque = copiar solo la traducción (para pegar directo en WhatsApp/LINE)
    bubbleEl.addEventListener('click', (e) => {
      if (e.target.closest('.bubble-expand-btn') || e.target.closest('.btn-fav-bubble')) return;
      this.copyText(result.translation);
      this.flashBubble(bubbleEl);
      this.haptic('tap');
    });

    let explanationLoaded = false;
    expandBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isExpanded = bubbleEl.classList.contains('expanded');

      if (isExpanded) {
        bubbleEl.classList.remove('expanded');
        explainEl.style.display = 'none';
        actionsEl.style.display = 'none';
        expandBtn.innerHTML = '&#9660;';
        this.haptic('tap');
        return;
      }

      bubbleEl.classList.add('expanded');
      expandBtn.innerHTML = '&#9650;';
      actionsEl.style.display = '';
      this.haptic('tap');

      if (explanationLoaded) {
        explainEl.style.display = '';
        setTimeout(() => bubbleEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
        return;
      }

      explainEl.style.display = '';
      explainEl.innerHTML = `<div class="explain-loading">🔄 ${i18n.t('explain.loading')}</div>`;
      setTimeout(() => bubbleEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);

      try {
        const detail = await this.translator.explain(result.input, result.translation, result.direction);
        explanationLoaded = true;
        
        const isThai = result.direction === 'es-th';
        let html = '<div class="chat-bubble__divider"></div>';
        if (isThai) {
          if (detail.romanization) html += `<div class="chat-detail-row roman"><strong>${i18n.t('explain.pronun')}</strong>${this.esc(detail.romanization)}</div>`;
          if (detail.literal)      html += `<div class="chat-detail-row"><strong>${i18n.t('explain.literal')}</strong>${this.esc(detail.literal)}</div>`;
          if (detail.tone_note)    html += `<div class="chat-detail-row"><strong>${i18n.t('explain.note')}</strong>${this.esc(detail.tone_note)}</div>`;
        } else {
          if (detail.explanation)    html += `<div class="chat-detail-row"><strong>${i18n.t('explain.explanation')}</strong>${this.esc(detail.explanation)}</div>`;
          if (detail.emotional_tone) html += `<div class="chat-detail-row"><strong>${i18n.t('explain.tone')}</strong>${this.esc(detail.emotional_tone)}</div>`;
          if (detail.key_words)      html += `<div class="chat-detail-row"><strong>${i18n.t('explain.keywords')}</strong>${this.esc(detail.key_words)}</div>`;
        }
        explainEl.innerHTML = html;

      } catch (err) {
        explainEl.innerHTML = `
          <div class="explain-error">⚠️ ${this.esc(err.message)}</div>
          <button class="chat-retry-btn explain-retry">🔄 ${i18n.t('explain.retry')}</button>
        `;
        explainEl.querySelector('.explain-retry')?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          explanationLoaded = false;
          expandBtn.click();
        });
      }
    });

    if (favBtn && result.savedEntry) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(favBtn.dataset.id);
        if (Storage.isFavorite(id)) {
          Storage.removeFavorite(id);
          favBtn.textContent = `☆ ${i18n.t('btn.favorite')}`;
          favBtn.classList.remove('fav-active');
          this.showToast(i18n.t('toast.removed-fav'));
          this.haptic('tap');
        } else {
          Storage.addFavorite(result.savedEntry);
          favBtn.textContent = `⭐ ${i18n.t('btn.favorited')}`;
          favBtn.classList.add('fav-active');
          this.showToast(i18n.t('toast.saved-fav'));
          this.haptic('success');
        }
        this.renderFavorites();
      });
    }
  }

  addErrorBubble(message, originalText = '') {
    const msgs = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = 'bubble-group bubble-group--bot';
    el.innerHTML = `
      <div class="chat-bubble chat-bubble--bot chat-bubble--error">
        <div class="chat-bubble__text">⚠️ ${this.esc(message)}</div>
        ${originalText ? `<button class="chat-retry-btn" data-text="${this.escAttr(originalText)}">🔄 Reintentar</button>` : ''}
      </div>
    `;

    // Botón reintentar
    const retryBtn = el.querySelector('.chat-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        el.remove(); // Quitar burbuja de error
        const inputEl = document.getElementById('chat-input');
        inputEl.value = retryBtn.dataset.text;
        this.haptic('tap');
        setTimeout(() => this.handleSend(), 80);
      });
    }

    msgs.appendChild(el);
    this.scrollToBottom();
  }

  // Flash visual al copiar
  flashBubble(el) {
    el.classList.add('bubble-copied');
    setTimeout(() => el.classList.remove('bubble-copied'), 600);
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
    const msgs = document.getElementById('chat-messages');

    // Limpiar el contenedor excepto si está vacío (mantener welcome)
    if (history.length === 0) return;
    msgs.innerHTML = '';

    // Mostrar últimas 20 traducciones en orden cronológico
    const recent = [...history].reverse().slice(-20);

    // Separador "Conversación anterior"
    const divider = document.createElement('div');
    divider.className = 'chat-date-divider';
    divider.textContent = i18n.t('chat.prev') || 'Conversación anterior';
    msgs.appendChild(divider);

    recent.forEach(entry => {
      // detect if it's Thai input by checking the direction
      // If direction is th-es, it means input was Thai.
      // If direction is es-th, input was Spanish.
      // Fallback: check chars if direction is missing for some old entries.
      const isThaiInput = entry.direction ? entry.direction === 'th-es' : /[\u0E00-\u0E7F]/.test(entry.input);
      
      this.addDualBubble(entry.input, entry.translation, isThaiInput, entry, false);
    });

    // Separador "Ahora"
    const nowDivider = document.createElement('div');
    nowDivider.className = 'chat-date-divider';
    nowDivider.textContent = i18n.t('chat.now') || 'Ahora';
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
  startCooldown(durationMs, urgent = false) {
    const ms = durationMs ?? this.COOLDOWN_MS;
    const btn = document.getElementById('chat-send-btn');
    const bar = document.getElementById('rate-limit-bar');
    const countdown = document.getElementById('rate-limit-countdown');
    const fill = document.getElementById('rate-limit-fill');
    const textEl = document.getElementById('rate-limit-text');

    this.cooldownSeconds = Math.ceil(ms / 1000);
    const totalSeconds = this.cooldownSeconds;

    clearInterval(this.cooldownTimer);
    btn.disabled = true;

    // Mostrar barra
    if (bar) {
      bar.classList.add('visible');
      bar.classList.toggle('urgent', urgent);
      if (fill) {
        // Sin transición en el inicio para que empiece al 100%
        fill.style.transition = 'none';
        fill.style.width = '100%';
        // Pequeño delay para activar la transición de reducción
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            fill.style.transition = `width ${ms}ms linear`;
            fill.style.width = '0%';
          });
        });
      }
      if (countdown) countdown.textContent = this.cooldownSeconds;
      if (textEl) {
        const waitLabel = urgent
          ? i18n.t('ratelimit.busy')
          : i18n.t('ratelimit.wait');
        const sLabel = i18n.t('ratelimit.s');
        textEl.innerHTML = `${waitLabel} <span id="rate-limit-countdown">${this.cooldownSeconds}</span>${sLabel}`;
      }
    }

    this.cooldownTimer = setInterval(() => {
      this.cooldownSeconds--;
      const cd = document.getElementById('rate-limit-countdown');
      if (cd) cd.textContent = this.cooldownSeconds;
      if (this.cooldownSeconds <= 0) {
        clearInterval(this.cooldownTimer);
        this.cooldownSeconds = 0;
        btn.disabled = false;
        // Ocultar barra
        if (bar) {
          bar.classList.remove('visible', 'urgent');
        }
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

  // ────────── ZOOM ──────────
  applyZoom(level) {
    this._zoomLevel = Math.min(150, Math.max(60, level));
    // Solo escalar el texto de las burbujas del chat, no toda la UI
    document.documentElement.style.setProperty('--chat-text-zoom', (this._zoomLevel / 100).toFixed(2));
    const display = document.getElementById('zoom-level-display');
    if (display) display.textContent = `${this._zoomLevel}%`;
  }

  changeZoom(delta) {
    const current = this._zoomLevel || 100;
    const next = Math.min(150, Math.max(60, current + delta));
    this.applyZoom(next);
    Storage.updateSettings({ zoom: next });
    this.haptic('tap');
  }

  // ────────── LANG SYNC ──────────
  syncLangToggles(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('lang-btn--active', btn.dataset.lang === lang);
    });
  }

  syncProfileToggles(profile) {
    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.classList.toggle('profile-btn--active', btn.dataset.profile === profile);
    });
  }

  // ────────── HELPERS ──────────
  esc(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  escAttr(text) {
    if (text === null || text === undefined) return '';
    return String(text)
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

  // ────────── LIVE CHAT & ADMIN ──────────
  async initLiveChat() {
    const liveSetup = document.getElementById('live-setup');
    const liveChat = document.getElementById('live-chat');
    
    // Magic Link Generation
    document.getElementById('settings-share-setup-btn')?.addEventListener('click', () => {
      const fbConfig = Storage.getFirebaseConfig();
      const apiKey = Storage.getApiKey();
      if (!fbConfig) {
        this.showToast('⚠️ Configura Firebase primero para compartir');
        return;
      }
      const setupObj = { firebase: fbConfig, apiKey: apiKey };
      const base64Str = btoa(JSON.stringify(setupObj));
      const url = `${window.location.origin}${window.location.pathname}#setup=${base64Str}`;
      
      navigator.clipboard.writeText(url).then(() => {
        this.showToast(i18n.t('live.setup-copied') || '✅ Link copiado. Envíalo a la otra persona.');
      }).catch(err => {
        console.error('Error copiando al portapapeles', err);
      });
    });

    // Guardar config en Modal
    const configInput = document.getElementById('settings-firebase-config');
    if (configInput) {
      const currentConfig = Storage.getFirebaseConfig();
      if (currentConfig) configInput.value = JSON.stringify(currentConfig, null, 2);
      
      configInput.addEventListener('change', () => {
        try {
          const val = configInput.value.trim();
          if (!val) {
            Storage.setFirebaseConfig(null);
            return;
          }
          // Usamos Function en vez de JSON.parse para aceptar el objeto literal de JS de Firebase directamente
          const json = Function('"use strict";return (' + val + ')')();
          Storage.setFirebaseConfig(json);
          this.showToast('✅ Firebase Config guardado');
          window.location.reload();
        } catch(e) {
          this.showToast('❌ Formato inválido. Pega el objeto tal como sale de Firebase.');
        }
      });
    }

    // Flujo normal de init
    const fbConfig = Storage.getFirebaseConfig();
    if (!fbConfig) {
      if(liveSetup) liveSetup.style.display = 'flex';
      if(liveChat) liveChat.style.display = 'none';
      
      document.getElementById('live-go-settings-btn')?.addEventListener('click', () => {
        document.getElementById('settings-modal').classList.add('visible');
      });
      return;
    }

    if(liveSetup) liveSetup.style.display = 'none';
    if(liveChat) liveChat.style.display = 'flex';

    try {
      await FirebaseChat.initFirebase(fbConfig);
      await FirebaseChat.signIn();
      
      const userType = Storage.getChatUser(); // 'me', 'her', o 'admin'
      
      // Listen messages
      FirebaseChat.listenMessages(userType, (msg) => {
        this.renderLiveMessage(msg);
      });

      // Typing and Read status
      FirebaseChat.listenStatus((status) => {
        const indicator = document.getElementById('live-typing-indicator');
        if (!indicator) return;
        
        const isOtherTyping = userType === 'me' ? status.herTyping : status.meTyping;
        indicator.style.display = isOtherTyping ? 'flex' : 'none';

        // Read Receipts logic could go here
      });

      this.setupLiveInputs(userType);
      
    } catch(err) {
      console.error('[Firebase] Error:', err);
      document.getElementById('live-status').innerHTML = '🔴 Error de conexión';
      document.getElementById('live-status').style.color = '#ef4444';
    }
  }

  setupLiveInputs(userType) {
    const input = document.getElementById('live-input');
    const sendBtn = document.getElementById('live-send-btn');
    const attachBtn = document.getElementById('live-attach-btn');
    const mediaUpload = document.getElementById('live-media-upload');
    const micBtn = document.getElementById('live-mic-btn');
    
    let typingTimeout;
    
    // Auto-resize y Toggle Send/Mic
    input?.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      
      const hasText = input.value.trim().length > 0;
      if (sendBtn) sendBtn.style.display = hasText ? 'flex' : 'none';
      if (micBtn) micBtn.style.display = hasText ? 'none' : 'flex';

      FirebaseChat.setTypingStatus(userType, true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => FirebaseChat.setTypingStatus(userType, false), 2000);
    });

    const triggerSend = async () => {
      const text = input.value.trim();
      if (!text) return;
      
      input.value = '';
      input.style.height = 'auto';
      if (sendBtn) sendBtn.style.display = 'none';
      if (micBtn) micBtn.style.display = 'flex';
      
      FirebaseChat.setTypingStatus(userType, false);
      
      try {
        const isThaiInput = /[\u0E00-\u0E7F]/.test(text);
        const direction = isThaiInput ? 'th-es' : 'es-th';
        
        // Optimistic UI could be added here
        
        const result = await this.translator.translate(text);
        
        await FirebaseChat.sendMessage({
          text: text,
          translation: result.translation,
          direction: direction,
          sender: userType,
          type: 'text'
        });
        this.haptic('send');
      } catch(e) {
        this.showToast('❌ Error: ' + e.message);
      }
    };

    sendBtn?.addEventListener('click', triggerSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        triggerSend();
      }
    });

    // Adjuntos
    attachBtn?.addEventListener('click', () => mediaUpload?.click());
    mediaUpload?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 700 * 1024) {
        this.showToast('❌ Archivo muy grande (máx 700KB para modo base64)');
        return;
      }
      
      this.showToast('⏳ Subiendo archivo...');
      try {
        const { url, type } = await FirebaseChat.sendMedia(file, userType);
        await FirebaseChat.sendMessage({
          text: '', translation: '', direction: '',
          sender: userType, type: type, mediaUrl: url
        });
        this.showToast('✅ Enviado');
      } catch(err) {
        this.showToast('❌ Error al subir');
      }
    });

    // Notas de voz
    this.setupVoiceRecording(micBtn, userType);
  }

  setupVoiceRecording(micBtn, userType) {
    if (!micBtn) return;
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    micBtn.addEventListener('click', async () => {
      if (isRecording) {
        // Detener grabación
        mediaRecorder.stop();
        micBtn.classList.remove('recording');
        isRecording = false;
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          
          this.showToast('⏳ Subiendo y traduciendo audio...');
          try {
            // Subir audio
            const { url, type } = await FirebaseChat.sendMedia(audioBlob, userType);
            
            // TODO: Podríamos pedirle a Gemini que lo escuche y lo traduzca si usamos la File API.
            // Por ahora, solo mandamos el audio (se podría mejorar).
            await FirebaseChat.sendMessage({
              text: '🎤 Nota de voz', translation: '🎤 ข้อความเสียง', direction: 'es-th',
              sender: userType, type: type, mediaUrl: url
            });
            this.showToast('✅ Audio enviado');
          } catch(err) {
            console.error(err);
            this.showToast('❌ Error con el audio');
          }
        };

        mediaRecorder.start();
        micBtn.classList.add('recording');
        isRecording = true;
        this.haptic('tap');
      } catch(err) {
        this.showToast('⚠️ No se pudo acceder al micrófono');
      }
    });
  }

  renderLiveMessage(msg) {
    const msgsContainer = document.getElementById('live-messages');
    if (!msgsContainer) return;
    
    // Si ya existe, podríamos estar actualizando (ej: borrado)
    const existing = document.querySelector(`.chat-bubble[data-id="${msg.id}"]`);
    if (existing) return; // Por simplicidad, no actualizamos in-place en este bloque
    
    const currentUser = Storage.getChatUser();
    const isMe = msg.sender === currentUser;
    const isAdmin = currentUser === 'admin';
    
    // Si es admin, mostramos la procedencia real en vez de relative "isMe"
    const sideClass = (isMe || (isAdmin && msg.sender === 'me')) ? 'bubble-group--user' : 'bubble-group--bot';
    const bubbleClass = (isMe || (isAdmin && msg.sender === 'me')) ? 'chat-bubble--user' : 'chat-bubble--bot';

    const timeStr = new Date(msg.timestamp?.toDate() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    const group = document.createElement('div');
    group.className = `bubble-group ${sideClass}`;

    let avatarHTML = '';
    if (!isMe && !isAdmin) avatarHTML = `<div class="chat-bubble-avatar">${currentUser === 'me' ? '👱‍♀️' : '👦'}</div>`;
    
    let adminBadge = isAdmin ? `<div class="bubble-sender-badge">${msg.sender === 'me' ? '👦' : '👱‍♀️'}</div>` : '';

    let contentHTML = '';
    if (msg.type === 'image') {
      contentHTML = `<img src="${msg.mediaUrl}" class="chat-bubble__image" onclick="window.open('${msg.mediaUrl}', '_blank')">`;
    } else if (msg.type === 'video') {
      contentHTML = `<video src="${msg.mediaUrl}" class="chat-bubble__video" controls></video>`;
    } else if (msg.type === 'audio') {
      contentHTML = `<audio src="${msg.mediaUrl}" class="chat-bubble__audio" controls></audio>
                     <div class="chat-bubble__divider"></div>
                     <div class="chat-bubble__text translated-text">${this.esc(msg.translation)}</div>`;
    } else {
      contentHTML = `<div class="chat-bubble__text original-text">${this.esc(msg.text)}</div>
                     <div class="chat-bubble__divider"></div>
                     <div class="chat-bubble__text translated-text thai-text">${this.esc(msg.translation)}</div>`;
    }

    group.innerHTML = `
      ${avatarHTML}
      <div class="chat-bubble ${bubbleClass} chat-bubble--${msg.type}" data-id="${msg.id}">
        ${adminBadge}
        ${contentHTML}
        <div class="chat-bubble__meta">
          <span class="chat-bubble__time">${timeStr}</span>
          ${isMe ? '<span class="bubble-read-receipt">✓✓</span>' : ''}
        </div>
      </div>
    `;

    // Menu contextual para borrar (press and hold)
    if (!isAdmin) {
      const bubble = group.querySelector('.chat-bubble');
      let pressTimer;
      bubble.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
          if (confirm('¿Borrar mensaje para ti?')) {
            FirebaseChat.deleteForMe(msg.id, currentUser);
            group.remove();
          }
        }, 800);
      });
      bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
      bubble.addEventListener('touchcancel', () => clearTimeout(pressTimer));
    }

    msgsContainer.appendChild(group);
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
    
    // Actualizar leídos
    if (!isMe && !isAdmin) {
      FirebaseChat.setLastRead(currentUser, msg.id);
      this.haptic('receive');
    }
  }

  setupAdminMode() {
    let logoClicks = 0;
    let clickTimer;
    
    const logo = document.querySelector('.header__logo');
    logo?.addEventListener('click', () => {
      logoClicks++;
      clearTimeout(clickTimer);
      
      if (logoClicks >= 5) {
        logoClicks = 0;
        const pwd = prompt('🔐 Modo Admin: Ingrese contraseña');
        if (pwd === 'admin7878') {
          Storage.setChatUser('admin');
          this.showToast('✅ Modo Admin Activado');
          window.location.reload();
        }
      }
      
      clickTimer = setTimeout(() => logoClicks = 0, 1000);
    });

    if (Storage.getChatUser() === 'admin') {
      const banner = document.getElementById('admin-banner');
      if (banner) banner.style.display = 'flex';
      
      document.getElementById('exit-admin-btn')?.addEventListener('click', () => {
        Storage.setChatUser('me'); // O podríamos mandarlo a re-seleccionar
        window.location.reload();
      });
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
