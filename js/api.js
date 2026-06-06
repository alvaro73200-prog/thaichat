// api.js — Cliente de Google Gemini API para traducción

import PROMPTS from './prompts.js';

class TranslationService {
  // Lista de modelos en orden de prioridad (se rota automáticamente en 429)
  static MODELS = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
  ];

  constructor(apiKey) {
    this.apiKey = apiKey;
    this.model = 'gemini-2.5-flash-lite';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    /**
     * Callback que se llama cuando se cambia de modelo por 429.
     * La app puede usarlo para: mostrar toast, guardar en storage, etc.
     * Firma: (newModel: string, reason: string) => void
     */
    this.onModelSwitch = null;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Detecta si el texto contiene caracteres tailandeses
   * Rango Unicode Thai: U+0E00 — U+0E7F
   */
  detectLanguage(text) {
    const thaiRegex = /[\u0E00-\u0E7F]/;
    return thaiRegex.test(text) ? 'th' : 'other';
  }

  /**
   * Traducción ligera — solo devuelve el texto traducido.
   * Usa prompts lite para ahorrar tokens.
   */
  async translate(text, context = '') {
    if (!text.trim()) throw new Error('El texto está vacío');
    if (!this.apiKey) throw new Error('Configura tu API key en Ajustes');

    const lang = this.detectLanguage(text);
    const direction = lang === 'th' ? 'th-es' : 'es-th';
    const systemPrompt = lang === 'th' ? PROMPTS.toSpanishLite : PROMPTS.toThaiLite;

    // Si hay contexto de traducciones previas, lo incluimos para mejor traducción
    let userText = text;
    if (context && context.trim()) {
      userText = `[CONTEXTO DE CONVERSACIÓN RECIENTE]\n${context}\n\n[MENSAJE A TRADUCIR]\n${text}`;
    }

    const result = await this._callGemini(systemPrompt, userText, 256);
    return { direction, translation: result.translation || '' };
  }

  /**
   * Explicación detallada — se llama solo cuando el usuario toca la flechita.
   * Incluye pronunciación, literal, tono, etc.
   */
  async explain(originalText, translation, direction) {
    if (!this.apiKey) throw new Error('Configura tu API key en Ajustes');

    const isThai = direction === 'es-th';
    const systemPrompt = isThai ? PROMPTS.toThaiDetail : PROMPTS.toSpanishDetail;
    const userText = isThai
      ? `Texto original: "${originalText}"\nTraducción tailandesa: "${translation}"`
      : `Mensaje tailandés: "${originalText}"\nTraducción española: "${translation}"`;

    const result = await this._callGemini(systemPrompt, userText, 512);
    return result;
  }

  /**
   * Llama a la API de Gemini con system prompt y texto del usuario.
   * Si recibe 429, rota automáticamente al siguiente modelo de la lista
   * y llama al callback `onModelSwitch` si está definido.
   */
  async _callGemini(systemPrompt, userText, maxTokens = 1024, _triedModels = new Set()) {
    if (!this.apiKey) throw new Error('Configura tu API key en Ajustes');

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: userText }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json'
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch {
      throw new Error('📡 Sin conexión a internet. Verifica tu red.');
    }

    // ── Manejo de 429: rotar al siguiente modelo y reintentar ──
    if (response.status === 429) {
      _triedModels.add(this.model);

      const nextModel = TranslationService.MODELS.find(m => !_triedModels.has(m));

      if (!nextModel) {
        // Todos los modelos agotados
        throw new Error('RATE_LIMIT_ALL');
      }

      const previousModel = this.model;
      this.model = nextModel;

      // Notificar a la app del cambio
      if (typeof this.onModelSwitch === 'function') {
        this.onModelSwitch(nextModel, previousModel);
      }

      // Pequeña pausa antes de reintentar con el nuevo modelo
      await new Promise(r => setTimeout(r, 800));

      return this._callGemini(systemPrompt, userText, maxTokens, _triedModels);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = response.status;

      if (status === 400 || status === 403) {
        throw new Error('🔑 API key inválida. Ve a Ajustes (⚙️) y verifica tu key.');
      }
      const message = errorData.error?.message || `Error ${status}`;
      throw new Error(message);
    }

    const data = await response.json();
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error('Respuesta vacía del servidor. Intenta de nuevo.');
    }

    try {
      return JSON.parse(textContent);
    } catch {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
      }
      throw new Error('Error al procesar la respuesta. Intenta de nuevo.');
    }
  }
}

export default TranslationService;
