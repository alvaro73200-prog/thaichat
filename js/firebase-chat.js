// firebase-chat.js — Módulo para Firebase Realtime Chat y Storage
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { 
  getFirestore, enableIndexedDbPersistence, collection, addDoc, 
  onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, 
  setDoc, getDocs 
} from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';

let app, db, auth;
let currentUid = null;

export async function initFirebase(config) {
  if (!config || !config.apiKey) throw new Error("Configuración de Firebase inválida");
  
  app = initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);

  try {
    await enableIndexedDbPersistence(db);
    console.log('[Firebase] Persistencia offline activada');
  } catch (err) {
    console.warn('[Firebase] No se pudo activar persistencia offline:', err.code);
  }
}

export async function signIn() {
  if (!auth) throw new Error("Firebase no inicializado");
  const userCredential = await signInAnonymously(auth);
  currentUid = userCredential.user.uid;
  return currentUid;
}

export async function sendMessage({ text, translation, direction, sender, type = 'text', mediaUrl = '' }) {
  if (!db) throw new Error("Firebase no inicializado");
  const msgRef = collection(db, 'messages');
  return addDoc(msgRef, {
    text,
    translation,
    direction,
    sender,
    type,
    mediaUrl,
    timestamp: serverTimestamp(),
    deletedBy: []
  });
}

export async function sendMedia(file, sender, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target.result;
      const type = file.type.startsWith('video/') ? 'video' : (file.type.startsWith('audio/') ? 'audio' : 'image');
      resolve({ url: base64Url, type });
    };
    reader.onerror = (err) => reject(err);
    // Para dar feedback inmediato, llamamos onProgress al 100% de una vez (la compresión local es muy rápida)
    if (onProgress) onProgress(100);
    reader.readAsDataURL(file);
  });
}

export function listenMessages(userType, onNewMessage) {
  if (!db) throw new Error("Firebase no inicializado");
  
  const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        data.id = change.doc.id;
        
        // El admin ve todo, los usuarios normales no ven los mensajes que borraron
        if (userType === 'admin' || !data.deletedBy.includes(userType)) {
          onNewMessage(data, change.type);
        }
      }
    });
  });
}

export async function getAllMessages() {
  if (!db) return [];
  const q = query(collection(db, 'messages'), orderBy('timestamp', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteForMe(messageId, userType) {
  if (!db || userType === 'admin') return;
  
  const msgRef = doc(db, 'messages', messageId);
  // Al usar arrayUnion en Firestore en un entorno real se haría así, 
  // pero para no importar más cosas, obtenemos el doc y actualizamos el array
  const snap = await getDocs(query(collection(db, 'messages')));
  const theDoc = snap.docs.find(d => d.id === messageId);
  if (theDoc) {
    const data = theDoc.data();
    if (!data.deletedBy.includes(userType)) {
      data.deletedBy.push(userType);
      await updateDoc(msgRef, { deletedBy: data.deletedBy });
    }
  }
}

// ==================== STATUS (Escribiendo y Lectura) ====================

export function listenStatus(onStatusChange) {
  if (!db) return () => {};
  const statusRef = doc(db, 'chat_status', 'global');
  return onSnapshot(statusRef, (docSnap) => {
    if (docSnap.exists()) {
      onStatusChange(docSnap.data());
    }
  });
}

export async function setTypingStatus(userType, isTyping) {
  if (!db || userType === 'admin') return;
  const statusRef = doc(db, 'chat_status', 'global');
  const updatePayload = userType === 'me' ? { meTyping: isTyping } : { herTyping: isTyping };
  try {
    await updateDoc(statusRef, updatePayload);
  } catch (err) {
    // Si no existe, lo creamos
    await setDoc(statusRef, { meTyping: false, herTyping: false, meLastRead: null, herLastRead: null }, { merge: true });
    await updateDoc(statusRef, updatePayload);
  }
}

export async function setLastRead(userType, messageId) {
  if (!db || userType === 'admin' || !messageId) return;
  const statusRef = doc(db, 'chat_status', 'global');
  const updatePayload = userType === 'me' ? { meLastRead: messageId } : { herLastRead: messageId };
  try {
    await updateDoc(statusRef, updatePayload);
  } catch (err) {
    await setDoc(statusRef, { meTyping: false, herTyping: false, meLastRead: null, herLastRead: null }, { merge: true });
    await updateDoc(statusRef, updatePayload);
  }
}
