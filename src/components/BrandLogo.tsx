import React from 'react';
import Image from 'next/image';

interface BrandLogoProps {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  alt?: string;
  /**
   * variant="legacy" attempts to replicate the previous CSS-module based structure
   * (logoContainer > logoBox + logoText) so surrounding layout depending on those
   * class hooks or block-level flow remains visually stable.
   * default variant is the streamlined inline-flex version introduced with the rebrand.
   */
  variant?: 'modern' | 'legacy';
  /** Optional pass-through of legacy styles module for tree-shaken builds */
  styles?: Partial<Record<string, string>>;
}

/**
 * BrandLogo renders the new dual-arrow sprout mark. Falls back to legacy /logo.svg if custom asset missing.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 40,
  className = '',
  showWordmark = false,
  alt = 'BizSproutAI',
  variant = 'modern',
  styles
}) => {
  const src = '/brand-logo.svg';

  if (variant === 'legacy') {
    // Map provided styles (if any) to expected class names; fall back gracefully
    const c = (key: string, fallback: string) => (styles && styles[key]) || fallback;
    return (
      <div className={`${c('logoContainer','')} ${className}`.trim()}>
        <div className={c('logoBox','')}>          
          <Image src={src} alt={alt} width={size} height={size} priority className={c('logoImg','')} />
        </div>
        {showWordmark && (
          <div className={c('logoText','font-bold text-base')}>
            bizsprout<span className={c('logoTextAccent','text-emerald-600')}>ai</span>
          </div>
        )}
      </div>
    );
  }

  // Modern default variant
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>      
      <Image src={src} alt={alt} width={size} height={size} priority />
      {showWordmark && (
        <span className="font-extrabold text-lg tracking-tight">
          <span className="text-gray-900">bizsprout</span>
          <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">ai</span>
        </span>
      )}
    </span>
  );
};

export default BrandLogo;
