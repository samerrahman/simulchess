import React, { useState } from 'react';
import { 
  Palette, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Check, 
  ArrowLeft,
  Zap,
  RotateCcw,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from './useTheme';
import { ChessPiece } from './ChessPiece';

export default function SettingsPage({ onNavigateToPlay }) {
  const { 
    themeId, 
    setThemeId, 
    themes, 
    soundEnabled, 
    setSoundEnabled,
    animationSpeed,
    setAnimationSpeed
  } = useTheme();

  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'light' | 'dark'

  return (
    <div className="page-container settings-page">
      <div className="page-header-nav">
        <button className="btn btn-secondary btn-sm" onClick={onNavigateToPlay}>
          <ArrowLeft size={16} />
          <span>Back to Play</span>
        </button>
      </div>

      <div className="settings-content-wrapper">
        <div className="settings-header">
          <div className="settings-title-group">
            <Sliders size={26} className="text-accent" />
            <div>
              <h1 className="settings-title">Preferences & Themes</h1>
              <p className="settings-subtitle">Customize your visual board theme, website styling, and game effects.</p>
            </div>
          </div>
        </div>

        {/* Theme Picker Section */}
        <div className="settings-section">
          <div className="section-header-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Palette size={20} className="text-amber" />
              <h2 className="section-heading">Visual & Chessboard Themes</h2>
            </div>
            
            {/* Filter pills: All, Light, Dark */}
            <div className="theme-filter-pills">
              <button 
                className={`theme-filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All ({Object.keys(themes).length})
              </button>
              <button 
                className={`theme-filter-btn ${filterMode === 'light' ? 'active' : ''}`}
                onClick={() => setFilterMode('light')}
              >
                <Sun size={13} className="text-amber" />
                <span>Light ({Object.values(themes).filter(t => t.mode === 'light').length})</span>
              </button>
              <button 
                className={`theme-filter-btn ${filterMode === 'dark' ? 'active' : ''}`}
                onClick={() => setFilterMode('dark')}
              >
                <Moon size={13} className="text-accent" />
                <span>Dark ({Object.values(themes).filter(t => t.mode === 'dark').length})</span>
              </button>
            </div>
          </div>

          <p className="section-desc">
            Each theme changes the board squares, custom chess piece styling, and the entire website environment.
          </p>

          <div className="themes-grid">
            {Object.values(themes)
              .filter(t => filterMode === 'all' || t.mode === filterMode)
              .map((t) => {
                const isSelected = t.id === themeId;
                return (
                  <div 
                    key={t.id} 
                    className={`theme-card ${isSelected ? 'theme-card-selected' : ''}`}
                    onClick={() => setThemeId(t.id)}
                  >
                    {/* Mini Chessboard Swatch Preview with themed pieces */}
                    <div className="theme-board-preview" style={{ borderColor: t.boardBorder }}>
                      <div className="preview-sq" style={{ backgroundColor: t.lightSquare }}>
                        <ChessPiece 
                          type="n" 
                          color="w" 
                          style={{ 
                            width: 22, 
                            height: 22,
                            '--piece-w-fill': t.pieceWhite?.fill || '#ffffff',
                            '--piece-w-stroke': t.pieceWhite?.stroke || '#1b1b1b',
                            '--piece-w-detail': t.pieceWhite?.detail || '#1b1b1b'
                          }} 
                        />
                      </div>
                      <div className="preview-sq" style={{ backgroundColor: t.darkSquare }}></div>
                      <div className="preview-sq" style={{ backgroundColor: t.darkSquare }}></div>
                      <div className="preview-sq" style={{ backgroundColor: t.lightSquare }}>
                        <ChessPiece 
                          type="p" 
                          color="b" 
                          style={{ 
                            width: 20, 
                            height: 20,
                            '--piece-b-fill': t.pieceBlack?.fill || '#262421',
                            '--piece-b-stroke': t.pieceBlack?.stroke || '#111111',
                            '--piece-b-detail': t.pieceBlack?.detail || '#ffffff'
                          }} 
                        />
                      </div>
                    </div>

                    <div className="theme-info">
                      <div className="theme-name-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span className="theme-name">{t.name}</span>
                          <span className={`theme-mode-tag ${t.mode === 'light' ? 'mode-light' : 'mode-dark'}`}>
                            {t.mode === 'light' ? '☀️ Light' : '🌙 Dark'}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="theme-active-tag">
                            <Check size={12} />
                            <span>Active</span>
                          </span>
                        )}
                      </div>
                      <p className="theme-desc">{t.description}</p>
                      
                      <div className="theme-meta-row">
                        <div className="theme-palette-dots" title="Board & Accent Colors">
                          <span className="palette-dot" style={{ backgroundColor: t.accent }} title="Accent" />
                          <span className="palette-dot" style={{ backgroundColor: t.darkSquare }} title="Dark square" />
                          <span className="palette-dot" style={{ backgroundColor: t.lightSquare }} title="Light square" />
                        </div>

                        <div className="theme-pieces-swatch" title="Theme Piece Colors (White / Black)">
                          <span className="piece-dot" style={{ backgroundColor: t.pieceWhite?.fill, borderColor: t.pieceWhite?.stroke }} title="White piece color" />
                          <span className="piece-dot" style={{ backgroundColor: t.pieceBlack?.fill, borderColor: t.pieceBlack?.stroke }} title="Black piece color" />
                          <span className="piece-tag-text">Themed Pieces</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Audio & Gameplay Preferences */}
        <div className="settings-section">
          <div className="section-header-row">
            <Volume2 size={20} className="text-emerald" />
            <h2 className="section-heading">Audio & Sounds</h2>
          </div>

          <div className="settings-option-card">
            <div className="option-info">
              <span className="option-title">Game Sound Effects</span>
              <span className="option-sub">Play subtle audio feedback when locking in moves, resolving collisions, or capturing pieces.</span>
            </div>
            <button 
              className={`btn btn-sm ${soundEnabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? (
                <>
                  <Volume2 size={16} />
                  <span>Sounds ON</span>
                </>
              ) : (
                <>
                  <VolumeX size={16} />
                  <span>Sounds OFF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Animation Preferences */}
        <div className="settings-section">
          <div className="section-header-row">
            <Zap size={20} className="text-accent" />
            <h2 className="section-heading">Move Animations</h2>
          </div>

          <div className="settings-option-card">
            <div className="option-info">
              <span className="option-title">Resolution Animation Speed</span>
              <span className="option-sub">Control how pieces glide across the board during simultaneous turn resolution.</span>
            </div>

            <div className="anim-toggle-group">
              <button 
                className={`btn btn-xs ${animationSpeed === 'normal' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAnimationSpeed('normal')}
              >
                Smooth Glide
              </button>
              <button 
                className={`btn btn-xs ${animationSpeed === 'fast' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAnimationSpeed('fast')}
              >
                Fast
              </button>
              <button 
                className={`btn btn-xs ${animationSpeed === 'instant' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAnimationSpeed('instant')}
              >
                Instant
              </button>
            </div>
          </div>
        </div>

        {/* Reset Defaults */}
        <div className="settings-footer-row">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setThemeId('midnight');
              setSoundEnabled(true);
              setAnimationSpeed('normal');
            }}
          >
            <RotateCcw size={14} />
            <span>Reset to Defaults</span>
          </button>
        </div>
      </div>
    </div>
  );
}
