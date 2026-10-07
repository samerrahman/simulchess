import React, { useEffect, useState, useCallback } from 'react';
import { 
  Swords, 
  Loader2, 
  Play, 
  Users, 
  ArrowRight, 
  HelpCircle, 
  Trophy, 
  Edit2, 
  Check, 
  Sparkles, 
  X,
  User
} from 'lucide-react';
import GameArena from './GameArena';
import HowToPlayModal from './HowToPlayModal';
import LeaderboardModal from './LeaderboardModal';
import AuthModal from './AuthModal';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  ref, 
  get, 
  set, 
  update, 
  onValue, 
  remove, 
  push, 
  onDisconnect 
} from 'firebase/database';
import { createInitialGameState } from './gameLogic';
import { getOrCreateProfile, updateUsername } from './eloService';

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [color, setColor] = useState(null); // 'w' | 'b' | 'spectator'
  const [gameState, setGameState] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authUser, setAuthUser] = useState(null);

  // Player profile state
  const [profile, setProfile] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameVal, setEditNameVal] = useState('');
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [queueKey, setQueueKey] = useState(null);
  
  // Persistent anonymous player ID across page reloads in this browser tab
  const [anonUserId] = useState(() => {
    let saved = sessionStorage.getItem('simulchess_user_id');
    if (!saved) {
      saved = 'user_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('simulchess_user_id', saved);
    }
    return saved;
  });

  // Effective userId: auth UID if signed in, otherwise anonUserId
  const userId = authUser ? authUser.uid : anonUserId;

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Load and refresh player profile
  const refreshProfile = useCallback(async () => {
    const isAuth = Boolean(authUser);
    const prof = await getOrCreateProfile(userId, isAuth, authUser?.email);
    setProfile(prof);
    setEditNameVal(prof.username);
  }, [userId, authUser]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Save new username
  async function handleSaveUsername(e) {
    if (e) e.preventDefault();
    if (!editNameVal.trim()) return;
    await updateUsername(userId, editNameVal.trim());
    setIsEditingName(false);
    refreshProfile();
  }

  // Join a room by ID and assign color
  const joinRoomById = useCallback(async (targetRoomId, shouldPushHistory = true) => {
    const cleanId = targetRoomId.trim().toUpperCase();
    if (!cleanId) return;

    setLoadingMsg(`Connecting to room ${cleanId}...`);
    setErrorMsg('');

    try {
      const roomRef = ref(db, `games/${cleanId}`);
      const snap = await get(roomRef);

      if (!snap.exists()) {
        setErrorMsg(`Room "${cleanId}" not found. Check the code and try again.`);
        setLoadingMsg('');
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      const data = snap.val();
      const players = data.players || {};

      let assignedColor = 'spectator';

      // Check if user is already registered in this room
      if (players.w === userId) {
        assignedColor = 'w';
      } else if (players.b === userId) {
        assignedColor = 'b';
      } else if (!players.w) {
        assignedColor = 'w';
      } else if (!players.b) {
        assignedColor = 'b';
      }

      const updates = {};
      if (assignedColor !== 'spectator') {
        updates[`players/${assignedColor}`] = userId;
        // Also attach player metadata (name, elo) for live in-game display
        const myName = profile?.username || `Player_${userId.slice(-4).toUpperCase()}`;
        const myElo = profile?.elo || 1200;
        updates[`playerMeta/${assignedColor}`] = {
          userId,
          username: myName,
          elo: myElo
        };

        const nextPlayers = { ...players, [assignedColor]: userId };
        if (nextPlayers.w && nextPlayers.b && data.status === 'waiting') {
          updates['status'] = 'playing';
        }
        await update(roomRef, updates);
      }

      setColor(assignedColor);
      setRoomId(cleanId);
      if (shouldPushHistory) {
        window.history.pushState({ inGame: true, roomId: cleanId }, '', `?room=${cleanId}`);
      }
    } catch (err) {
      console.error('Failed to join room:', err);
      setErrorMsg('Failed to join room: ' + err.message);
    } finally {
      setLoadingMsg('');
    }
  }, [userId, profile]);

  // Handle browser Back / Forward buttons natively
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (!roomParam) {
        // Navigated back to home/lobby
        setRoomId('');
        setColor(null);
        setGameState(null);
        setInputRoomId('');
        setErrorMsg('');
        setIsSearchingMatch(false);
      } else if (roomParam !== roomId) {
        joinRoomById(roomParam, false);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [roomId, joinRoomById]);

  // Check URL query parameters on initial page mount (e.g. ?room=ABCDEF)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      joinRoomById(roomParam, false);
    }
  }, [joinRoomById]);

  // Claim empty seat
  const claimSeat = useCallback(async (seatColor) => {
    if (!roomId) return;
    try {
      const myName = profile?.username || `Player_${userId.slice(-4).toUpperCase()}`;
      const myElo = profile?.elo || 1200;

      await update(ref(db, `games/${roomId}`), {
        [`players/${seatColor}`]: userId,
        [`playerMeta/${seatColor}`]: { userId, username: myName, elo: myElo }
      });
      setColor(seatColor);

      // Check if both players joined to start game
      const snap = await get(ref(db, `games/${roomId}`));
      if (snap.exists()) {
        const d = snap.val();
        if (d.players?.w && d.players?.b && d.status === 'waiting') {
          await update(ref(db, `games/${roomId}`), { status: 'playing' });
        }
      }
    } catch (e) {
      console.error('Error claiming seat:', e);
    }
  }, [roomId, userId, profile]);

  // Listen to game updates once roomId is set
  useEffect(() => {
    if (!roomId) return;
    const gameRef = ref(db, `games/${roomId}`);

    // Set up disconnect cleanup for player seat
    if (color && (color === 'w' || color === 'b')) {
      const playerRef = ref(db, `games/${roomId}/players/${color}`);
      onDisconnect(playerRef).remove();
    }

    const unsub = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);

        // If spectator and a seat opens up, take it
        if (color === 'spectator' && data.players) {
          if (!data.players.w && data.players.b !== userId) {
            claimSeat('w');
          } else if (!data.players.b && data.players.w !== userId) {
            claimSeat('b');
          }
        }
      } else {
        // Room was deleted
        setGameState(null);
        setRoomId('');
        setColor(null);
        window.history.pushState({}, '', window.location.pathname);
      }
    });

    return () => unsub();
  }, [roomId, color, userId, claimSeat]);

  // Create Private Room
  async function handleCreatePrivate() {
    setLoadingMsg("Creating room...");
    setErrorMsg('');
    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const initialGame = createInitialGameState();
      const myName = profile?.username || `Player_${userId.slice(-4).toUpperCase()}`;
      const myElo = profile?.elo || 1200;

      initialGame.players = { w: userId, b: null };
      initialGame.playerMeta = {
        w: { userId, username: myName, elo: myElo },
        b: null
      };
      initialGame.status = 'waiting';

      await set(ref(db, `games/${newRoomId}`), initialGame);
      setColor('w');
      setRoomId(newRoomId);
      window.history.pushState({ inGame: true, roomId: newRoomId }, '', `?room=${newRoomId}`);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to create room: " + err.message);
    } finally {
      setLoadingMsg('');
    }
  }

  // Find Public Match
  async function handleFindPublic() {
    setIsSearchingMatch(true);
    setLoadingMsg("Finding match...");
    setErrorMsg('');

    try {
      let targetGameId = null;
      let assignedColor = 'spectator';
      const myName = profile?.username || `Player_${userId.slice(-4).toUpperCase()}`;
      const myElo = profile?.elo || 1200;

      const queueRef = ref(db, 'queue');
      const snap = await get(queueRef);
      const queueObj = snap.val();

      if (queueObj) {
        for (const [qKey, queuedId] of Object.entries(queueObj)) {
          // Remove from queue first
          await remove(ref(db, `queue/${qKey}`));

          const gameSnap = await get(ref(db, `games/${queuedId}`));
          if (gameSnap.exists()) {
            const data = gameSnap.val();
            // Discard dead games
            if (!data.players || (!data.players.w && !data.players.b)) {
              continue;
            }

            // Assign open seat
            targetGameId = queuedId;
            const updates = {};
            if (!data.players.w && data.players.b !== userId) {
              assignedColor = 'w';
              updates['players/w'] = userId;
              updates['playerMeta/w'] = { userId, username: myName, elo: myElo };
            } else if (!data.players.b && data.players.w !== userId) {
              assignedColor = 'b';
              updates['players/b'] = userId;
              updates['playerMeta/b'] = { userId, username: myName, elo: myElo };
            } else if (data.players.w === userId) {
              assignedColor = 'w';
            } else if (data.players.b === userId) {
              assignedColor = 'b';
            }

            if (assignedColor !== 'spectator') {
              const fullPlayers = { ...data.players, [assignedColor]: userId };
              if (fullPlayers.w && fullPlayers.b && data.status === 'waiting') {
                updates['status'] = 'playing';
              }
              await update(ref(db, `games/${queuedId}`), updates);
            }
            break;
          }
        }
      }

      if (targetGameId) {
        setColor(assignedColor);
        setRoomId(targetGameId);
        setIsSearchingMatch(false);
        window.history.pushState({ inGame: true, roomId: targetGameId }, '', `?room=${targetGameId}`);
      } else {
        // No match found in queue: Create a new room and add to queue
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const initialGame = createInitialGameState();
        initialGame.players = { w: userId, b: null };
        initialGame.playerMeta = {
          w: { userId, username: myName, elo: myElo },
          b: null
        };
        initialGame.status = 'waiting';

        await set(ref(db, `games/${newRoomId}`), initialGame);
        const newQueueRef = await push(ref(db, 'queue'), newRoomId);
        setQueueKey(newQueueRef.key);

        setColor('w');
        setRoomId(newRoomId);
        setIsSearchingMatch(false);
        window.history.pushState({ inGame: true, roomId: newRoomId }, '', `?room=${newRoomId}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Matchmaking error: " + err.message);
      setIsSearchingMatch(false);
    } finally {
      setLoadingMsg('');
    }
  }

  // Cancel Matchmaking
  async function handleCancelMatchmaking() {
    setIsSearchingMatch(false);
    setLoadingMsg('');
    if (queueKey) {
      try {
        await remove(ref(db, `queue/${queueKey}`));
      } catch (e) {
        console.error(e);
      }
      setQueueKey(null);
    }
  }

  // Join Room from input form
  function handleJoinSubmit(e) {
    e.preventDefault();
    if (!inputRoomId.trim()) return;
    joinRoomById(inputRoomId, true);
  }

  // Leave room and return to lobby
  function handleLeaveRoom() {
    setRoomId('');
    setColor(null);
    setGameState(null);
    setInputRoomId('');
    setErrorMsg('');
    setIsSearchingMatch(false);
    refreshProfile();
    window.history.pushState({}, '', window.location.pathname);
  }

  // LOBBY VIEW
  if (!roomId) {
    return (
      <div className="lobby-wrapper">
        <div className="lobby-card">
          {/* Top Bar inside Lobby: Profile & Leaderboard trigger */}
          <div className="lobby-top-bar">
            {profile && (
              <div className="user-profile-badge">
                <div className="user-profile-main">
                  {isEditingName ? (
                    <form onSubmit={handleSaveUsername} className="edit-name-form">
                      <input 
                        type="text" 
                        value={editNameVal} 
                        onChange={(e) => setEditNameVal(e.target.value)}
                        maxLength={18}
                        className="input-field input-xs"
                        autoFocus
                      />
                      <button type="submit" className="btn-icon btn-save-name" title="Save">
                        <Check size={14} />
                      </button>
                      <button type="button" className="btn-icon" onClick={() => setIsEditingName(false)} title="Cancel">
                        <X size={14} />
                      </button>
                    </form>
                  ) : (
                    <div className="profile-name-tag" onClick={() => setIsEditingName(true)} title="Click to rename">
                      <span className="profile-username">{profile.username}</span>
                      <Edit2 size={12} className="edit-icon-subtle" />
                    </div>
                  )}
                  <div className="profile-stats-row">
                    <span className="profile-elo-pill">
                      <Sparkles size={11} className="text-amber" />
                      {profile.elo} Elo
                    </span>
                    <span className="profile-record-pill">
                      {profile.wins}W - {profile.losses}L - {profile.draws}D
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="lobby-top-actions">
              <button 
                className="btn btn-secondary btn-sm leaderboard-btn" 
                onClick={() => setShowLeaderboard(true)}
                title="View Hall of Fame Leaderboard"
              >
                <Trophy size={16} className="trophy-gold" />
                <span>Leaderboard</span>
              </button>

              <button 
                className="btn btn-secondary btn-sm auth-btn" 
                onClick={() => setShowAuthModal(true)}
                title={authUser ? `Signed in as ${authUser.email}` : "Sign In or Register"}
              >
                <User size={16} />
                <span>{authUser ? "Account" : "Sign In"}</span>
              </button>
            </div>
          </div>

          <div className="lobby-header">
            <div className="lobby-logo-badge">
              <Swords size={36} className="lobby-icon" />
            </div>
            <h1 className="lobby-title">SimulChess</h1>
            <p className="lobby-subtitle">
              Real-time simultaneous multiplayer chess.
            </p>
          </div>

          {loadingMsg && (
            <div className="alert-box alert-info">
              <Loader2 className="animate-spin" size={18} />
              <span>{loadingMsg}</span>
              {isSearchingMatch && (
                <button className="btn btn-secondary btn-xs btn-cancel-queue" onClick={handleCancelMatchmaking}>
                  Cancel
                </button>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="alert-box alert-error">
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="lobby-buttons">
            <button 
              className="btn btn-primary btn-lobby" 
              onClick={handleFindPublic} 
              disabled={!!loadingMsg}
            >
              <Play size={20} />
              <div className="btn-text-block">
                <span className="btn-main-text">Find Match</span>
                <span className="btn-sub-text">Join rated matchmaking queue</span>
              </div>
            </button>

            <button 
              className="btn btn-secondary btn-lobby" 
              onClick={handleCreatePrivate} 
              disabled={!!loadingMsg}
            >
              <Users size={20} />
              <div className="btn-text-block">
                <span className="btn-main-text">Create Room</span>
                <span className="btn-sub-text">Generate a private invite link</span>
              </div>
            </button>

            <div className="divider">or join with code</div>

            <form onSubmit={handleJoinSubmit} className="join-form">
              <input
                type="text"
                className="input-field join-input"
                placeholder="Enter Room Code"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                maxLength={8}
                disabled={!!loadingMsg}
              />
              <button 
                type="submit" 
                className="btn btn-primary join-btn" 
                disabled={!!loadingMsg || !inputRoomId.trim()}
              >
                Join <ArrowRight size={16} />
              </button>
            </form>
          </div>

          <div className="lobby-footer-actions">
            <button 
              className="btn btn-secondary btn-how-to-play" 
              onClick={() => setShowHowToPlay(true)}
            >
              <HelpCircle size={17} /> How to Play
            </button>
          </div>
        </div>

        <HowToPlayModal 
          isOpen={showHowToPlay} 
          onClose={() => setShowHowToPlay(false)} 
        />

        <LeaderboardModal 
          isOpen={showLeaderboard}
          onClose={() => setShowLeaderboard(false)}
          currentUserId={userId}
          currentUser={authUser}
          onOpenAuth={() => {
            setShowLeaderboard(false);
            setShowAuthModal(true);
          }}
        />

        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          currentUser={authUser}
          onAuthSuccess={() => {
            refreshProfile();
          }}
        />
      </div>
    );
  }

  // LOADING GAME VIEW
  if (!gameState) {
    return (
      <div className="lobby-wrapper">
        <div className="loading-card">
          <Loader2 size={36} className="animate-spin text-accent" />
          <h2>Entering Room {roomId}...</h2>
          <p>Connecting to Firebase Realtime Database</p>
        </div>
      </div>
    );
  }

  // ACTIVE GAME ARENA VIEW
  return (
    <GameArena
      gameState={gameState}
      color={color}
      roomId={roomId}
      userId={userId}
      userProfile={profile}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}
