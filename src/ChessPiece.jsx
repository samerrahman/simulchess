import React from 'react';

/**
 * Modern Neo-Staunton Vector Chess Pieces
 * Crisp geometric curves, clean outlines, high contrast on any board theme.
 */
export function ChessPiece({ type, color, className = '', style = {} }) {
  const isWhite = color === 'w';
  const fillPrimary = isWhite ? '#ffffff' : '#1e293b';
  const strokePrimary = isWhite ? '#1e293b' : '#0f172a';
  const accentDetail = isWhite ? '#334155' : '#94a3b8';

  switch (type) {
    case 'p': // Pawn
      return (
        <svg viewBox="0 0 100 100" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Base */}
            <path d="M 22 88 C 30 84 70 84 78 88 L 78 92 L 22 92 Z" />
            <path d="M 28 84 C 36 80 64 80 72 84 L 70 76 L 30 76 Z" />
            {/* Body */}
            <path d="M 33 76 C 36 56 42 46 38 38 C 45 40 55 40 62 38 C 58 46 64 56 67 76 Z" />
            {/* Collar */}
            <path d="M 35 38 C 42 42 58 42 65 38 C 65 34 35 34 35 38 Z" />
            {/* Head Sphere */}
            <circle cx="50" cy="22" r="14" />
          </g>
          {/* Subtle interior highlight */}
          <path
            d="M 44 14 C 48 10 54 10 56 12"
            fill="none"
            stroke={accentDetail}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'n': // Knight
      return (
        <svg viewBox="0 0 100 100" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Base */}
            <path d="M 20 88 C 30 84 70 84 80 88 L 80 92 L 20 92 Z" />
            <path d="M 26 84 C 34 80 66 80 74 84 L 72 74 L 28 74 Z" />
            {/* Head & Mane */}
            <path d="M 28 74 C 26 62 24 50 32 40 C 26 38 20 44 18 38 C 16 30 24 24 30 20 C 34 16 38 12 44 10 C 48 8 52 14 54 14 C 58 10 66 12 70 18 C 76 26 78 38 78 50 C 78 64 74 70 72 74 Z" />
            {/* Muzzle */}
            <path d="M 30 20 C 26 22 24 28 22 34 C 22 40 28 44 34 44 C 38 44 42 38 42 34" fill="none" stroke={strokePrimary} strokeWidth="3" />
            {/* Eye */}
            <circle cx="36" cy="24" r="3.5" fill={accentDetail} stroke="none" />
            {/* Mane cuts */}
            <path d="M 64 22 C 58 28 58 34 60 38" fill="none" stroke={accentDetail} strokeWidth="2.5" />
            <path d="M 68 36 C 62 42 62 48 64 52" fill="none" stroke={accentDetail} strokeWidth="2.5" />
            <path d="M 68 50 C 62 56 62 62 64 66" fill="none" stroke={accentDetail} strokeWidth="2.5" />
          </g>
        </svg>
      );

    case 'b': // Bishop
      return (
        <svg viewBox="0 0 100 100" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Base */}
            <path d="M 22 88 C 30 84 70 84 78 88 L 78 92 L 22 92 Z" />
            <path d="M 26 84 C 34 80 66 80 74 84 L 70 76 L 30 76 Z" />
            {/* Body */}
            <path d="M 32 76 C 36 60 42 54 40 46 C 46 48 54 48 60 46 C 58 54 64 60 68 76 Z" />
            {/* Collar */}
            <path d="M 34 46 C 40 50 60 50 66 46 C 66 42 34 42 34 46 Z" />
            {/* Mitre Egg */}
            <path d="M 34 42 C 28 28 42 16 50 14 C 58 16 72 28 66 42 Z" />
            {/* Top Pommel */}
            <circle cx="50" cy="11" r="4.5" />
            {/* Mitre Slash */}
            <path d="M 44 22 L 56 34" fill="none" stroke={accentDetail} strokeWidth="3" />
            <circle cx="50" cy="28" r="2.5" fill={accentDetail} stroke="none" />
          </g>
        </svg>
      );

    case 'r': // Rook
      return (
        <svg viewBox="0 0 100 100" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Base */}
            <path d="M 20 88 C 30 84 70 84 80 88 L 80 92 L 20 92 Z" />
            <path d="M 24 84 C 34 80 66 80 76 84 L 72 74 L 28 74 Z" />
            {/* Tower Pillar */}
            <path d="M 30 74 L 34 36 L 66 36 L 70 74 Z" />
            {/* Cornice */}
            <path d="M 26 36 L 74 36 L 74 30 L 26 30 Z" />
            {/* Battlements (Castles) */}
            <path d="M 26 30 L 26 16 L 36 16 L 36 22 L 44 22 L 44 16 L 56 16 L 56 22 L 64 22 L 64 16 L 74 16 L 74 30 Z" />
          </g>
          {/* Subtle horizontal groove */}
          <line x1="33" y1="46" x2="67" y2="46" stroke={accentDetail} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'q': // Queen
      return (
        <svg viewBox="0 0 100 100" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Base */}
            <path d="M 20 88 C 30 84 70 84 80 88 L 80 92 L 20 92 Z" />
            <path d="M 24 84 C 34 80 66 80 76 84 L 70 74 L 30 74 Z" />
            {/* Waist */}
            <path d="M 32 74 C 38 58 44 54 40 46 C 46 48 54 48 60 46 C 56 54 62 58 68 74 Z" />
            {/* Crown Base */}
            <path d="M 28 46 C 40 50 60 50 72 46 L 76 40 L 24 40 Z" />
            {/* Crown Spikes */}
            <path d="M 24 40 L 20 22 L 34 32 L 50 18 L 66 32 L 80 22 L 76 40 Z" />
            {/* Crown Jewels */}
            <circle cx="20" cy="19" r="3.5" />
            <circle cx="35" cy="29" r="3" />
            <circle cx="50" cy="15" r="4.5" />
            <circle cx="65" cy="29" r="3" />
            <circle cx="80" cy="19" r="3.5" />
          </g>
          {/* Queen Necklace arc */}
          <path d="M 40 60 C 46 64 54 64 60 60" fill="none" stroke={accentDetail} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'k': // King
      return (
        <svg viewBox="0 0 100 100" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Base */}
            <path d="M 20 88 C 30 84 70 84 80 88 L 80 92 L 20 92 Z" />
            <path d="M 24 84 C 34 80 66 80 76 84 L 70 74 L 30 74 Z" />
            {/* Robe Body */}
            <path d="M 32 74 C 38 56 44 52 38 44 C 46 46 54 46 62 44 C 56 52 62 56 68 74 Z" />
            {/* Crown Base */}
            <path d="M 28 44 C 40 48 60 48 72 44 L 76 36 L 24 36 Z" />
            {/* Royal Cap */}
            <path d="M 24 36 C 22 24 34 20 40 22 C 44 18 56 18 60 22 C 66 20 78 24 76 36 Z" />
            {/* Cross on top */}
            <path d="M 50 7 L 50 19 M 44 12 L 56 12" stroke={strokePrimary} strokeWidth="4.5" strokeLinecap="round" />
          </g>
          {/* Royal Insignia Arc */}
          <path d="M 38 32 C 44 36 56 36 62 32" fill="none" stroke={accentDetail} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 42 58 C 47 62 53 62 58 58" fill="none" stroke={accentDetail} strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    default:
      return null;
  }
}
