import React from 'react';

/**
 * Official Tournament Standard Chess Pieces (C. Burnett Vector Set)
 * The global standard used on Lichess, Wikipedia, and chess engines.
 */
export function ChessPiece({ type, color, className = '', style = {} }) {
  const isWhite = color === 'w';

  // Crisp tournament styling: warm off-white for White, deep graphite for Black
  const fillPrimary = isWhite ? '#ffffff' : '#262421';
  const strokePrimary = isWhite ? '#1b1b1b' : '#1b1b1b';
  const detailStroke = isWhite ? '#1b1b1b' : '#ffffff';

  switch (type) {
    case 'p': // Pawn
      return (
        <svg viewBox="0 0 45 45" className={className} style={style}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 1.47,-1.19 2.41,-3 2.41,-5.03 0,-2.41 -1.33,-4.5 -3.28,-5.62 0.49,-0.67 0.78,-1.49 0.78,-2.38 0,-2.21 -1.79,-4 -4,-4 z"
            fill={fillPrimary}
            stroke={strokePrimary}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'n': // Knight
      return (
        <svg viewBox="0 0 45 45" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" />
            <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,7.4 17.07,8.06 17.07,8.06 C 18.57,6.86 21.07,7.06 22,10 z" />
            <circle cx="9.5" cy="25.5" r="1" fill={detailStroke} stroke="none" />
            <path d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z" fill={detailStroke} stroke="none" />
          </g>
        </svg>
      );

    case 'b': // Bishop
      return (
        <svg viewBox="0 0 45 45" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
            <path d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z" />
            <path d="m 25 8 a 2.5 2.5 0 1 1 -5,0 a 2.5 2.5 0 1 1 5,0 z" />
            <path d="M 17.5,26 L 27.5,26" fill="none" />
            <path d="M 15,30 L 30,30" fill="none" />
            <path d="M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18" fill="none" stroke={detailStroke} />
          </g>
        </svg>
      );

    case 'r': // Rook
      return (
        <svg viewBox="0 0 45 45" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" />
            <path d="M 12,36 L 12,32 L 33,32 L 33,36 z" />
            <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 z" />
            <path d="M 34,14 L 31,17 L 14,17 L 11,14 z" />
            <path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17 z" />
            <path d="M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5 z" />
            <path d="M 11,14 L 34,14" fill="none" />
          </g>
        </svg>
      );

    case 'q': // Queen
      return (
        <svg viewBox="0 0 45 45" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 9 13 A 2 2 0 1 1 5,13 A 2 2 0 1 1 9 13 z" />
            <path d="M 24 10.5 A 2 2 0 1 1 20,10.5 A 2 2 0 1 1 24 10.5 z" />
            <path d="M 39 13 A 2 2 0 1 1 35,13 A 2 2 0 1 1 39 13 z" />
            <path d="M 16.5 11.5 A 2 2 0 1 1 12.5,11.5 A 2 2 0 1 1 16.5 11.5 z" />
            <path d="M 31.5 11.5 A 2 2 0 1 1 27.5,11.5 A 2 2 0 1 1 31.5 11.5 z" />
            <path d="M 9,26 C 17.5,34 27.5,34 36,26 L 38.5,14.5 L 31,25 L 22.5,12 L 14,25 L 6.5,14.5 z" />
            <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.5,36 10.5,36 C 9,37.5 11,38.5 11,38.5 L 34,38.5 C 34,38.5 36,37.5 34.5,36 C 34.5,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 z" />
            <path d="M 11.5,30 C 15,29 30,29 33.5,30" fill="none" />
            <path d="M 12,33.5 C 18,32.5 27,32.5 33,33.5" fill="none" />
          </g>
        </svg>
      );

    case 'k': // King
      return (
        <svg viewBox="0 0 45 45" className={className} style={style}>
          <g fill={fillPrimary} stroke={strokePrimary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 22.5,11.63 L 22.5,6" fill="none" stroke={detailStroke} />
            <path d="M 20,8 L 25,8" fill="none" stroke={detailStroke} />
            <path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 22.5,25 z" />
            <path d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 C 33.5,34 32,32 30,30.5 C 26,29 19,29 15,30.5 C 13,32 11.5,34 11.5,37 z" />
            <path d="M 12,36 C 17,39 28,39 33,36" fill="none" />
            <path d="M 11.5,30 C 15,27 15,20 22.5,20 C 30,20 30,27 33.5,30" />
            <path d="M 20,20 C 20,15 15,16 13,18 C 11,20 12,23 15,25" />
            <path d="M 25,20 C 25,15 30,16 32,18 C 34,20 33,23 30,25" />
          </g>
        </svg>
      );

    default:
      return null;
  }
}
