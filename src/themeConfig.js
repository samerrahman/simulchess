import { createContext } from 'react';

export const THEMES = {
  midnight: {
    id: 'midnight',
    name: 'Midnight Slate',
    description: 'Modern cool indigo & dark slate with frosted glass.',
    darkSquare: '#2e384d',
    lightSquare: '#8f9bb3',
    accent: '#6366f1',
    boardBorder: '#1a2236'
  },
  tournament: {
    id: 'tournament',
    name: 'Tournament Green',
    description: 'Classic USCF tournament emerald green and buff squares.',
    darkSquare: '#2d734e',
    lightSquare: '#eeeed2',
    accent: '#10b981',
    boardBorder: '#183c29'
  },
  woodcraft: {
    id: 'woodcraft',
    name: 'Woodcraft Mahogany',
    description: 'Warm classical walnut and maple wood tones.',
    darkSquare: '#b58863',
    lightSquare: '#f0d9b5',
    accent: '#f59e0b',
    boardBorder: '#442a1b'
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'High-tech pitch black with neon cyan and electric magenta.',
    darkSquare: '#1e1b2e',
    lightSquare: '#473d68',
    accent: '#06b6d4',
    boardBorder: '#121020'
  },
  monochrome: {
    id: 'monochrome',
    name: 'Monochrome Minimalist',
    description: 'High-contrast matte charcoal and crisp paper white.',
    darkSquare: '#333333',
    lightSquare: '#e5e7eb',
    accent: '#94a3b8',
    boardBorder: '#1f1f1f'
  }
};

export const ThemeContext = createContext(null);
