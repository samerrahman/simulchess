import React, { useState, useEffect } from 'react';
import { 
  User, 
  Trophy, 
  Swords, 
  ShieldCheck, 
  Sparkles, 
  LogOut, 
  Edit3, 
  ArrowLeft 
} from 'lucide-react';
import RatingHistoryChart from './RatingHistoryChart';
import { getRatingHistory } from './eloService';
import { GLICKO_DEFAULTS } from './glicko2';

function getTierBadge(elo) {
  const rating = Number(elo) || GLICKO_DEFAULTS.RATING;
  if (rating >= 1950) return { name: 'Grandmaster', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: '👑' };
  if (rating >= 1750) return { name: 'Master', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: '💎' };
  if (rating >= 1550) return { name: 'Expert', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: '⚡' };
  if (rating >= 1350) return { name: 'Challenger', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: '⚔️' };
  return { name: 'Novice', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', icon: '🌱' };
}

export default function ProfilePage({ 
  profile, 
  authUser, 
  onOpenAuth, 
  onLogout, 
  onNavigateToPlay 
}) {
  const elo = profile?.elo || GLICKO_DEFAULTS.RATING;
  const rd = profile?.rd || GLICKO_DEFAULTS.RD;
  const isProvisional = rd > GLICKO_DEFAULTS.PROVISIONAL_RD_THRESHOLD;
  const wins = profile?.wins || 0;
  const losses = profile?.losses || 0;
  const draws = profile?.draws || 0;
  const totalGames = (profile?.gamesPlayed) || (wins + losses + draws);
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const isRegistered = Boolean(authUser);
  const username = profile?.username;
  const tier = getTierBadge(elo);

  const [history, setHistory] = useState([]);

  useEffect(() => {
    const uid = profile?.userId || authUser?.uid;
    if (!uid) return;
    let active = true;
    getRatingHistory(uid, profile).then((h) => {
      if (active) setHistory(h || []);
    }).catch(() => {});
    return () => { active = false; };
  }, [profile?.userId, authUser?.uid, profile]);

  return (
    <div className="page-container profile-page">
      <div className="page-header-nav">
        <button className="btn btn-secondary btn-sm" onClick={onNavigateToPlay}>
          <ArrowLeft size={16} />
          <span>Back to Play</span>
        </button>
      </div>

      <div className="profile-layout-grid">
        {/* Main User Card */}
        <div className="profile-hero-card">
          <div className="profile-avatar-large">
            <User size={48} />
          </div>

          <div className="profile-hero-details">
            <div className="profile-hero-name-row">
              <h1 className="profile-hero-name">
                {username || 'Unnamed Player'}
              </h1>
              {isRegistered ? (
                <span className="badge-registered-pill" title="Verified Registered Account">
                  <ShieldCheck size={14} />
                  <span>Verified</span>
                </span>
              ) : (
                <span className="badge-guest-pill" title="Unregistered Guest Player">
                  Guest
                </span>
              )}
            </div>

            <div className="profile-tier-row">
              <span 
                className="profile-tier-badge" 
                style={{ color: tier.color, backgroundColor: tier.bg, borderColor: tier.color }}
              >
                <span>{tier.icon}</span>
                <span>{tier.name}</span>
              </span>

              <span className="profile-elo-display">
                <Trophy size={16} className="text-amber" />
                <strong>{elo}</strong>
                <span className="profile-rd-text">±{Math.round(rd)} RD</span>
                {isProvisional && (
                  <span className="provisional-pill">Provisional</span>
                )}
              </span>
            </div>

            {!username ? (
              <div className="profile-unnamed-callout">
                <p>Choose a username to track your rating and rank on the leaderboard.</p>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => onOpenAuth('choose_name')}
                >
                  <Sparkles size={15} />
                  <span>Choose Username</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-stats-grid">
          <div className="stat-card">
            <span className="stat-card-label">Glicko-2 Rating</span>
            <div className="stat-card-value elo-highlight">
              {elo}
              <span className="stat-card-sub-rd"> ±{Math.round(rd)}</span>
            </div>
            <span className="stat-card-sub">
              {isProvisional ? 'Provisional' : tier.name}
            </span>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">Total Games</span>
            <div className="stat-card-value">{totalGames}</div>
            <span className="stat-card-sub">{wins}W • {losses}L • {draws}D</span>
          </div>

          <div className="stat-card">
            <span className="stat-card-label">Win Rate</span>
            <div className="stat-card-value text-accent">{winRate}%</div>
            <div className="winrate-bar-container">
              <div 
                className="winrate-bar-fill" 
                style={{ width: `${winRate}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Rating Progression Chart */}
        <RatingHistoryChart 
          history={history} 
          currentRating={elo} 
          currentRd={rd} 
        />

        {/* Account Management & Security Card */}
        <div className="profile-section-card">
          <h3 className="section-title">Account & Registration</h3>

          {!isRegistered ? (
            <div className="guest-protection-box">
              <div className="protection-icon-col">
                <Sparkles size={24} className="text-amber" />
              </div>
              <div className="protection-content">
                <h4>Save Your Account</h4>
                <p>
                  Set a password to keep your rating ({elo} Elo) and log in across devices.
                </p>
                <div className="protection-actions">
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenAuth('register')}
                  >
                    <ShieldCheck size={16} />
                    <span>Register Account</span>
                  </button>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => onOpenAuth('choose_name')}
                  >
                    <Edit3 size={15} />
                    <span>Change Name</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="registered-account-info">
              <div className="account-detail-row">
                <span className="detail-label">Username:</span>
                <span className="detail-value font-bold">{username}</span>
              </div>
              <div className="account-detail-row">
                <span className="detail-label">Status:</span>
                <span className="detail-value text-emerald font-semibold">✓ Permanent Registered Account</span>
              </div>
              <div className="account-detail-row">
                <span className="detail-label">Auth UID:</span>
                <span className="detail-value text-muted font-mono">{authUser.uid.slice(0, 12)}...</span>
              </div>

              <div className="account-actions-row">
                <button 
                  className="btn btn-secondary btn-sm btn-logout"
                  onClick={onLogout}
                >
                  <LogOut size={15} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Play CTA */}
        <div className="profile-play-cta">
          <div className="cta-text">
            <h3>Ready for your next game?</h3>
            <p>Jump right into matchmaking or challenge a friend in simultaneous chess.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onNavigateToPlay}>
            <Swords size={20} />
            <span>Play Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
