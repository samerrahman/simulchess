import { createContext } from 'react';

export const THEMES = {
  midnight: {
    id: 'midnight',
    name: 'Midnight Slate',
    mode: 'dark',
    description: 'Modern cool indigo & dark slate with frosted glass.',
    darkSquare: '#8ca2ad',
    lightSquare: '#dee3e6',
    accent: '#3692e7',
    boardBorder: '#262421',
    pieceWhite: { fill: '#ffffff', stroke: '#1b1b1b', detail: '#1b1b1b' },
    pieceBlack: { fill: '#262421', stroke: '#111111', detail: '#ffffff' }
  }
};

export const ThemeContext = createContext(null);
