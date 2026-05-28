import { useEffect } from 'react';
import { useSocketStore } from '../store/socketStore';
import { useMasterData } from '../store/masterDataStore';

/**
 * Invisible component that bridges 'settings:updated' socket
 * events from the admin panel to the Zustand masterDataStore.
 *
 * Uses the existing socketStore socket (already connected to Render)
 * instead of creating a duplicate connection.
 *
 * Mounts once at app root. All pages that read from useMasterData
 * (Logo, Footer, HomePage, SEOProvider, etc.) re-render automatically
 * when admin saves any setting — zero page refresh needed.
 */
export default function SettingsSocketProvider() {
  const { socket } = useSocketStore();

  useEffect(() => {
    if (!socket) return;

    const handleSettingsUpdated = ({
      key,
      value,
    }: {
      key: string;
      value: string;
    }) => {
      try {
        const current = useMasterData.getState().admin_settings_kv;
        if (!Array.isArray(current)) return;

        const idx = current.findIndex((s: any) => s.key === key);
        let updated: any[];

        if (idx >= 0) {
          updated = [...current];
          updated[idx] = { ...updated[idx], key, value };
        } else {
          updated = [...current, { key, value, setting_type: 'text' }];
        }

        useMasterData.setState({ admin_settings_kv: updated });

        // Keep platform_name and site_title in sync
        if (key === 'platform_name' || key === 'site_title') {
          const otherKey =
            key === 'platform_name' ? 'site_title' : 'platform_name';
          const otherIdx = updated.findIndex((s: any) => s.key === otherKey);
          if (otherIdx >= 0) {
            const synced = [...updated];
            synced[otherIdx] = { ...synced[otherIdx], value };
            useMasterData.setState({ admin_settings_kv: synced });
          }
        }
      } catch (err) {
        console.warn('[SettingsSocketProvider] error:', err);
      }
    };

    socket.on('settings:updated', handleSettingsUpdated);

    return () => {
      socket.off('settings:updated', handleSettingsUpdated);
    };
  }, [socket]);

  return null;
}
