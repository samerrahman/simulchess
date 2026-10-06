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
              <strong>Simultaneous Moves</strong>
              <p>Both players make their moves at the same time. Select or drag a piece to lock in your move. Neither player sees the other's move until both have locked in.</p>
            </div>
          </div>

          <div className="rule-item">
            <div className="rule-badge">2</div>
            <div className="rule-text">
              <strong>Same-Square Collisions</strong>
              <p>If both players move to the exact same square on the same turn, both pieces annihilate each other and are removed from the board.</p>
            </div>
          </div>

          <div className="rule-item">
            <div className="rule-badge">3</div>
            <div className="rule-text">
              <strong>Bypassing (Swap Moves)</strong>
              <p>If two pieces pass each other in transit toward each other's squares, both safely reach their destinations without being destroyed.</p>
            </div>
          </div>

          <div className="rule-item">
            <div className="rule-badge">4</div>
            <div className="rule-text">
              <strong>King Capture Wins</strong>
              <p>There are no traditional turn-based checks or checkmates. You win by directly capturing the opponent's King!</p>
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
