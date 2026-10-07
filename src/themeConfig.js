import { createContext } from 'react';

export const THEMES = {
  // LIGHT THEMES
  daylight: {
    id: 'daylight',
    name: 'Daylight Marble',
    mode: 'light',
    description: 'Crisp bright white & soft sky slate with porcelain pieces.',
    darkSquare: '#94a3b8',
    lightSquare: '#f1f5f9',
    accent: '#2563eb',
    boardBorder: '#cbd5e1',
    pieceWhite: { fill: '#ffffff', stroke: '#334155', detail: '#334155' },
    pieceBlack: { fill: '#0f172a', stroke: '#020617', detail: '#f8fafc' }
  },
  solar: {
    id: 'solar',
    name: 'Warm Solar',
    mode: 'light',
    description: 'Warm golden cream & toasted wood with sandalwood ivory pieces.',
    darkSquare: '#d4a373',
    lightSquare: '#fefae0',
    accent: '#d97706',
    boardBorder: '#bc6c25',
    pieceWhite: { fill: '#fffdf5', stroke: '#78350f', detail: '#78350f' },
    pieceBlack: { fill: '#451a03', stroke: '#291002', detail: '#fef3c7' }
  },
  nordic: {
    id: 'nordic',
    name: 'Nordic Frost',
    mode: 'light',
    description: 'Clean arctic ice & pale cyan with frosted glass pieces.',
    darkSquare: '#5eead4',
    lightSquare: '#f0fdfa',
    accent: '#0d9488',
    boardBorder: '#2dd4bf',
    pieceWhite: { fill: '#ffffff', stroke: '#0f766e', detail: '#0f766e' },
    pieceBlack: { fill: '#134e4a', stroke: '#042f2e', detail: '#ccfbf1' }
  },

  // DARK THEMES
  midnight: {
    id: 'midnight',
    name: 'Midnight Slate',
    mode: 'dark',
    description: 'Modern cool indigo & dark slate with frosted glass.',
    darkSquare: '#2e384d',
    lightSquare: '#8f9bb3',
    accent: '#6366f1',
    boardBorder: '#1a2236',
    pieceWhite: { fill: '#ffffff', stroke: '#1b1b1b', detail: '#1b1b1b' },
    pieceBlack: { fill: '#262421', stroke: '#111111', detail: '#ffffff' }
  },
  tournament: {
    id: 'tournament',
    name: 'Tournament Green',
    mode: 'dark',
    description: 'Classic USCF tournament emerald green and buff squares.',
    darkSquare: '#2d734e',
    lightSquare: '#eeeed2',
    accent: '#10b981',
    boardBorder: '#183c29',
    pieceWhite: { fill: '#fffffd', stroke: '#1b1b1b', detail: '#1b1b1b' },
    pieceBlack: { fill: '#222222', stroke: '#111111', detail: '#ffffff' }
  },
  woodcraft: {
    id: 'woodcraft',
    name: 'Woodcraft Mahogany',
    mode: 'dark',
    description: 'Warm classical walnut and maple with boxwood & ebony pieces.',
    darkSquare: '#b58863',
    lightSquare: '#f0d9b5',
    accent: '#f59e0b',
    boardBorder: '#442a1b',
    pieceWhite: { fill: '#fdf8e2', stroke: '#5c3d28', detail: '#5c3d28' },
    pieceBlack: { fill: '#3b2314', stroke: '#1f1008', detail: '#d4a373' }
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    mode: 'dark',
    description: 'Electric neon cyan & magenta pieces on dark pitch matrix.',
    darkSquare: '#1e1b2e',
    lightSquare: '#473d68',
    accent: '#06b6d4',
    boardBorder: '#121020',
    pieceWhite: { fill: '#22d3ee', stroke: '#083344', detail: '#083344' },
    pieceBlack: { fill: '#f43f5e', stroke: '#4c0519', detail: '#ffe4e6' }
  }
};

export const ThemeContext = createContext(null);
