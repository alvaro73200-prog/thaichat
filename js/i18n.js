// i18n.js — Internacionalización: Español / ภาษาไทย

const STRINGS = {
  // Onboarding
  'onboarding.sub':        { es: 'Tu traductor personal de tailandés',            th: 'นักแปลภาษาไทยส่วนตัวของคุณ' },
  'onboarding.step':       { es: 'Para empezar necesitas una API Key de Gemini (es gratis)', th: 'ต้องมี API Key ของ Gemini เพื่อเริ่มต้น (ฟรี)' },
  'onboarding.paste':      { es: '📋 Pegar',                                      th: '📋 วาง' },
  'onboarding.start':      { es: '🚀 Empezar a traducir',                         th: '🚀 เริ่มแปลภาษา' },
  'onboarding.no-key':     { es: '¿No tienes una? Créala gratis aquí →',          th: 'ยังไม่มี? สร้างฟรีได้ที่นี่ →' },
  'onboarding.model':      { es: 'Modelo',                                        th: 'โมเดล AI' },

  // Header
  'header.settings':       { es: '⚙️',                                            th: '⚙️' },

  // Chat
  'chat.placeholder':      { es: 'Escribe tu mensaje...',                         th: 'พิมพ์ข้อความ...' },
  'chat.welcome.title':    { es: 'ThaiChat',                                      th: 'ThaiChat' },
  'chat.welcome.sub':      { es: 'Escribe algo para traducir',                    th: 'พิมพ์ข้อความเพื่อแปล' },
  'chat.prev':             { es: 'Conversación anterior',                         th: 'การสนทนาก่อนหน้า' },
  'chat.now':              { es: 'Ahora',                                         th: 'ตอนนี้' },

  // Explain section
  'explain.pronun':        { es: '📖 Pronunciación',                              th: '📖 การออกเสียง' },
  'explain.literal':       { es: '📝 Literal',                                    th: '📝 แปลตรงตัว' },
  'explain.note':          { es: '💡 Nota',                                       th: '💡 หมายเหตุ' },
  'explain.explanation':   { es: '💬 Explicación',                                th: '💬 คำอธิบาย' },
  'explain.tone':          { es: '💕 Tono',                                       th: '💕 น้ำเสียง' },
  'explain.keywords':      { es: '📚 Palabras clave',                             th: '📚 คำสำคัญ' },
  'explain.loading':       { es: 'Cargando explicación...',                       th: 'กำลังโหลดคำอธิบาย...' },
  'explain.retry':         { es: '🔄 Reintentar',                                 th: '🔄 ลองอีกครั้ง' },

  // Toasts
  'toast.copied':          { es: '📋 Copiado al portapapeles',                    th: '📋 คัดลอกแล้ว' },
  'toast.saved-fav':       { es: '⭐ Guardado en favoritos',                      th: '⭐ บันทึกในรายการโปรดแล้ว' },
  'toast.removed-fav':     { es: 'Eliminado de favoritos',                        th: 'ลบออกจากรายการโปรดแล้ว' },
  'toast.history-cleared': { es: 'Historial borrado',                             th: 'ล้างประวัติแล้ว' },
  'toast.favs-cleared':    { es: 'Favoritos borrados',                            th: 'ล้างรายการโปรดแล้ว' },
  'toast.settings-saved':  { es: '✅ Guardado',                                   th: '✅ บันทึกแล้ว' },
  'toast.no-key':          { es: '⚠️ Configura tu API key primero',               th: '⚠️ กรุณาตั้งค่า API key ก่อน' },
  'toast.clipboard-empty': { es: '⚠️ El portapapeles está vacío',                 th: '⚠️ คลิปบอร์ดว่างเปล่า' },
  'toast.paste-manual':    { es: '📱 Pega manualmente con Ctrl+V',                th: '📱 วางด้วย Ctrl+V' },
  'toast.saved-settings':  { es: '✅ Guardado — Usando',                          th: '✅ บันทึกแล้ว — ใช้งาน' },
  'toast.no-api-key':      { es: '⚠️ Pega tu API Key primero',                   th: '⚠️ วาง API Key ก่อน' },

  // Nav
  'nav.live':              { es: 'Chat Vivo',                                     th: 'แชทสด' },
  'nav.translate':         { es: 'Traducir',                                      th: 'แปล' },
  'nav.history':           { es: 'Historial',                                     th: 'ประวัติ' },
  'nav.favorites':         { es: 'Favoritos',                                     th: 'รายการโปรด' },
  'nav.phrases':           { es: 'Frases',                                        th: 'วลีด่วน' },

  // History tab
  'history.title':         { es: '📜 Historial',                                  th: '📜 ประวัติ' },
  'history.clear':         { es: 'Borrar todo',                                   th: 'ล้างทั้งหมด' },
  'history.empty':         { es: 'No hay traducciones aún',                       th: 'ยังไม่มีคำแปล' },
  'history.empty-sub':     { es: 'Tus traducciones aparecerán aquí',              th: 'คำแปลของคุณจะปรากฏที่นี่' },

  // Favorites tab
  'favs.title':            { es: '⭐ Favoritos',                                  th: '⭐ รายการโปรด' },
  'favs.clear':            { es: 'Borrar todo',                                   th: 'ล้างทั้งหมด' },
  'favs.empty':            { es: 'Sin favoritos',                                 th: 'ไม่มีรายการโปรด' },
  'favs.empty-sub':        { es: 'Guarda traducciones tocando ⭐',                th: 'บันทึกคำแปลด้วยการแตะ ⭐' },

  // Phrases tab
  'phrases.title':         { es: '💬 Frases Rápidas',                             th: '💬 วลีด่วน' },

  // Settings modal
  'settings.title':        { es: '⚙️ Ajustes',                                   th: '⚙️ การตั้งค่า' },
  'settings.key-label':    { es: '🔑 API Key de Gemini',                          th: '🔑 API Key ของ Gemini' },
  'settings.key-hint':     { es: 'Obtén tu key gratis en',                        th: 'รับ key ฟรีได้ที่' },
  'settings.model-label':  { es: '🤖 Modelo de Gemini',                           th: '🤖 โมเดล Gemini' },
  'settings.model-hint':   { es: 'Si un modelo da error 429, cambia a otro',      th: 'หากโมเดลแจ้ง error 429 ให้เปลี่ยนโมเดล' },
  'settings.lang-label':   { es: '🌐 Idioma de la interfaz',                      th: '🌐 ภาษาของแอป' },
  'settings.save':         { es: '💾 Guardar',                                    th: '💾 บันทึก' },
  'settings.zoom-label':   { es: '🔍 Tamaño del texto',                           th: '🔍 ขนาดตัวอักษร' },
  'profile.label':         { es: '👤 Perfil de uso',                              th: '👤 โปรไฟล์การใช้งาน' },
  'profile.me':            { es: '👦 Mi Perfil (Hablante Español)',               th: '👦 โปรไฟล์ของฉัน (พูดภาษาสเปน)' },
  'profile.her':           { es: '👱‍♀️ Su Perfil (Hablante Tailandés)',            th: '👱‍♀️ โปรไฟล์ของเธอ (พูดภาษาไทย)' },

  // Favorites button
  'btn.favorite':          { es: '☆ Favorito',                                   th: '☆ รายการโปรด' },
  'btn.favorited':         { es: '⭐ Favorito',                                   th: '⭐ รายการโปรด' },
  'btn.retry':             { es: '🔄 Reintentar',                                 th: '🔄 ลองอีกครั้ง' },

  // Rate limit & model switch
  'toast.rate-limit':      { es: '⏳ Límite alcanzado — cambiando modelo...',     th: '⏳ ถึงขีดจำกัด — กำลังเปลี่ยนโมเดล...' },
  'toast.model-switch':    { es: '⚡ Cambiado a',                                 th: '⚡ เปลี่ยนเป็น' },
  'toast.all-busy':        { es: '🔥 Todos los modelos saturados. Espera 1 min.', th: '🔥 ทุกโมเดลเต็ม กรุณารอ 1 นาที' },
  'ratelimit.wait':        { es: '⏳ Espera',                                     th: '⏳ รอ' },
  'ratelimit.s':           { es: 's',                                             th: 'วิ' },
  'settings.profile.hint': { es: 'La app se adaptará para mostrar el teclado e interfaz adecuados.', th: 'แอปจะปรับเพื่อแสดงแป้นพิมพ์และอินเทอร์เฟซที่เหมาะสม' },

  // ==================== PREMIUM LIVE CHAT V3 ====================
  // PIN
  'pin.title':             { es: 'ThaiChat',                                      th: 'ThaiChat' },
  'pin.sub':               { es: 'Ingresa el código de acceso',                   th: 'ป้อนรหัสผ่าน' },
  
  // User Select
  'user.title':            { es: '¿Quién eres?',                                  th: 'คุณคือใคร?' },
  'user.me':               { es: 'Él',                                            th: 'เขา' },
  'user.me.lang':          { es: 'Habla Español',                                 th: 'พูดภาษาสเปน' },
  'user.her':              { es: 'Ella',                                          th: 'เธอ' },
  'user.her.lang':         { es: 'พูดภาษาไทย',                                    th: 'พูดภาษาไทย' },

  // Live Chat
  'live.setup.title':      { es: 'Chat en Vivo',                                  th: 'แชทสด' },
  'live.no-firebase':      { es: 'Para chatear en tiempo real, pega tu config Firebase en Ajustes', th: 'เพื่อแชทแบบเรียลไทม์ วางการตั้งค่า Firebase ในการตั้งค่า' },
  'live.go-settings':      { es: 'Ir a Ajustes',                                  th: 'ไปที่การตั้งค่า' },
  'live.connected':        { es: '🟢 Conectado',                                  th: '🟢 เชื่อมต่อแล้ว' },
  'live.typing':           { es: 'está escribiendo...',                           th: 'กำลังพิมพ์...' },
  'live.attach':           { es: 'Adjuntar archivo',                              th: 'แนบไฟล์' },
  'live.setup-copied':     { es: '✅ Link copiado. Envíalo a la otra persona.',   th: '✅ คัดลอกลิงก์แล้ว ส่งให้อีกคน' },
  
  // Admin
  'admin.banner':          { es: '🔐 Modo Admin — Viendo todo el historial',      th: '🔐 โหมดผู้ดูแลระบบ — ดูประวัติทั้งหมด' },
  'admin.exit':            { es: 'Salir',                                         th: 'ออก' }
};

let currentLang = 'es';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = (lang === 'th') ? 'th' : 'es';
}

export function t(key) {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[currentLang] || entry['es'] || key;
}

/** Aplica las traducciones a todos los elementos [data-i18n] del DOM */
export function applyAll() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.placeholder = t(key);
  });
  // Actualizar lang del html
  document.documentElement.lang = currentLang === 'th' ? 'th' : 'es';
}
