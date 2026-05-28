import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMasterData } from '../store/masterDataStore';

interface LogoProps {
  white?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  hideLink?: boolean;
  variant?: 'header' | 'footer';
  shape?: 'square' | 'rounded' | 'circle';
}

export default function Logo({
  white = false,
  className = '',
  size = 'md',
  hideLink = false,
  variant = 'header',
  shape = 'rounded',
}: LogoProps) {
  const { admin_settings_kv } = useMasterData();
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [platformName, setPlatformName] = useState<string>('AtMilan');

  useEffect(() => {
    if (!admin_settings_kv || admin_settings_kv.length === 0) return;
    const logoKey = variant === 'footer' ? 'footer_logo_image' : 'site_logo_image';
    const logoValue = admin_settings_kv.find((s: any) => s.key === logoKey)?.value || '';
    setLogoImage(logoValue || null);
    const name = admin_settings_kv.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';
    setPlatformName(name);
  }, [admin_settings_kv, variant]);

  function splitName(name: string): [string, string] {
    const spaceIdx = name.indexOf(' ');
    if (spaceIdx > 0) return [name.slice(0, spaceIdx), name.slice(spaceIdx + 1)];
    const camelIdx = name.slice(1).search(/[A-Z]/);
    if (camelIdx >= 0) { const s = camelIdx + 1; return [name.slice(0, s), name.slice(s)]; }
    const mid = Math.ceil(name.length / 2);
    return [name.slice(0, mid), name.slice(mid)];
  }

  const shapeClass = shape === 'circle' ? 'rounded-full' : shape === 'square' ? 'rounded-none' : 'rounded-xl';
  const imgHeight  = size === 'sm' ? 'h-6 md:h-8' : size === 'lg' ? 'h-10 md:h-12' : 'h-8 md:h-10';
  const textSize   = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl';
  const heartSize  = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

  let content;
  if (logoImage) {
    content = <img src={logoImage} alt={platformName} className={`${imgHeight} w-auto object-contain transition-all ${shapeClass}`} />;
  } else {
    const [part1, part2] = splitName(platformName);
    content = (
      <>
        <span className={`font-heading font-bold ${textSize} ${white ? 'text-white' : 'text-primary'}`}>{part1}</span>
        <Heart size={heartSize} className="text-red-500 fill-red-500 -mx-0.5" />
        <span className={`font-heading font-bold ${textSize} ${white ? 'text-white' : 'text-secondary'}`}>{part2}</span>
      </>
    );
  }

  if (hideLink) return <div className={`flex items-center gap-1 flex-shrink-0 ${className}`}>{content}</div>;
  return <Link to="/" className={`flex items-center gap-1 flex-shrink-0 ${className}`}>{content}</Link>;
}
