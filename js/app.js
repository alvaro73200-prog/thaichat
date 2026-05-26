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
  }

  // ────────── INIT ──────────
  init() {
    // Si no hay API key configurada, abrir modal de ajustes al inicio
    if (!Storage.getApiKey()) {
      setTimeout(() => this.showSettings(), 500);
    }

    // Cargar modelo guardado o usar por defecto
    const savedModel = Storage.getSettings().model || 'gemini-2.5-flash-lite';
    this.translator = new TranslationService(Storage.getApiKey());
    this.translator.model = savedModel;
    this.setupEventListeners();
    this.renderHistory();
    this.renderFavorites();
    
    // Registrar Service Worker para PWA (offline)
    registerServiceWorker();
  }

  // ────────── EVENT LISTENERS ──────────
  setupEventListeners() {
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // Traducir
    $('#translate-btn').addEventListener('click', () => this.handleTranslate());

    // Enter para traducir (Shift+Enter = nueva línea)
    $('#input-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleTranslate();
      }
    });

    // Input: contador de caracteres + detección de idioma
    $('#input-text').addEventListener('input', () => {
      this.updateCharCount();
      this.updateDirection();
    });

    // Borrar input
    $('#btn-clear-input').addEventListener('click', () => {
      $('#input-text').value = '';
      this.updateCharCount();
      this.updateDirection();
      $('#input-text').focus();
    });

    // Navegación inferior (tabs)
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.switchTab(item.dataset.tab));
    });

    // Ajustes
    $('#settings-btn').addEventListener('click', () => this.showSettings());
    $('#close-settings').addEventListener('click', () => this.hideSettings());
    $('#save-settings').addEventListener('click', () => this.saveSettings());
    $('#settings-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideSettings();
    });

    // Borrar historial
    $('#clear-history').addEventListener('click', () => {
      if (Storage.getHistory().length === 0) return;
      Storage.clearHistory();
      this.renderHistory();
      this.showToast('Historial borrado');
    });

    // Borrar favoritos
    $('#clear-favorites').addEventListener('click', () => {
      if (Storage.getFavorites().length === 0) return;
      Storage.clearFavorites();
      this.renderFavorites();
      this.showToast('Favoritos borrados');
    });

    // Frases rápidas
    $$('.phrase-item').forEach(item => {
      item.addEventListener('click', () => {
        const text = item.dataset.phrase;
        $('#input-text').value = text;
        this.switchTab('translate');
        this.updateCharCount();
        this.updateDirection();
        // Auto-traducir
        setTimeout(() => this.handleTranslate(), 200);
      });
    });

    // Delegación de eventos para botones dinámicos en result-area
    $('#result-area').addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.btn-copy');
      const favBtn = e.target.closest('.btn-fav');

      if (copyBtn) this.handleCopy(copyBtn);
      if (favBtn) this.handleFavorite(favBtn);
    });
  }

  // ────────── TRANSLATE ──────────
  async handleTranslate() {
    const input = document.getElementById('input-text').value.trim();
    if (!input || this.isTranslating || this.cooldownSeconds > 0) return;

    // Verificar API key
    if (!Storage.getApiKey()) {
      this.showSettings();
      this.showToast('⚠️ Configura tu API key primero');
      return;
    }

    this.setLoading(true);
    this.hideError();

    try {
      const result = await this.translator.translate(input);

      // Guardar resultado con ID para favoritos
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

      // Guardar en historial
      Storage.addToHistory(entry);

      // Obtener el entry con ID del historial
      const history = Storage.getHistory();
      this.lastResult = history[0];

      // Renderizar
      this.renderResult(result, input);
      this.renderHistory();

    } catch (error) {
      this.showError(error.message);
    } finally {
      this.setLoading(false);
      this.startCooldown();
    }
  }

  // ────────── COOLDOWN (anti rate-limit) ──────────
  startCooldown() {
    const btn = document.getElementById('translate-btn');
    const btnText = btn.querySelector('.btn-text');
    this.cooldownSeconds = Math.ceil(this.COOLDOWN_MS / 1000);

    clearInterval(this.cooldownTimer);
    btn.disabled = true;

    this.cooldownTimer = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) {
        clearInterval(this.cooldownTimer);
        this.cooldownSeconds = 0;
        btn.disabled = false;
        btnText.textContent = '🔄 Traducir';
      } else {
        btnText.textContent = `⏳ Espera ${this.cooldownSeconds}s...`;
      }
    }, 1000);
  }

  // ────────── RENDER RESULT ──────────
  renderResult(result, input) {
    const area = document.getElementById('result-area');
    area.classList.remove('hidden');
    area.classList.remove('fade-in');
    // Trigger reflow for animation
    void area.offsetWidth;
    area.classList.add('fade-in');

    const isFav = this.lastResult ? Storage.isFavorite(this.lastResult.id) : false;

    if (result.direction === 'es-th') {
      // Español/Inglés → Tailandés
      area.innerHTML = `
        <div class="result-direction">
          <span class="flag">🇪🇸</span>
          <span class="arrow">→</span>
          <span class="flag">🇹🇭</span>
        </div>
        <div class="result-original">${this.esc(input)}</div>
        <div class="result-translation-wrapper">
          <div class="result-translation thai-text">${this.esc(result.translation)}</div>
        </div>
        <div class="result-section">
          <div class="result-label">📖 Pronunciación</div>
          <div class="result-romanization">${this.esc(result.romanization || '')}</div>
        </div>
        ${result.literal ? `
        <div class="result-section">
          <div class="result-label">📝 Literal</div>
          <div class="result-literal">${this.esc(result.literal)}</div>
        </div>` : ''}
        ${result.tone_note ? `
        <div class="result-section">
          <div class="result-label">💡 Nota</div>
          <div class="result-note">${this.esc(result.tone_note)}</div>
        </div>` : ''}
        <div class="result-actions">
          <button class="btn-icon btn-copy" title="Copiar traducción">
            <span class="icon">📋</span> Copiar
          </button>
          <button class="btn-icon btn-fav ${isFav ? 'active' : ''}" title="Favorito">
            <span class="icon">${isFav ? '⭐' : '☆'}</span> Favorito
          </button>
        </div>
      `;
    } else {
      // Tailandés → Español
      area.innerHTML = `
        <div class="result-direction">
          <span class="flag">🇹🇭</span>
          <span class="arrow">→</span>
          <span class="flag">🇪🇸</span>
        </div>
        <div class="result-original thai-text">${this.esc(input)}</div>
        <div class="result-translation-wrapper">
          <div class="result-translation">${this.esc(result.translation)}</div>
        </div>
        ${result.explanation ? `
        <div class="result-section">
          <div class="result-label">💬 Explicación</div>
          <div class="result-explanation">${this.esc(result.explanation)}</div>
        </div>` : ''}
        ${result.emotional_tone ? `
        <div class="result-section">
          <div class="result-label">💕 Tono emocional</div>
          <div class="result-tone">${this.esc(result.emotional_tone)}</div>
        </div>` : ''}
        ${result.key_words ? `
        <div class="result-section">
          <div class="result-label">📚 Palabras clave</div>
          <div class="result-note">${this.esc(result.key_words)}</div>
        </div>` : ''}
        <div class="result-actions">
          <button class="btn-icon btn-copy" title="Copiar traducción">
            <span class="icon">📋</span> Copiar
          </button>
          <button class="btn-icon btn-fav ${isFav ? 'active' : ''}" title="Favorito">
            <span class="icon">${isFav ? '⭐' : '☆'}</span> Favorito
          </button>
        </div>
      `;
    }
  }

  // ────────── COPY ──────────
  handleCopy(btn) {
    if (!this.lastResult) return;

    const text = this.lastResult.translation;
    this.copyText(text);

    btn.classList.add('copied');
    btn.innerHTML = '<span class="icon">✅</span> Copiado';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = '<span class="icon">📋</span> Copiar';
    }, 2000);
  }

  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('📋 Copiado al portapapeles');
    } catch {
      // Fallback para navegadores que no soportan clipboard API
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

  // ────────── FAVORITES ──────────
  handleFavorite(btn) {
    if (!this.lastResult) return;

    const id = this.lastResult.id;
    if (Storage.isFavorite(id)) {
      Storage.removeFavorite(id);
      btn.classList.remove('active');
      btn.innerHTML = '<span class="icon">☆</span> Favorito';
      this.showToast('Eliminado de favoritos');
    } else {
      Storage.addFavorite(this.lastResult);
      btn.classList.add('active');
      btn.innerHTML = '<span class="icon">⭐</span> Favorito';
      this.showToast('⭐ Guardado en favoritos');
    }
    this.renderFavorites();
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

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tab}`);
    });
  }

  // ────────── DIRECTION INDICATOR ──────────
  updateDirection() {
    const text = document.getElementById('input-text').value;
    const indicator = document.getElementById('direction-indicator');
    const thaiRegex = /[\u0E00-\u0E7F]/;
    const isThai = thaiRegex.test(text);

    if (isThai) {
      indicator.innerHTML = `
        <span class="flag">🇹🇭</span>
        <span class="lang">Tailandés</span>
        <span class="arrow">→</span>
        <span class="flag">🇪🇸</span>
        <span class="lang">Español</span>
      `;
      indicator.classList.add('th-es');
      document.getElementById('input-text').classList.add('thai-input');
    } else {
      indicator.innerHTML = `
        <span class="flag">🇪🇸</span>
        <span class="lang">Español</span>
        <span class="arrow">→</span>
        <span class="flag">🇹🇭</span>
        <span class="lang">Tailandés</span>
      `;
      indicator.classList.remove('th-es');
      document.getElementById('input-text').classList.remove('thai-input');
    }
  }

  // ────────── CHAR COUNT ──────────
  updateCharCount() {
    const text = document.getElementById('input-text').value;
    document.getElementById('char-count').textContent = `${text.length} / 2000`;
  }

  // ────────── LOADING STATE ──────────
  setLoading(loading) {
    this.isTranslating = loading;
    const btn = document.getElementById('translate-btn');
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
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

  // ────────── ERROR HANDLING ──────────
  showError(message) {
    const area = document.getElementById('error-area');
    area.classList.remove('hidden');
    area.textContent = message;
    // Hide result
    document.getElementById('result-area').classList.add('hidden');
  }

  hideError() {
    document.getElementById('error-area').classList.add('hidden');
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
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  const app = new ThaiChatApp();
  app.init();
});
