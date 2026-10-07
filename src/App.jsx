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
  Sparkles, 
  User,
  ShieldCheck,
  UserPlus,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import GameArena from './GameArena';
import HowToPlayModal from './HowToPlayModal';
import LeaderboardModal from './LeaderboardModal';
import AuthModal from './AuthModal';
import FriendsModal from './FriendsModal';
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
import { 
  setupUserPresence, 
  setUserGameStatus, 
  subscribeToIncomingChallenges, 
  respondToChallenge, 
  sendChallenge 
} from './friendService';

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [color, setColor] = useState(null); // 'w' | 'b' | 'spectator'
  const [gameState, setGameState] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('choose_name');
  const [pendingAction, setPendingAction] = useState(null);
  const [authUser, setAuthUser] = useState(null);

  // Player profile state
  const [profile, setProfile] = useState(null);
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
  }, [userId, authUser]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Setup real-time online presence
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupUserPresence(userId);
    return () => cleanup();
  }, [userId]);

  // Update in-game vs in-lobby state
  useEffect(() => {
    if (!userId) return;
    setUserGameStatus(userId, roomId ? 'in_game' : 'in_lobby');
  }, [userId, roomId]);

  // Listen to incoming match challenges from friends
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToIncomingChallenges(userId, (challenge) => {
      setIncomingChallenge(challenge);
    });
    return () => unsub();
  }, [userId]);

  // Accept incoming friend challenge
  const handleAcceptChallenge = useCallback(async () => {
    if (!incomingChallenge) return;
    const targetRoom = incomingChallenge.roomId;
    const challengeId = incomingChallenge.challengeId;
    setIncomingChallenge(null);
    try {
      await respondToChallenge(userId, challengeId, true);
      joinRoomById(targetRoom, true);
    } catch (e) {
      console.error(e);
    }
  }, [incomingChallenge, userId, joinRoomById]);

  // Decline incoming friend challenge
  const handleDeclineChallenge = useCallback(async () => {
    if (!incomingChallenge) return;
    const challengeId = incomingChallenge.challengeId;
    setIncomingChallenge(null);
    try {
      await respondToChallenge(userId, challengeId, false);
    } catch (e) {
      console.error(e);
    }
  }, [incomingChallenge, userId]);

  // Challenge a friend directly to a match
  const handleChallengeFriend = useCallback(async (friend) => {
    if (!friend || !friend.friendId) return;
    setLoadingMsg(`Challenging ${friend.username}...`);
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

      await sendChallenge(userId, myName, myElo, friend.friendId, newRoomId);
    } catch (e) {
      console.error("Error challenging friend:", e);
      setErrorMsg("Failed to send challenge: " + e.message);
    } finally {
      setLoadingMsg('');
    }
  }, [userId, profile]);

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

  // Check if player has an authenticated account or chosen username
  const hasChosenName = Boolean(
    authUser || 
    (localStorage.getItem('simulchess_chosen_username') && profile?.username && !profile.username.startsWith('Player_'))
  );

  // Check URL query parameters on initial page mount (e.g. ?room=ABCDEF)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      if (!hasChosenName) {
        setPendingAction({ type: 'join_room', roomId: roomParam });
        setAuthModalMode('choose_name');
        setShowAuthModal(true);
      } else {
        joinRoomById(roomParam, false);
      }
    }
  }, [joinRoomById, hasChosenName]);

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

  // Execute Private Room Creation
  const executeCreatePrivate = useCallback(async (customProf = null) => {
    setLoadingMsg("Creating room...");
    setErrorMsg('');
    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const initialGame = createInitialGameState();
      const activeProf = customProf || profile;
      const myName = activeProf?.username || `Player_${userId.slice(-4).toUpperCase()}`;
      const myElo = activeProf?.elo || 1200;

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
  }, [userId, profile]);

  // Execute Public Matchmaking
  const executeFindPublic = useCallback(async (customProf = null) => {
    setIsSearchingMatch(true);
    setLoadingMsg("Finding match...");
    setErrorMsg('');

    try {
      let targetGameId = null;
      let assignedColor = 'spectator';
      const activeProf = customProf || profile;
      const myName = activeProf?.username || `Player_${userId.slice(-4).toUpperCase()}`;
      const myElo = activeProf?.elo || 1200;

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
  }, [userId, profile]);

  // Create Private Room (guards for chosen username)
  function handleCreatePrivate() {
    if (!hasChosenName) {
      setPendingAction('create_room');
      setAuthModalMode('choose_name');
      setShowAuthModal(true);
      return;
    }
    executeCreatePrivate();
  }

  // Find Public Match (guards for chosen username)
  function handleFindPublic() {
    if (!hasChosenName) {
      setPendingAction('find_match');
      setAuthModalMode('choose_name');
      setShowAuthModal(true);
      return;
    }
    executeFindPublic();
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

  // Join Room from input form (guards for chosen username)
  function handleJoinSubmit(e) {
    e.preventDefault();
    if (!inputRoomId.trim()) return;
    if (!hasChosenName) {
      setPendingAction({ type: 'join_room', roomId: inputRoomId.trim() });
      setAuthModalMode('choose_name');
      setShowAuthModal(true);
      return;
    }
    joinRoomById(inputRoomId, true);
  }

  // Handle setting unregistered username
  const handleChooseUnregisteredName = useCallback(async (newName) => {
    localStorage.setItem('simulchess_chosen_username', newName);
    localStorage.setItem(`simulchess_name_${userId}`, newName);
    await updateUsername(userId, newName);
    const updated = await getOrCreateProfile(userId, Boolean(authUser), authUser?.email, newName);
    setProfile(updated);
    setShowAuthModal(false);

    if (pendingAction === 'find_match') {
      setPendingAction(null);
      executeFindPublic(updated);
    } else if (pendingAction === 'create_room') {
      setPendingAction(null);
      executeCreatePrivate(updated);
    } else if (pendingAction?.type === 'join_room') {
      const targetRoom = pendingAction.roomId;
      setPendingAction(null);
      joinRoomById(targetRoom, true);
    }
  }, [userId, authUser, pendingAction, executeFindPublic, executeCreatePrivate, joinRoomById]);

  // Handle successful auth or logout
  const handleAuthSuccess = useCallback(async (user) => {
    setAuthUser(user);
    if (user) {
      const prof = await getOrCreateProfile(user.uid, true, user.email);
      setProfile(prof);
    } else {
      localStorage.removeItem('simulchess_chosen_username');
      const prof = await getOrCreateProfile(anonUserId, false, null);
      setProfile(prof);
    }
    setShowAuthModal(false);

    if (pendingAction === 'find_match') {
      setPendingAction(null);
      executeFindPublic();
    } else if (pendingAction === 'create_room') {
      setPendingAction(null);
      executeCreatePrivate();
    } else if (pendingAction?.type === 'join_room') {
      const targetRoom = pendingAction.roomId;
      setPendingAction(null);
      joinRoomById(targetRoom, true);
    }
  }, [anonUserId, pendingAction, executeFindPublic, executeCreatePrivate, joinRoomById]);

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
          {/* Top Bar inside Lobby: Profile Pill, Friends, Leaderboard */}
          <div className="lobby-top-bar">
            {hasChosenName && profile ? (
              <div 
                className="lobby-user-pill"
                onClick={() => { setAuthModalMode('account'); setShowAuthModal(true); }}
                title="View Profile & Rating"
              >
                <div className="user-pill-avatar">
                  <User size={15} />
                </div>
                <span className="user-pill-name">{profile.username}</span>
                {authUser ? (
                  <span className="badge-registered-tag" title="Verified Account">✓</span>
                ) : (
                  <span className="user-pill-guest-tag">Guest</span>
                )}
              </div>
            ) : <div className="top-bar-placeholder" />}

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
                className="btn btn-secondary btn-sm friends-btn" 
                onClick={() => {
                  if (!hasChosenName) {
                    setAuthModalMode('choose_name');
                    setShowAuthModal(true);
                  } else {
                    setShowFriendsModal(true);
                  }
                }}
                title="Friends List & Challenges"
              >
                <Users size={16} className="text-secondary" />
                <span>Friends</span>
              </button>

              {!hasChosenName ? (
                <button 
                  className="btn btn-primary btn-sm auth-btn" 
                  onClick={() => {
                    setAuthModalMode('choose_name');
                    setShowAuthModal(true);
                  }}
                >
                  <Sparkles size={15} />
                  <span>Choose Name</span>
                </button>
              ) : !authUser ? (
                <button 
                  className="btn btn-primary btn-sm auth-btn btn-register-top" 
                  onClick={() => {
                    setAuthModalMode('register');
                    setShowAuthModal(true);
                  }}
                  title="Claim username and permanently save Elo"
                >
                  <UserPlus size={15} />
                  <span>Register</span>
                </button>
              ) : null}
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

          {/* Pokémon Showdown-style Identity Alert Banners */}
          {!hasChosenName ? (
            <div className="showdown-callout-banner choose-name-callout">
              <div className="callout-text-group">
                <Sparkles size={16} className="text-amber" />
                <span>Choose a username to start playing rated matches.</span>
              </div>
              <button 
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => { setAuthModalMode('choose_name'); setShowAuthModal(true); }}
              >
                Choose Name
              </button>
            </div>
          ) : !authUser ? (
            <div className="showdown-callout-banner unregistered-callout">
              <div className="callout-text-group">
                <AlertCircle size={16} className="text-amber" />
                <span>
                  Playing as <strong>{profile?.username}</strong> (unregistered). Progress won't be saved unless you register!
                </span>
              </div>
              <button 
                type="button"
                className="btn btn-secondary btn-xs btn-callout-register"
                onClick={() => { setAuthModalMode('register'); setShowAuthModal(true); }}
              >
                <UserPlus size={13} />
                <span>Register to save Elo</span>
              </button>
            </div>
          ) : null}

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
            setAuthModalMode(hasChosenName ? 'register' : 'choose_name');
            setShowAuthModal(true);
          }}
        />

        <FriendsModal 
          isOpen={showFriendsModal}
          onClose={() => setShowFriendsModal(false)}
          userId={userId}
          username={profile?.username || 'Player'}
          onChallengeFriend={handleChallengeFriend}
        />

        <AuthModal 
          isOpen={showAuthModal}
          onClose={() => {
            setShowAuthModal(false);
            setPendingAction(null);
          }}
          currentUser={authUser}
          userProfile={profile}
          initialMode={authModalMode}
          onChooseUnregisteredName={handleChooseUnregisteredName}
          onAuthSuccess={handleAuthSuccess}
        />

        {/* Incoming Live Challenge Popup */}
        {incomingChallenge && (
          <div className="challenge-popup-backdrop">
            <div className="challenge-popup-card">
              <div className="challenge-popup-header">
                <Swords size={28} className="text-accent challenge-icon-bounce" />
                <h3 className="challenge-popup-title">Match Challenge!</h3>
              </div>
              <p className="challenge-popup-text">
                <strong>{incomingChallenge.fromUsername}</strong> ({incomingChallenge.fromElo} Elo) has challenged you to a game!
              </p>
              <div className="challenge-popup-actions">
                <button 
                  className="btn btn-primary btn-full btn-accept-challenge" 
                  onClick={handleAcceptChallenge}
                >
                  <Check size={16} />
                  <span>Accept & Play</span>
                </button>
                <button 
                  className="btn btn-secondary btn-full btn-decline-challenge" 
                  onClick={handleDeclineChallenge}
                >
                  <X size={16} />
                  <span>Decline</span>
                </button>
              </div>
            </div>
          </div>
        )}
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
    <>
      <GameArena
        gameState={gameState}
        color={color}
        roomId={roomId}
        userId={userId}
        userProfile={profile}
        onLeaveRoom={handleLeaveRoom}
      />

      {/* Incoming Live Challenge Popup if in game */}
      {incomingChallenge && (
        <div className="challenge-popup-backdrop">
          <div className="challenge-popup-card">
            <div className="challenge-popup-header">
              <Swords size={28} className="text-accent challenge-icon-bounce" />
              <h3 className="challenge-popup-title">Match Challenge!</h3>
            </div>
            <p className="challenge-popup-text">
              <strong>{incomingChallenge.fromUsername}</strong> ({incomingChallenge.fromElo} Elo) has challenged you to a game!
            </p>
            <div className="challenge-popup-actions">
              <button 
                className="btn btn-primary btn-full btn-accept-challenge" 
                onClick={handleAcceptChallenge}
              >
                <Check size={16} />
                <span>Accept & Play</span>
              </button>
              <button 
                className="btn btn-secondary btn-full btn-decline-challenge" 
                onClick={handleDeclineChallenge}
              >
                <X size={16} />
                <span>Decline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
