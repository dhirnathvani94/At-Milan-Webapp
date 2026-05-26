// ─────────────────────────────────────────────────────────────────────────────
// usePushNotifications Hook
// Handles FCM token registration + foreground notification display for logged-in users
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  requestNotificationPermission,
  setupForegroundNotifications,
  getNotificationPermissionStatus,
} from '../firebase';
import { useMasterData } from '../../store/masterDataStore';

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  action_url?: string;
}

export function usePushNotifications(userId: string | null) {
  const { admin_settings_kv } = useMasterData();
  const brandName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';
  const [permissionStatus, setPermissionStatus] = useState<string>(() => getNotificationPermissionStatus());
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!userId || hasInitialized.current) return;
    hasInitialized.current = true;

    const stored = localStorage.getItem('fcm-token');
    if (stored) setFcmToken(stored);

    // Init foreground notifications (FCM SDK must be initialized first)
    const initForeground = async () => {
      try {
        const unsubscribe = await setupForegroundNotifications((payload: PushNotificationPayload) => {
          showNotificationToast(payload, brandName);
        });
        cleanupRef.current = unsubscribe;
      } catch (e) {
        // FCM not configured, skip
      }
    };

    // Auto-request permission if not yet decided
    const status = getNotificationPermissionStatus();
    setPermissionStatus(status);

    if (status === 'default') {
      // Delay slightly to not interrupt initial page load UX
      const timer = setTimeout(async () => {
        try {
          const token = await requestNotificationPermission(userId);
          if (token) {
            setFcmToken(token);
            localStorage.setItem('fcm-token', token);
            setPermissionStatus('granted');
            await initForeground();
          } else {
            setPermissionStatus(getNotificationPermissionStatus());
          }
        } catch (e) {
          // Ignore errors (Firebase not configured)
        }
      }, 5000); // 5 second delay
      return () => clearTimeout(timer);
    } else if (status === 'granted') {
      // Already granted — register token if needed
      (async () => {
        try {
          if (!stored) {
            const token = await requestNotificationPermission(userId);
            if (token) {
              setFcmToken(token);
              localStorage.setItem('fcm-token', token);
            }
          }
          await initForeground();
        } catch (e) {
          // Firebase not configured, skip silently
        }
      })();
    }

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [userId]);

  return { permissionStatus, fcmToken };
}

// ── Show a rich styled toast for foreground FCM messages ──────────────────

function showNotificationToast(payload: PushNotificationPayload, brandName: string) {
  const { title, body, icon, action_url } = payload;
  toast.custom(
    (t) => (
      <div
        onClick={() => {
          toast.dismiss(t.id);
          if (action_url) {
            window.location.href = action_url;
          }
        }}
        style={{
          animation: t.visible ? 'slideInFromRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'slideOutToRight 0.3s ease',
          cursor: action_url ? 'pointer' : 'default',
        }}
        className="max-w-sm w-full bg-white shadow-2xl rounded-2xl flex ring-1 ring-black/5 border border-gray-100 overflow-hidden"
      >
        {/* Left accent stripe */}
        <div className="w-1.5 bg-gradient-to-b from-primary via-primary/70 to-primary/20 shrink-0" />

        <div className="flex-1 p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="w-10 h-10 shrink-0 flex items-center justify-center text-xl bg-primary/10 rounded-xl border border-primary/20">
              {icon || '🔔'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-gray-900 line-clamp-1">{title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">{body}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                  className="text-gray-300 hover:text-gray-600 shrink-0 mt-0.5 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <p className="text-[10px] text-gray-400 font-medium">{brandName} · now</p>
                {action_url && (
                  <span className="text-[10px] font-bold text-primary">Tap to view →</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      duration: 7000,
      position: 'top-right',
    }
  );
}
