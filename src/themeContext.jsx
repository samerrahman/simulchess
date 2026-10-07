import React, { useState, useEffect } from 'react';
import { THEMES, ThemeContext } from './themeConfig';

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('simulchess_theme') || 'midnight';
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('simulchess_sound');
    return saved !== null ? saved === 'true' : true;
  });

  const [animationSpeed, setAnimationSpeed] = useState(() => {
    return localStorage.getItem('simulchess_anim_speed') || 'normal';
  });

  const activeTheme = THEMES[themeId] || THEMES.midnight;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('simulchess_theme', themeId);

    const theme = THEMES[themeId] || THEMES.midnight;
    if (theme.pieceWhite) {
      document.documentElement.style.setProperty('--piece-w-fill', theme.pieceWhite.fill);
      document.documentElement.style.setProperty('--piece-w-stroke', theme.pieceWhite.stroke);
      document.documentElement.style.setProperty('--piece-w-detail', theme.pieceWhite.detail);
    }
    if (theme.pieceBlack) {
      document.documentElement.style.setProperty('--piece-b-fill', theme.pieceBlack.fill);
      document.documentElement.style.setProperty('--piece-b-stroke', theme.pieceBlack.stroke);
      document.documentElement.style.setProperty('--piece-b-detail', theme.pieceBlack.detail);
    }
  }, [themeId]);

  useEffect(() => {
    localStorage.setItem('simulchess_sound', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('simulchess_anim_speed', animationSpeed);
  }, [animationSpeed]);

  return (
    <ThemeContext.Provider value={{
      themeId,
      setThemeId,
      activeTheme,
      themes: THEMES,
      soundEnabled,
      setSoundEnabled,
      animationSpeed,
      setAnimationSpeed
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
