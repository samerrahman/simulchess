import React, { useEffect, useState } from 'react';
import { Trophy, Medal, X, Loader2, Flame, LogIn } from 'lucide-react';
import { getTopLeaderboard } from './eloService';

export default function LeaderboardModal({ isOpen, onClose, currentUserId, currentUser, onOpenAuth }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const fetchLeaders = async () => {
      try {
        const data = await getTopLeaderboard();
        if (!cancelled) {
          setLeaders(data);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading(false);
      }
    };

    fetchLeaders();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container leaderboard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Trophy size={24} className="trophy-gold" />
            <h2 className="modal-title">SimulChess Hall of Fame</h2>
          </div>
          <button className="btn-icon modal-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body leaderboard-body">
          {!currentUser && (
            <div className="leaderboard-auth-banner">
              <span className="leaderboard-auth-banner-text">
                Only registered players appear on the leaderboard.
              </span>
              {onOpenAuth && (
                <button 
                  type="button"
                  className="btn btn-secondary btn-sm leaderboard-auth-btn"
                  onClick={onOpenAuth}
                >
                  <LogIn size={13} />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="leaderboard-loading">
              <Loader2 size={32} className="animate-spin text-accent" />
              <p>Fetching top grandmasters...</p>
            </div>
          ) : leaders.length === 0 ? (
            <div className="leaderboard-empty">
              <Flame size={32} className="text-secondary" />
              <p>No registered players ranked yet!</p>
              <span>Create an account and play a match to claim the #1 spot on the leaderboard.</span>
            </div>
          ) : (
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th className="th-rank">#</th>
                    <th className="th-player">Player</th>
                    <th className="th-elo">Rating</th>
                    <th className="th-record">W / L / D</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((player, idx) => {
                    const isMe = player.userId === currentUserId;
                    return (
                      <tr key={player.userId} className={`leader-row ${isMe ? 'leader-row-me' : ''}`}>
                        <td className="td-rank">
                          {idx === 0 ? (
                            <span className="rank-badge rank-1"><Medal size={16} /> 1</span>
                          ) : idx === 1 ? (
                            <span className="rank-badge rank-2"><Medal size={16} /> 2</span>
                          ) : idx === 2 ? (
                            <span className="rank-badge rank-3"><Medal size={16} /> 3</span>
                          ) : (
                            <span className="rank-number">{idx + 1}</span>
                          )}
                        </td>
                        <td className="td-player">
                          <span className="leader-name">
                            {player.username}
                            {isMe && <span className="you-pill">YOU</span>}
                          </span>
                        </td>
                        <td className="td-elo">
                          <span className="leader-elo">{player.elo}</span>
                        </td>
                        <td className="td-record">
                          <span className="record-text">
                            <span className="stat-w">{player.wins}W</span>
                            {' - '}
                            <span className="stat-l">{player.losses}L</span>
                            {' - '}
                            <span className="stat-d">{player.draws}D</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className="leaderboard-hint">Ranked only for signed-in accounts. Ratings adjust via standard Elo ($K=32$).</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
