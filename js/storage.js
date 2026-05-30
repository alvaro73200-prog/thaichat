// storage.js — Gestión de almacenamiento local (localStorage)

const KEYS = {
  API_KEY: 'thaichat_api_key',
  HISTORY: 'thaichat_history',
  FAVORITES: 'thaichat_favorites',
  SETTINGS: 'thaichat_settings',
  PIN: 'thaichat_pin',
  USER: 'thaichat_chat_user',
  USER_NAME: 'thaichat_chat_name',
  FB_CONFIG: 'thaichat_fb_config'
};

const MAX_HISTORY = 100;

// ==================== API Key ====================

export function getApiKey() {
  return localStorage.getItem(KEYS.API_KEY) || '';
}

export function setApiKey(key) {
  localStorage.setItem(KEYS.API_KEY, key.trim());
}

// ==================== History ====================

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]');
  } catch {
    return [];
  }
}

export function addToHistory(entry) {
  const history = getHistory();
  history.unshift({
    ...entry,
    id: Date.now(),
    timestamp: new Date().toISOString()
  });
  // Mantener máximo MAX_HISTORY entradas (FIFO)
  if (history.length > MAX_HISTORY) history.pop();
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
}

export function clearHistory() {
  localStorage.removeItem(KEYS.HISTORY);
}

// ==================== Favorites ====================

export function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.FAVORITES) || '[]');
  } catch {
    return [];
  }
}

export function addFavorite(entry) {
  const favs = getFavorites();
  // Evitar duplicados por ID
  if (!favs.find(f => f.id === entry.id)) {
    favs.unshift({ ...entry, favoritedAt: new Date().toISOString() });
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favs));
  }
}

export function removeFavorite(id) {
  const favs = getFavorites().filter(f => f.id !== id);
  localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favs));
}

export function isFavorite(id) {
  return getFavorites().some(f => f.id === id);
}

export function clearFavorites() {
  localStorage.removeItem(KEYS.FAVORITES);
}

// ==================== Settings ====================

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.SETTINGS) || '{}');
  } catch {
    return {};
  }
}

export function updateSettings(newSettings) {
  const settings = { ...getSettings(), ...newSettings };
  localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  return settings;
}

// ==================== Premium Live Chat ====================

export function getPin() {
  return localStorage.getItem(KEYS.PIN);
}

export function setPin(pin) {
  localStorage.setItem(KEYS.PIN, pin);
}

export function getChatUser() {
  return localStorage.getItem(KEYS.USER); // 'me' | 'her' | 'admin'
}

export function setChatUser(user) {
  localStorage.setItem(KEYS.USER, user);
}

export function getUserName() {
  return localStorage.getItem(KEYS.USER_NAME) || '';
}

export function setUserName(name) {
  localStorage.setItem(KEYS.USER_NAME, name);
}

export function getFirebaseConfig() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.FB_CONFIG));
  } catch {
    return null;
  }
}

export function setFirebaseConfig(config) {
  if (!config) localStorage.removeItem(KEYS.FB_CONFIG);
  else localStorage.setItem(KEYS.FB_CONFIG, JSON.stringify(config));
}
