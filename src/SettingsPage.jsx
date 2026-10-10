import React from 'react';
import { 
  Palette, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Check, 
  ArrowLeft,
  Zap,
  RotateCcw
} from 'lucide-react';
import { useTheme } from './useTheme';

export default function SettingsPage({ onNavigateToPlay }) {
  const { 
    setThemeId, 
    soundEnabled, 
    setSoundEnabled,
    animationSpeed,
    setAnimationSpeed
  } = useTheme();

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
              <h1 className="settings-title">Preferences</h1>
              <p className="settings-subtitle">Theme, audio, and gameplay preferences.</p>
            </div>
          </div>
        </div>

        {/* Visual Theme Section */}
        <div className="settings-section">
          <div className="section-header-row">
            <Palette size={20} className="text-amber" />
            <h2 className="section-heading">Theme</h2>
          </div>

          <div className="settings-option-card">
            <div className="option-info">
              <span className="option-title">Midnight Slate</span>
              <span className="option-sub">Tournament standard slate chessboard with high-contrast tournament pieces.</span>
            </div>
            <span className="theme-active-tag">
              <Check size={12} />
              <span>Active</span>
            </span>
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
