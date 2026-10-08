import React, { useEffect, useState } from 'react';
import { 
  Trophy, 
  Medal, 
  Loader2, 
  Flame, 
  ArrowLeft, 
  ShieldCheck, 
  User, 
  Sparkles,
  Swords
} from 'lucide-react';
import { getTopLeaderboard } from './eloService';

export default function LeaderboardPage({ 
  currentUserId, 
  currentUser, 
  onOpenAuth, 
  onNavigateToPlay 
}) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const top3 = leaders.slice(0, 3);

  return (
    <div className="page-container leaderboard-page">
      <div className="page-header-nav">
        <button className="btn btn-secondary btn-sm" onClick={onNavigateToPlay}>
          <ArrowLeft size={16} />
          <span>Back to Play</span>
        </button>
      </div>

      <div className="leaderboard-page-header">
        <div className="leaderboard-title-group">
          <div className="leaderboard-trophy-badge">
            <Trophy size={28} className="trophy-gold" />
          </div>
          <div>
            <h1 className="page-title">Leaderboard</h1>
            <p className="page-subtitle">Top rated players.</p>
          </div>
        </div>

        {!currentUser && (
          <div className="leaderboard-guest-banner">
            <Sparkles size={16} className="text-amber" />
            <span>Only registered players qualify for the Leaderboard rankings.</span>
            <button 
              className="btn btn-primary btn-xs"
              onClick={onOpenAuth}
            >
              Register to Compete
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="page-loading-state">
          <Loader2 size={36} className="animate-spin text-accent" />
          <p>Loading grandmasters...</p>
        </div>
      ) : leaders.length === 0 ? (
        <div className="page-empty-state">
          <Trophy size={48} className="text-muted" />
          <h3>No Ranked Players Yet</h3>
          <p>Be the first registered player to win a rated match and claim the #1 spot!</p>
          <button className="btn btn-primary" onClick={onNavigateToPlay}>
            <Swords size={16} />
            <span>Play First Match</span>
          </button>
        </div>
      ) : (
        <div className="leaderboard-page-content">
          {/* TOP 3 PODIUM */}
          {top3.length > 0 && (
            <div className="leaderboard-podium-grid">
              {/* 2nd Place */}
              {top3[1] && (
                <div className="podium-card podium-silver">
                  <div className="podium-rank-badge">#2</div>
                  <div className="podium-avatar">
                    <Medal size={28} className="medal-silver" />
                  </div>
                  <h3 className="podium-name">{top3[1].username}</h3>
                  <div className="podium-elo">{top3[1].elo} <span>Elo</span></div>
                  <div className="podium-record">
                    {top3[1].wins}W • {top3[1].losses}L • {top3[1].draws}D
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {top3[0] && (
                <div className="podium-card podium-gold">
                  <div className="podium-crown">👑</div>
                  <div className="podium-rank-badge">#1</div>
                  <div className="podium-avatar">
                    <Trophy size={36} className="trophy-gold" />
                  </div>
                  <h3 className="podium-name">{top3[0].username}</h3>
                  <div className="podium-elo">{top3[0].elo} <span>Elo</span></div>
                  <div className="podium-record">
                    {top3[0].wins}W • {top3[0].losses}L • {top3[0].draws}D
                  </div>
                  <span className="champion-badge">Current Champion</span>
                </div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <div className="podium-card podium-bronze">
                  <div className="podium-rank-badge">#3</div>
                  <div className="podium-avatar">
                    <Medal size={28} className="medal-bronze" />
                  </div>
                  <h3 className="podium-name">{top3[2].username}</h3>
                  <div className="podium-elo">{top3[2].elo} <span>Elo</span></div>
                  <div className="podium-record">
                    {top3[2].wins}W • {top3[2].losses}L • {top3[2].draws}D
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FULL RANKINGS TABLE */}
          <div className="leaderboard-table-card">
            <table className="leaderboard-full-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Player</th>
                  <th>Rating</th>
                  <th>Record (W-L-D)</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((player, idx) => {
                  const isCurrent = currentUserId === player.userId;
                  const total = player.wins + player.losses + player.draws;
                  const winRate = total > 0 ? Math.round((player.wins / total) * 100) : 0;
                  return (
                    <tr key={player.userId} className={isCurrent ? 'row-current-player' : ''}>
                      <td className="rank-col">
                        <span className={`rank-number-pill rank-${idx + 1}`}>
                          {idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : idx + 1 === 3 ? '🥉' : `#${idx + 1}`}
                        </span>
                      </td>
                      <td className="player-col">
                        <div className="player-col-flex">
                          <span className="player-table-name">{player.username}</span>
                          <span className="badge-registered-tag" title="Verified Account">✓</span>
                          {isCurrent && <span className="you-pill-tag">You</span>}
                        </div>
                      </td>
                      <td className="elo-col font-mono font-bold text-amber">
                        {player.elo}
                      </td>
                      <td className="record-col text-secondary">
                        {player.wins}W - {player.losses}L - {player.draws}D
                      </td>
                      <td className="winrate-col font-bold">
                        {winRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
