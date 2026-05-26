// api.js — Cliente de Google Gemini API para traducción

import PROMPTS from './prompts.js';

class TranslationService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    // Modelo verificado como disponible y funcional en free tier
    this.model = 'gemini-2.5-flash-lite';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
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
   * Traduce automáticamente detectando la dirección:
   * - Si contiene tailandés → traduce a español
   * - Si no → traduce a tailandés
   */
  async translate(text) {
    if (!text.trim()) throw new Error('El texto está vacío');
    if (!this.apiKey) throw new Error('Configura tu API key en Ajustes');

    const lang = this.detectLanguage(text);
    const direction = lang === 'th' ? 'th-es' : 'es-th';
    const systemPrompt = lang === 'th' ? PROMPTS.toSpanish : PROMPTS.toThai;

    const result = await this._callGemini(systemPrompt, text);
    return { direction, ...result };
  }

  /**
   * Llama a la API de Gemini con system prompt y texto del usuario
   */
  async _callGemini(systemPrompt, userText) {
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
        maxOutputTokens: 1024,
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const status = response.status;

      if (status === 429) {
        throw new Error('⏳ Límite de solicitudes alcanzado. Espera unos segundos e intenta de nuevo.');
      }
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

    // El modelo responde JSON porque usamos responseMimeType: 'application/json'
    try {
      return JSON.parse(textContent);
    } catch {
      // Fallback: extraer JSON si viene con texto alrededor
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
      }
      throw new Error('Error al procesar la respuesta. Intenta de nuevo.');
    }
  }
}

export default TranslationService;
