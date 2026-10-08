import React from 'react';
import { HelpCircle, X, Check } from 'lucide-react';

export default function HowToPlayModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="how-to-play-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="how-to-play-header">
          <div className="how-to-play-title-group">
            <div className="how-to-play-icon-badge">
              <HelpCircle size={22} />
            </div>
            <h3>How to Play SimulChess</h3>
          </div>
          <button 
            className="btn-icon close-modal-btn" 
            onClick={onClose} 
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="how-to-play-body">
          <div className="rule-item">
            <div className="rule-badge">1</div>
            <div className="rule-text">
              <strong>Simultaneous Resolution</strong>
              <p>Both moves execute at the same time each turn. Moves remain hidden until the turn resolves.</p>
            </div>
          </div>

          <div className="rule-item">
            <div className="rule-badge">2</div>
            <div className="rule-text">
              <strong>Collisions</strong>
              <p>If both players target the same square, both pieces destroy each other.</p>
            </div>
          </div>

          <div className="rule-item">
            <div className="rule-badge">3</div>
            <div className="rule-text">
              <strong>Square Swaps</strong>
              <p>Pieces swapping squares pass each other safely.</p>
            </div>
          </div>

          <div className="rule-item">
            <div className="rule-badge">4</div>
            <div className="rule-text">
              <strong>Defend & Counter-Ambush</strong>
              <p>You can move onto a friendly piece to guard it. If the opponent attacks that square, your defender takes their piece. If not, your piece holds position.</p>
            </div>
          </div>

          <div className="rule-item">
            <div className="rule-badge">5</div>
            <div className="rule-text">
              <strong>King Capture</strong>
              <p>Capturing the opponent's King wins the game immediately.</p>
            </div>
          </div>
        </div>

        <div className="how-to-play-footer">
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            <Check size={16} /> Got it
          </button>
        </div>
      </div>
    </div>
  );
}
