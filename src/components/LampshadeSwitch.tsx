import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  playLampSwitchSound,
  playChainTensionSound,
  playChainReleaseSound,
} from '../services/soundEffects';

interface LampshadeSwitchProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  variant?: 'login' | 'compact' | 'navbar' | 'side';
  className?: string;
  showHelperTooltip?: boolean;
  tooltipPosition?: 'bottom' | 'left';
}

export const LampshadeSwitch: React.FC<LampshadeSwitchProps> = ({
  theme,
  onToggleTheme,
  variant = 'side',
  className = '',
  showHelperTooltip = true,
  tooltipPosition = 'left',
}) => {
  // Pull state
  const [pullY, setPullY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isAnimatingSnap, setIsAnimatingSnap] = useState(false);

  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const lastSoundTickRef = useRef<number>(0);

  const isLight = theme === 'light';

  // Sizing by variant
  const isSide = variant === 'side';
  const isCompact = variant === 'compact' || variant === 'navbar';
  const isLargeLogin = variant === 'login';

  const shadeWidth = isLargeLogin ? 84 : isSide ? 58 : 46;
  const shadeHeight = isLargeLogin ? 52 : isSide ? 38 : 30;
  const baseCordLength = isLargeLogin ? 48 : isSide ? 38 : 28;
  const dragThreshold = isLargeLogin ? 32 : 22;
  const maxPull = isLargeLogin ? 64 : isSide ? 48 : 38;

  const currentCordLength = baseCordLength + pullY;

  // Trigger switch with animation & pleasant sound
  const triggerSwitch = useCallback(() => {
    const isTurningLight = theme === 'dark';
    playLampSwitchSound(isTurningLight);
    onToggleTheme();
    setHasInteracted(true);

    // Spring snap back animation
    setIsAnimatingSnap(true);
    setPullY(0);
    setTimeout(() => {
      setIsAnimatingSnap(false);
    }, 400);
  }, [theme, onToggleTheme]);

  // Pointer drag handling
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    startYRef.current = e.clientY;
    currentYRef.current = 0;
    lastSoundTickRef.current = 0;
    setIsDragging(true);
    playChainTensionSound();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startYRef.current;
    if (deltaY > 0) {
      // Elastic spring resistance
      const clamped = Math.min(maxPull, Math.pow(deltaY, 0.86) * 1.35);
      currentYRef.current = clamped;
      setPullY(clamped);

      // Play soft delicate bead ticks as drag progresses
      if (Math.abs(clamped - lastSoundTickRef.current) > 12) {
        playChainTensionSound();
        lastSoundTickRef.current = clamped;
      }
    } else {
      setPullY(0);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setIsDragging(false);

    // ONLY trigger switch when dragged down past threshold and dropped
    // Simply clicking or tapping without pulling will NOT switch the theme
    if (currentYRef.current >= dragThreshold) {
      triggerSwitch();
    } else {
      // Released without dragging down to threshold
      if (currentYRef.current > 4) {
        playChainReleaseSound();
      }
      setIsAnimatingSnap(true);
      setPullY(0);
      setTimeout(() => setIsAnimatingSnap(false), 240);
    }
  };

  // Keyboard accessibility: animates a pull and release cycle
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setPullY(dragThreshold + 4);
      setIsAnimatingSnap(true);
      setTimeout(() => {
        triggerSwitch();
      }, 120);
    }
  };

  const isArmed = pullY >= dragThreshold;

  // Bead count based on cord length
  const beadSpacing = 6;
  const beadCount = Math.max(3, Math.floor((currentCordLength - 10) / beadSpacing));

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none touch-none ${className}`}
      style={{
        // Strict fixed width & height frame to guarantee ZERO container resize or layout shift
        width: isSide ? '80px' : isLargeLogin ? '110px' : '64px',
        height: isSide ? '190px' : isLargeLogin ? '210px' : '140px',
      }}
    >
      {/* 
        Light Beams:
        1. Light Mode: Gorgeous center-fade warm golden ambient illumination with very slow-fading glow animation
        2. Night Mode: Delicate center-fade soft yellow ambient shading fading very slowly ("yanthan yelloow shading")
      */}
      {isLight ? (
        <>
          {/* Outer soft ambient center-fade light beam with slow breathing glow */}
          <div
            className="pointer-events-none absolute z-0 animate-glow-slow"
            style={{
              top: isSide ? '56px' : '62px',
              width: isSide ? '200px' : '240px',
              height: isSide ? '210px' : '250px',
              left: '50%',
              background:
                'radial-gradient(ellipse at 50% 0%, rgba(254, 240, 138, 0.48) 0%, rgba(251, 191, 36, 0.24) 34%, rgba(245, 158, 11, 0.07) 64%, transparent 84%)',
              maskImage:
                'radial-gradient(ellipse 50% 80% at 50% 15%, black 35%, transparent 100%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 50% 80% at 50% 15%, black 35%, transparent 100%)',
            }}
          />
          {/* Inner warm core halo right at the lamp opening for radiant center depth */}
          <div
            className="pointer-events-none absolute z-0 animate-glow-slow"
            style={{
              top: isSide ? '58px' : '64px',
              width: isSide ? '84px' : '100px',
              height: isSide ? '60px' : '72px',
              left: '50%',
              background:
                'radial-gradient(circle at 50% 15%, rgba(254, 243, 199, 0.70) 0%, rgba(251, 191, 36, 0.32) 48%, transparent 78%)',
              animationDelay: '-3s', // subtle organic depth phase
            }}
          />
        </>
      ) : (
        /* Night View: Very faint, soft warm yellow ambient center-fade shading ("yanthan yellow shading color ekaking paththuwenawa wage godak yanthan") */
        <>
          <div
            className="pointer-events-none absolute z-0 animate-night-glow-slow"
            style={{
              top: isSide ? '60px' : '66px',
              width: isSide ? '130px' : '160px',
              height: isSide ? '130px' : '150px',
              left: '50%',
              background:
                'radial-gradient(ellipse at 50% 0%, rgba(253, 224, 71, 0.22) 0%, rgba(245, 158, 11, 0.08) 45%, transparent 80%)',
              maskImage:
                'radial-gradient(ellipse 50% 75% at 50% 15%, black 30%, transparent 100%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 50% 75% at 50% 15%, black 30%, transparent 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute z-0 animate-night-glow-slow"
            style={{
              top: isSide ? '60px' : '66px',
              width: isSide ? '52px' : '64px',
              height: isSide ? '36px' : '44px',
              left: '50%',
              background:
                'radial-gradient(circle at 50% 20%, rgba(253, 224, 71, 0.32) 0%, rgba(245, 158, 11, 0.10) 50%, transparent 75%)',
              animationDelay: '-3.75s',
            }}
          />
        </>
      )}

      {/* Ceiling Suspension Cord / Wire */}
      <div
        className={`w-[1.5px] bg-gradient-to-b from-stone-400 dark:from-stone-600 via-amber-700/60 dark:via-stone-500 to-amber-700 dark:to-stone-400 transition-colors ${
          isSide ? 'h-14 sm:h-20' : isLargeLogin ? 'h-8' : 'h-4'
        }`}
      />

      {/* Top Brass Fixture Socket & Finial */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Brass suspension ring */}
        <div
          className={`rounded-full border transition-colors duration-200 ${
            isLight
              ? 'border-amber-600 bg-amber-500/20'
              : 'border-stone-600 bg-stone-700/40'
          } ${isSide ? 'w-2 h-2 mb-0.5' : 'w-2.5 h-2.5 mb-0.5'}`}
        />
        {/* Brass socket collar */}
        <div
          className={`rounded-t-sm shadow-inner transition-colors duration-200 ${
            isLight
              ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 border border-amber-600'
              : 'bg-gradient-to-r from-stone-700 via-stone-600 to-stone-800 border border-stone-600'
          } ${isSide ? 'w-3.5 h-1.5' : isLargeLogin ? 'w-5 h-2.5' : 'w-3 h-1.5'}`}
        />
      </div>

      {/* Smooth, Ultra-Lassana Modern Lampshade Body */}
      <div
        className={`relative z-10 transition-transform duration-150 ${
          isAnimatingSnap ? 'animate-bounce-subtle' : ''
        }`}
        style={{
          // Only tiny micro-deflection when pulling cord, preventing any jarring layout jump
          transform: `translateY(${Math.min(2.5, pullY * 0.06)}px)`,
        }}
      >
        <svg
          width={shadeWidth}
          height={shadeHeight}
          viewBox="0 0 100 68"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-md overflow-visible"
        >
          <defs>
            {/* Light Mode - Warm Ivory Porcelain & Linen Gradient */}
            <linearGradient id="shadeLightSmoothGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFDF5" />
              <stop offset="28%" stopColor="#FEF3C7" />
              <stop offset="65%" stopColor="#FDE68A" />
              <stop offset="92%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>

            {/* Night Mode - Sleek Matte Slate & Warm Obsidian Gradient */}
            <linearGradient id="shadeDarkSmoothGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#292524" />
              <stop offset="35%" stopColor="#1C1917" />
              <stop offset="75%" stopColor="#141211" />
              <stop offset="100%" stopColor="#0C0A09" />
            </linearGradient>

            {/* Light Mode Radiant Bulb Glow */}
            <radialGradient id="bulbGlowRadiant" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#FEF08A" />
              <stop offset="75%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>

            {/* Night View - Delicate Faint Warm Yellow Bulb Glow ("yanthan yelloow shading") */}
            <radialGradient id="bulbGlowNightSubtle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#FDE047" stopOpacity="0.75" />
              <stop offset="75%" stopColor="#D97706" stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>

            <filter id="lampGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Night view soft filament filter */}
            <filter id="nightFilamentGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Smooth Curved Bell Silhouette: Flowing Bézier contours */}
          <path
            d="M 32 6 C 31 16, 26 34, 18 48 C 13 56, 6 57, 4 58 C 30 66, 70 66, 96 58 C 94 57, 87 56, 82 48 C 74 34, 69 16, 68 6 Z"
            fill={isLight ? 'url(#shadeLightSmoothGrad)' : 'url(#shadeDarkSmoothGrad)'}
            stroke={isLight ? '#B45309' : '#44403C'}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Smooth Silk Sheen / Curvature Highlight */}
          <path
            d="M 44 7 C 43 20, 39 36, 32 50 C 30 54, 28 58, 26 60"
            stroke={isLight ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.08)'}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M 52 7 C 52 22, 51 38, 48 54 C 47 57, 46 60, 45 62"
            stroke={isLight ? 'rgba(255, 255, 255, 0.65)' : 'rgba(255, 255, 255, 0.12)'}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M 60 7 C 60 20, 62 36, 68 50 C 70 54, 72 58, 74 60"
            stroke={isLight ? 'rgba(180, 83, 9, 0.22)' : 'rgba(0, 0, 0, 0.45)'}
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Top Rim Collar */}
          <ellipse
            cx="50"
            cy="6"
            rx="18"
            ry="3.5"
            fill={isLight ? '#D97706' : '#292524'}
            stroke={isLight ? '#B45309' : '#44403C'}
            strokeWidth="1.5"
          />

          {/* Bottom Rim Bevel Accent */}
          <ellipse
            cx="50"
            cy="58"
            rx="46"
            ry="7.5"
            fill={
              isLight
                ? '#F59E0B'
                : /* Subtle amber bounce light on rim during night view */
                  '#1E1B18'
            }
            stroke={isLight ? '#D97706' : '#3E3834'}
            strokeWidth="1.8"
          />

          {/* 
            Lampshade Bulb:
            Light Mode: Full glowing orb
            Night Mode: Faint, delicate warm yellow filament and shading ("yanthan yelloow shading color akaking paththuwenawa wage godak yanthan")
          */}
          {isLight ? (
            <g filter="url(#lampGlowFilter)">
              <ellipse cx="50" cy="56" rx="14" ry="9" fill="url(#bulbGlowRadiant)" />
              <circle cx="50" cy="56" r="5" fill="#FFFFFF" />
            </g>
          ) : (
            /* Night Mode Faint Yellow Bulb Glow */
            <g>
              {/* Soft ambient yellow halo peeking around bulb */}
              <ellipse
                cx="50"
                cy="56"
                rx="16"
                ry="10"
                fill="url(#bulbGlowNightSubtle)"
                filter="url(#nightFilamentGlow)"
              />
              {/* Translucent glass bulb dome */}
              <ellipse
                cx="50"
                cy="56"
                rx="11"
                ry="7"
                fill="#2E261B"
                stroke="#D97706"
                strokeWidth="0.8"
                strokeOpacity="0.6"
              />
              {/* Very faint, glowing warm yellow-amber vintage filament */}
              <path
                d="M 45 56 Q 48 53 50 56 Q 52 59 55 56"
                stroke="#FEF08A"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.9"
                filter="url(#nightFilamentGlow)"
              />
              {/* Tiny warm yellow filament hotspot */}
              <circle cx="50" cy="56" r="2.2" fill="#FEF08A" opacity="0.95" />
            </g>
          )}

          {/* Brass switch socket collar where cord originates */}
          <rect
            x="46"
            y="59"
            width="8"
            height="4"
            rx="1.5"
            fill={isLight ? '#D97706' : '#57534E'}
            stroke={isLight ? '#B45309' : '#292524'}
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* 
        The Pull Cord & Brass Acorn Handle
        Positioned in a fixed absolute container extending downward from the shade
        so that height changes NEVER alter the parent container's layout or trigger -translate-y-1/2 shifts!
      */}
      <div
        className="relative flex flex-col items-center cursor-ns-resize group focus:outline-none"
        style={{
          marginTop: '-1px',
          transition: isAnimatingSnap
            ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'none',
        }}
      >
        {/* Dynamic Beaded Chain / Cord SVG */}
        <svg
          width={18}
          height={currentCordLength}
          viewBox={`0 0 20 ${currentCordLength}`}
          className="overflow-visible pointer-events-none"
        >
          {/* Subtle chain shadow */}
          <line
            x1="10.5"
            y1="0"
            x2="10.5"
            y2={currentCordLength - 10}
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="1.2"
          />

          {/* Central chain wire */}
          <line
            x1="10"
            y1="0"
            x2="10"
            y2={currentCordLength - 10}
            stroke={isLight ? '#B45309' : '#78716C'}
            strokeWidth="1.2"
          />

          {/* Metallic Beads */}
          {Array.from({ length: beadCount }).map((_, idx) => {
            const cy = 4 + idx * beadSpacing;
            if (cy > currentCordLength - 10) return null;
            return (
              <g key={idx}>
                <circle
                  cx="10"
                  cy={cy}
                  r={1.6}
                  fill={isLight ? '#F59E0B' : '#A8A29E'}
                  stroke={isLight ? '#B45309' : '#57534E'}
                  strokeWidth="0.6"
                />
                <circle
                  cx="9.4"
                  cy={cy - 0.5}
                  r="0.5"
                  fill="#FFFFFF"
                  opacity={isLight ? 0.9 : 0.6}
                />
              </g>
            );
          })}
        </svg>

        {/* Drag / Click Handle Knob (Brass Teardrop Acorn Switch) */}
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          aria-label={`Toggle theme. Currently ${theme} mode. Pull down and release to switch.`}
          className={`relative z-20 flex items-center justify-center rounded-full transition-all duration-150 touch-none focus:outline-none focus:ring-2 focus:ring-amber-500/70 w-5 h-7 ${
            isArmed
              ? 'scale-110 ring-2 ring-amber-400 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]'
              : isDragging
              ? 'scale-105 bg-amber-500 shadow-md'
              : 'hover:scale-110 active:scale-95'
          }`}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          {/* Acorn / Teardrop shape */}
          <svg
            viewBox="0 0 24 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-sm pointer-events-none"
          >
            <defs>
              <linearGradient id="acornLightGradSmooth" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <linearGradient id="acornDarkGradSmooth" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D6D3D1" />
                <stop offset="50%" stopColor="#78716C" />
                <stop offset="100%" stopColor="#44403C" />
              </linearGradient>
            </defs>

            {/* Brass Cap */}
            <rect
              x="8"
              y="2"
              width="8"
              height="3"
              rx="1.5"
              fill={isArmed ? '#FDE68A' : isLight ? '#D97706' : '#57534E'}
            />

            {/* Teardrop Acorn Body */}
            <path
              d="M 6 6 C 6 4 18 4 18 6 C 21 15 20 22 12 30 C 4 22 3 15 6 6 Z"
              fill={
                isArmed
                  ? '#F59E0B'
                  : isLight
                  ? 'url(#acornLightGradSmooth)'
                  : 'url(#acornDarkGradSmooth)'
              }
              stroke={isArmed ? '#FDE68A' : isLight ? '#92400E' : '#292524'}
              strokeWidth="1.2"
            />

            {/* Specular Highlight Sheen */}
            <ellipse
              cx="10"
              cy="12"
              rx="2.5"
              ry="5"
              fill="#FFFFFF"
              opacity={isArmed ? 0.9 : 0.55}
              transform="rotate(-15 10 12)"
            />
          </svg>

          {/* Pulse ring when idle and user hasn't interacted yet */}
          {!hasInteracted && !isDragging && (
            <span className="absolute -inset-1 rounded-full bg-amber-400/30 animate-ping pointer-events-none" />
          )}
        </button>

        {/* Tactile indicator badge when dragging */}
        {isDragging && (
          <div
            className={`absolute top-full mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide whitespace-nowrap shadow-lg pointer-events-none transition-all ${
              isArmed
                ? 'bg-amber-500 text-white ring-2 ring-amber-300 scale-105'
                : 'bg-stone-900/90 text-stone-200 backdrop-blur-sm'
            }`}
          >
            {isArmed ? 'Release! ⚡' : 'Pull down ↓'}
          </div>
        )}
      </div>
    </div>
  );
};
