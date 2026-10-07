import React from 'react';
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

function getTierBadge(elo) {
  const rating = Number(elo) || 1200;
  if (rating >= 1700) return { name: 'Grandmaster', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: '👑' };
  if (rating >= 1500) return { name: 'Master', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: '💎' };
  if (rating >= 1300) return { name: 'Expert', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: '⚡' };
  if (rating >= 1100) return { name: 'Challenger', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: '⚔️' };
  return { name: 'Novice', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', icon: '🌱' };
}

export default function ProfilePage({ 
  profile, 
  authUser, 
  onOpenAuth, 
  onLogout, 
  onNavigateToPlay 
}) {
  const elo = profile?.elo || 1200;
  const wins = profile?.wins || 0;
  const losses = profile?.losses || 0;
  const draws = profile?.draws || 0;
  const totalGames = (profile?.gamesPlayed) || (wins + losses + draws);
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const isRegistered = Boolean(authUser);
  const username = profile?.username;
  const tier = getTierBadge(elo);

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
                <span>{tier.name} Tier</span>
              </span>

              <span className="profile-elo-display">
                <Trophy size={16} className="text-amber" />
                <strong>{elo}</strong> Elo
              </span>
            </div>

            {!username ? (
              <div className="profile-unnamed-callout">
                <p>You haven't set a player name yet. Pick a username to start saving your match record.</p>
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
            <span className="stat-card-label">Rating</span>
            <div className="stat-card-value elo-highlight">{elo}</div>
            <span className="stat-card-sub">{tier.name}</span>
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

        {/* Account Management & Security Card */}
        <div className="profile-section-card">
          <h3 className="section-title">Account & Registration</h3>

          {!isRegistered ? (
            <div className="guest-protection-box">
              <div className="protection-icon-col">
                <Sparkles size={24} className="text-amber" />
              </div>
              <div className="protection-content">
                <h4>Claim Your Name Permanently</h4>
                <p>
                  You are currently playing as a guest. Registering lets you lock in your username with a password, protect your <strong>{elo} Elo</strong> from being lost, and appear on the Hall of Fame Leaderboard!
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
