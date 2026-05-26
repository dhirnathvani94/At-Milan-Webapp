import React, { useEffect } from 'react';
import { useMasterData } from '../store/masterDataStore';

// Memoized wrapper — children NEVER re-render when SEOProvider re-renders
// This prevents the entire app tree from re-rendering on every settings socket event
const StableChildren = React.memo(function StableChildren({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
});

export default function SEOProvider({ children }: { children: React.ReactNode }) {
  const { admin_settings_kv } = useMasterData();

  useEffect(() => {
    if (!admin_settings_kv || admin_settings_kv.length === 0) return;

    const getVal = (key: string) =>
      admin_settings_kv.find((s: any) => s.key === key)?.value || '';

    // Browser tab title — Brand Name + Tagline (dynamic from Admin Panel)
    const seoTitle     = getVal('seo_meta_title');
    const platformName = getVal('platform_name') || getVal('site_title') || 'AtMilan';
    const tagline      = getVal('company_tagline') || 'Premium Matrimonial Platform';

    if (seoTitle) {
      document.title = seoTitle;
    } else {
      document.title = `${platformName} - ${tagline}`;
    }

    // Meta Description
    const desc = getVal('seo_meta_description');
    if (desc) {
      let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', desc);
    }

    // Meta Keywords
    const keywords = getVal('seo_meta_keywords');
    if (keywords) {
      let metaKey = document.querySelector('meta[name="keywords"]') as HTMLMetaElement | null;
      if (!metaKey) {
        metaKey = document.createElement('meta');
        metaKey.setAttribute('name', 'keywords');
        document.head.appendChild(metaKey);
      }
      metaKey.setAttribute('content', keywords);
    }

    // Favicon
    const favicon = getVal('site_favicon');
    if (favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = favicon;
    }

  }, [admin_settings_kv]);

  return <StableChildren>{children}</StableChildren>;
}
