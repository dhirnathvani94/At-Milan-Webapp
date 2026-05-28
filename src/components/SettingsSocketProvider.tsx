import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useMasterData } from '../store/masterDataStore';

/**
 * Invisible component that listens for 'settings:updated' socket events.
 * When admin saves any setting, the server emits the event and this
 * component updates the Zustand store — causing all pages to re-render
 * with the new value instantly.
 * 
 * No polling. No unnecessary re-renders. Only updates when admin saves.
 */
export default function SettingsSocketProvider() {
  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
      window.location.origin;

    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('settings:updated', ({ key, value }: { key: string; value: string }) => {
      const current = useMasterData.getState().admin_settings_kv;
      const idx = current.findIndex((s: any) => s.key === key);
      let updated: any[];
      if (idx >= 0) {
        updated = [...current];
        updated[idx] = { ...updated[idx], key, value };
      } else {
        updated = [...current, { key, value }];
      }
      useMasterData.setState({ admin_settings_kv: updated });
    });

    return () => { socket.disconnect(); };
  }, []);

  return null;
}
