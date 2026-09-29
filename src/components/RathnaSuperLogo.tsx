import React, { useState, useEffect } from 'react';

interface RathnaSuperLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showUploadOption?: boolean;
}

export const RathnaSuperLogo: React.FC<RathnaSuperLogoProps> = ({
  className = '',
  size = 'md',
  showUploadOption = false,
}) => {
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('rathna_custom_logo');
      if (saved) {
        setCustomLogo(saved);
      }
    } catch {
      // Local storage unavailable
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setCustomLogo(base64);
        try {
          localStorage.setItem('rathna_custom_logo', base64);
        } catch {
          console.warn('Storage limit exceeded for custom logo');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-20 h-20',
    lg: 'w-32 h-32 sm:w-36 sm:h-36',
    xl: 'w-44 h-44',
  };

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      <div
        className={`relative flex items-center justify-center bg-transparent border-0 shadow-none p-0 overflow-hidden ${sizeClasses[size]}`}
      >
        {customLogo ? (
          <img
            src={customLogo}
            alt="Rathna Super Official Logo"
            className="w-full h-full object-contain select-none"
          />
        ) : (
          /* High-Fidelity SVG Brand Mark for Rathna Super (Emerald, Ruby & Gold) */
          <svg
            viewBox="0 0 160 160"
            className="w-full h-full select-none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Shield / Emblem Contour */}
            <rect
              x="6"
              y="6"
              width="148"
              height="148"
              rx="28"
              className="fill-emerald-800 dark:fill-emerald-950 stroke-amber-500/70"
              strokeWidth="3.5"
            />
            {/* Inner Border Ring */}
            <rect
              x="14"
              y="14"
              width="132"
              height="132"
              rx="22"
              className="stroke-amber-400/40"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />

            {/* Shopping Cart & Crown Sparkle Motif */}
            <g transform="translate(42, 28)">
              {/* Crown / Star Sparkle */}
              <path
                d="M38 4 L41 12 L49 15 L41 18 L38 26 L35 18 L27 15 L35 12 Z"
                className="fill-amber-400"
              />
              {/* Retail Basket / Cart Silhouette in Gold */}
              <path
                d="M12 28 H64 L56 54 H22 L14 30"
                stroke="#FBBF24"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="fill-emerald-900/60"
              />
              <circle cx="26" cy="62" r="4.5" className="fill-amber-400" />
              <circle cx="52" cy="62" r="4.5" className="fill-amber-400" />
              <path
                d="M8 22 H14 L18 34"
                stroke="#FBBF24"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </g>

            {/* Brand Typography: RATHNA SUPER */}
            {/* Red / Ruby Banner */}
            <rect
              x="16"
              y="98"
              width="128"
              height="26"
              rx="7"
              className="fill-rose-700 dark:fill-rose-800"
            />
            <text
              x="80"
              y="116"
              textAnchor="middle"
              className="fill-white font-sans font-black tracking-widest text-[15px]"
              style={{ fontWeight: 900, letterSpacing: '0.14em' }}
            >
              RATHNA
            </text>

            {/* "SUPER" Subtitle */}
            <text
              x="80"
              y="138"
              textAnchor="middle"
              className="fill-amber-300 font-sans font-bold text-[12px] tracking-[0.25em]"
              style={{ fontWeight: 800 }}
            >
              SUPER
            </text>
          </svg>
        )}
      </div>

      {/* Optional Custom Logo Upload Button */}
      {showUploadOption && (
        <label className="mt-2 text-[11px] text-amber-700 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1 font-medium">
          <span>Change / Upload Brand Logo</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
};
