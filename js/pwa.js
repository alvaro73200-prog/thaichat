// js/pwa.js — Registro del Service Worker para PWA

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[ThaiChat] Service Worker registrado con éxito:', registration.scope);
        })
        .catch(error => {
          console.log('[ThaiChat] Error al registrar el Service Worker:', error);
        });
    });
  }
}
