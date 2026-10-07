import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { 
  X, LogIn, UserPlus, LogOut, Loader2, AlertCircle, 
  Sparkles, ShieldCheck, KeyRound, ArrowRight 
} from 'lucide-react';
import { 
  checkUsernameStatus, 
  loginWithUsername, 
  registerUsernameWithAuth 
} from './eloService';

export default function AuthModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  userProfile, 
  initialMode = 'choose_name', 
  onChooseUnregisteredName, 
  onAuthSuccess 
}) {
  const [mode, setMode] = useState(initialMode); // 'choose_name' | 'login_password' | 'register' | 'account'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [optionalEmail, setOptionalEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredNotice, setRegisteredNotice] = useState('');

  // Reset or initialize state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setError('');
      setPassword('');
      setConfirmPassword('');
      setRegisteredNotice('');
      if (currentUser) {
        setMode('account');
      } else if (initialMode === 'register') {
        setMode('register');
        setUsername(userProfile?.username || '');
      } else {
        setMode('choose_name');
        setUsername(userProfile?.username || localStorage.getItem('simulchess_chosen_username') || '');
      }
    }
  }, [isOpen, currentUser, initialMode, userProfile]);

  if (!isOpen) return null;

  // Handle "Choose Name" submit
  async function handleChooseNameSubmit(e) {
    e.preventDefault();
    setError('');
    const clean = username.trim();
    if (!clean || clean.length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (clean.length > 18) {
      setError('Username cannot exceed 18 characters.');
      return;
    }

    setLoading(true);
    try {
      const status = await checkUsernameStatus(clean);
      if (status.exists && status.isRegistered) {
        // Name is claimed by a registered user -> Showdown requires password
        setMode('login_password');
        setRegisteredNotice(`The name "${status.displayName || clean}" is registered. Please enter your password to use it.`);
      } else {
        // Name is unregistered -> User can immediately play with it!
        if (onChooseUnregisteredName) {
          onChooseUnregisteredName(clean);
        }
        onClose();
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error checking username status.');
    } finally {
      setLoading(false);
    }
  }

  // Handle Login with Password for registered username
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await loginWithUsername(username.trim(), password);
      if (onAuthSuccess) onAuthSuccess(user);
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Incorrect password for this username.');
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle Registering the current username & saving Elo
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    setError('');

    const clean = username.trim();
    if (!clean || clean.length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { user } = await registerUsernameWithAuth(
        clean, 
        password, 
        userProfile, 
        optionalEmail
      );
      if (onAuthSuccess) onAuthSuccess(user);
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this name or email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else {
        setError(err.message || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle Sign Out / Switch Name
  async function handleLogout() {
    setLoading(true);
    try {
      await signOut(auth);
      if (onAuthSuccess) onAuthSuccess(null);
      setMode('choose_name');
      setPassword('');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container showdown-auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            {mode === 'account' ? (
              <ShieldCheck size={22} className="text-accent" />
            ) : mode === 'register' ? (
              <UserPlus size={22} className="text-accent" />
            ) : mode === 'login_password' ? (
              <KeyRound size={22} className="text-accent" />
            ) : (
              <Sparkles size={22} className="text-accent" />
            )}
            <h2 className="modal-title">
              {mode === 'account' 
                ? 'Player Account' 
                : mode === 'register' 
                ? `Register "${username || userProfile?.username || 'Account'}"` 
                : mode === 'login_password'
                ? 'Password Required'
                : 'Choose a Name'}
            </h2>
          </div>
          <button className="btn-icon modal-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body auth-modal-body">
          {error && (
            <div className="alert-box alert-error auth-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* ================= MODE: CHOOSE NAME ================= */}
          {mode === 'choose_name' && (
            <form onSubmit={handleChooseNameSubmit} className="showdown-form">
              <p className="showdown-intro">
                Choose a name to play SimulChess. You can play right away without a password, or register your name later to keep your rating.
              </p>

              <div className="auth-input-group">
                <label className="auth-label">Choose Name</label>
                <input 
                  type="text" 
                  required 
                  autoFocus
                  className="input-field" 
                  placeholder="e.g. Red, Cynthia, Ash" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={18}
                  disabled={loading}
                />
              </div>

              <div className="showdown-btn-row">
                <button 
                  type="submit" 
                  className="btn btn-primary btn-full showdown-submit-btn" 
                  disabled={loading || !username.trim()}
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <span>Play as {username.trim() || 'Guest'}</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>

              <div className="showdown-notice-box">
                <p>
                  <strong>Tip:</strong> If the name is registered, you will be prompted for your password. If unregistered, you can play immediately!
                </p>
              </div>
            </form>
          )}

          {/* ================= MODE: LOGIN PASSWORD ================= */}
          {mode === 'login_password' && (
            <form onSubmit={handleLoginSubmit} className="showdown-form">
              <div className="alert-box alert-info login-notice">
                <ShieldCheck size={16} />
                <span>{registeredNotice || `"${username}" is a registered name. Please enter your password.`}</span>
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Username</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={username} 
                  disabled 
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Password</label>
                <input 
                  type="password" 
                  required 
                  autoFocus
                  className="input-field" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="showdown-btn-row">
                <button 
                  type="submit" 
                  className="btn btn-primary btn-full showdown-submit-btn" 
                  disabled={loading || !password}
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <LogIn size={18} />
                      <span>Log In</span>
                    </>
                  )}
                </button>
              </div>

              <div className="auth-toggle-row">
                <button 
                  type="button" 
                  className="auth-link-btn" 
                  onClick={() => { setMode('choose_name'); setPassword(''); setError(''); }}
                >
                  ← Choose a different name
                </button>
              </div>
            </form>
          )}

          {/* ================= MODE: REGISTER NAME ================= */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="showdown-form">
              <div className="register-elo-callout">
                <Sparkles size={18} className="text-amber" />
                <div className="register-elo-callout-text">
                  <strong>Permanent Elo Protection:</strong>
                  <span>
                    Your current rating of <strong>{userProfile?.elo || 1200} Elo</strong> ({userProfile?.wins || 0}W - {userProfile?.losses || 0}L) will be permanently saved to this account!
                  </span>
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Username to Claim</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={18}
                  disabled={loading}
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Password (min 6 chars)</label>
                <input 
                  type="password" 
                  required 
                  className="input-field" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Confirm Password</label>
                <input 
                  type="password" 
                  required 
                  className="input-field" 
                  placeholder="••••••••" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Recovery Email <span className="text-muted">(Optional)</span></label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="you@example.com" 
                  value={optionalEmail}
                  onChange={(e) => setOptionalEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="showdown-btn-row">
                <button 
                  type="submit" 
                  className="btn btn-primary btn-full showdown-submit-btn" 
                  disabled={loading || !password || !confirmPassword}
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={18} />
                      <span>Register & Save Elo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ================= MODE: ACCOUNT DETAILS ================= */}
          {mode === 'account' && (
            <div className="account-details-view">
              <div className="account-user-card">
                <div className="account-user-header">
                  <ShieldCheck size={28} className="text-accent" />
                  <div>
                    <h3 className="account-username">
                      {userProfile?.username || currentUser?.displayName || 'Registered Player'}
                    </h3>
                    <span className="registered-pill">✓ Registered Account</span>
                  </div>
                </div>

                <div className="account-stats-grid">
                  <div className="account-stat-box">
                    <span className="account-stat-label">Rating</span>
                    <span className="account-stat-val text-amber">{userProfile?.elo || 1200}</span>
                  </div>
                  <div className="account-stat-box">
                    <span className="account-stat-label">Record</span>
                    <span className="account-stat-val">{userProfile?.wins || 0}W - {userProfile?.losses || 0}L</span>
                  </div>
                  <div className="account-stat-box">
                    <span className="account-stat-label">Games</span>
                    <span className="account-stat-val">{userProfile?.gamesPlayed || 0}</span>
                  </div>
                </div>

                <p className="account-hint">
                  Your progress is permanently secured and ranked on the Hall of Fame.
                </p>
              </div>

              <div className="account-actions-row">
                <button 
                  className="btn btn-secondary btn-full logout-btn" 
                  onClick={handleLogout}
                  disabled={loading}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  <span>Switch Name / Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
