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
