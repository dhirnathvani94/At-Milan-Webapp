// ─────────────────────────────────────────────────────────────────────────────
// Firebase SDK — Web Push Notification Support
// Manages FCM token registration and permission requests
// ─────────────────────────────────────────────────────────────────────────────
import { apiUrl } from './api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey?: string; // VAPID public key for web push
}

let _firebaseApp: any = null;
let _messaging: any = null;
let _currentVapidKey = '';

// ── Fetch active Firebase config from admin settings ───────────────────────

export async function getActiveFirebaseConfig(): Promise<{ config: FirebaseConfig | null; vapidKey: string }> {
  try {
    const res = await fetch(apiUrl('/api/admin/settings/firebase-config'));
    if (!res.ok) return { config: null, vapidKey: '' };
    const data = await res.json();
    return { config: data.config || null, vapidKey: data.vapid_key || '' };
  } catch {
    return { config: null, vapidKey: '' };
  }
}

// ── Initialize Firebase dynamically ───────────────────────────────────────

export async function initFirebase(): Promise<boolean> {
  try {
    const { config, vapidKey } = await getActiveFirebaseConfig();
    if (!config || !config.apiKey) {
      console.log('[FCM] No active Firebase config — push notifications disabled');
      return false;
    }

    // Dynamically import Firebase to avoid loading it when not configured
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    // Avoid re-initialization
    if (getApps().length === 0) {
      _firebaseApp = initializeApp(config);
    } else {
      _firebaseApp = getApps()[0];
    }

    _messaging = getMessaging(_firebaseApp);
    _currentVapidKey = vapidKey;

    // Send config to service worker for background notifications
    if ('serviceWorker' in navigator) {
      const swRegistration = await navigator.serviceWorker.ready;
      swRegistration.active?.postMessage({
        type: 'FIREBASE_CONFIG',
        config: {
          ...config,
          // Only pass fields needed by compat SDK in SW
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        },
      });
    }

    console.log('[FCM] Firebase initialized, project:', config.projectId);
    return true;
  } catch (err) {
    console.warn('[FCM] Firebase init error:', err);
    return false;
  }
}

// ── Request permission and get FCM token ──────────────────────────────────

export async function requestNotificationPermission(userId: string): Promise<string | null> {
  try {
    if (!('Notification' in window)) {
      console.warn('[FCM] Notifications not supported');
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[FCM] Permission denied by user');
      return null;
    }

    const initialized = await initFirebase();
    if (!initialized || !_messaging) return null;

    const { getToken } = await import('firebase/messaging');

    // Register service worker
    let swRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
        console.log('[FCM] Service Worker registered');
      } catch (swErr) {
        console.warn('[FCM] SW registration failed:', swErr);
      }
    }

    const token = await getToken(_messaging, {
      vapidKey: _currentVapidKey || undefined,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      // Send token to server
      await registerFCMToken(userId, token);
      console.log('[FCM] Token registered:', token.slice(0, 20) + '...');
      return token;
    }

    return null;
  } catch (err) {
    console.warn('[FCM] Token registration error:', err);
    return null;
  }
}

// ── Register foreground message handler ──────────────────────────────────

export async function setupForegroundNotifications(
  onMessage: (payload: { title: string; body: string; icon?: string; action_url?: string }) => void
): Promise<() => void> {
  try {
    if (!_messaging) await initFirebase();
    if (!_messaging) return () => {};

    const { onMessage: firebaseOnMessage } = await import('firebase/messaging');

    const unsubscribe = firebaseOnMessage(_messaging, (payload) => {
      const { title, body, icon } = payload.notification || {};
      const data = payload.data || {};
      onMessage({
        title: title || '🔔 Notification',
        body: body || '',
        icon,
        action_url: data.action_url,
      });
    });

    return unsubscribe;
  } catch (err) {
    console.warn('[FCM] Foreground listener error:', err);
    return () => {};
  }
}

// ── API: Register FCM token with the server ───────────────────────────────

export async function registerFCMToken(userId: string, token: string, platform: string = 'web'): Promise<void> {
  try {
    await fetch(apiUrl('/api/fcm/register-token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, token, platform }),
    });
  } catch (err) {
    console.warn('[FCM] Token registration API error:', err);
  }
}

// ── API: Unregister FCM token (on logout) ─────────────────────────────────

export async function unregisterFCMToken(userId: string): Promise<void> {
  try {
    const token = localStorage.getItem('fcm-token');
    if (!token) return;
    await fetch(apiUrl('/api/fcm/unregister-token'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, token }),
    });
    localStorage.removeItem('fcm-token');
  } catch {}
}

// ── Check notification permission status ──────────────────────────────────

export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as 'granted' | 'denied' | 'default';
}

// ── Firebase Authentication (Social Login) ────────────────────────────────

export async function signInWithSocial(providerName: 'google' | 'facebook'): Promise<{email: string, firstName: string, lastName: string, photoUrl: string}> {
  const isInitialized = await initFirebase();
  if (!isInitialized || !_firebaseApp) {
     throw new Error('Firebase is not configured. Please add your Firebase API credentials in the Admin Panel to enable Social Login.');
  }

  const { getAuth, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } = await import('firebase/auth');
  const auth = getAuth(_firebaseApp);
  
  const provider = providerName === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    if (!user.email) {
      throw new Error('Email address is required but was not provided by the social platform.');
    }
    
    const nameParts = (user.displayName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      email: user.email,
      firstName,
      lastName,
      photoUrl: user.photoURL || ''
    };
  } catch (err: any) {
    if (err.code === 'auth/popup-closed-by-user') {
      throw new Error('Login cancelled.');
    }
    throw new Error(err.message || `Failed to sign in with ${providerName}`);
  }
}
