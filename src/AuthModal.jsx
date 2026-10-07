import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { auth } from './firebase';
import { X, LogIn, UserPlus, LogOut, Loader2, AlertCircle } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, currentUser, onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        onAuthSuccess(cred.user);
        onClose();
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        onAuthSuccess(cred.user);
        onClose();
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-email') setError('Invalid email address format.');
      else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await signOut(auth);
      onAuthSuccess(null);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            {currentUser ? <LogOut size={22} className="text-accent" /> : <LogIn size={22} className="text-accent" />}
            <h2 className="modal-title">
              {currentUser ? 'Player Account' : isRegister ? 'Create Account' : 'Sign In'}
            </h2>
          </div>
          <button className="btn-icon modal-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body auth-modal-body">
          {currentUser ? (
            <div className="account-details-view">
              <p className="account-welcome">Signed in as:</p>
              <div className="account-email-pill">{currentUser.email}</div>
              <p className="account-hint">
                Your rating and stats are synced to this account across any device.
              </p>
              <button 
                className="btn btn-secondary btn-full logout-btn" 
                onClick={handleLogout}
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              {error && (
                <div className="alert-box alert-error auth-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="auth-input-group">
                <label className="auth-label">Email</label>
                <input 
                  type="email" 
                  required 
                  className="input-field" 
                  placeholder="player@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="auth-input-group">
                <label className="auth-label">Password</label>
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

              <button 
                type="submit" 
                className="btn btn-primary btn-full auth-submit-btn" 
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isRegister ? (
                  <>
                    <UserPlus size={18} />
                    <span>Create Account</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>Sign In</span>
                  </>
                )}
              </button>

              <div className="auth-toggle-row">
                {isRegister ? (
                  <p>
                    Already have an account?{' '}
                    <button 
                      type="button" 
                      className="auth-link-btn" 
                      onClick={() => { setIsRegister(false); setError(''); }}
                    >
                      Sign In
                    </button>
                  </p>
                ) : (
                  <p>
                    Don't have an account?{' '}
                    <button 
                      type="button" 
                      className="auth-link-btn" 
                      onClick={() => { setIsRegister(true); setError(''); }}
                    >
                      Create one
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
