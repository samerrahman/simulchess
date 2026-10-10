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
  X,
  Sliders,
  Clock,
  Zap,
  Flame,
  Radio,
  BookOpen
} from 'lucide-react';
import GameArena from './GameArena';
import HowToPlayModal from './HowToPlayModal';
import LeaderboardModal from './LeaderboardModal';
import AuthModal from './AuthModal';
import FriendsModal from './FriendsModal';
import ProfilePage from './ProfilePage';
import SettingsPage from './SettingsPage';
import LeaderboardPage from './LeaderboardPage';
import FriendsPage from './FriendsPage';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  ref, 
  get, 
  set, 
  update, 
  onValue, 
  remove, 
  push, 
  onDisconnect,
  query,
  limitToLast
} from 'firebase/database';
import { createInitialGameState, VARIANTS } from './gameLogic';
import { getOrCreateProfile, updateUsername, getTopLeaderboard } from './eloService';
import { 
  setupUserPresence, 
  setUserGameStatus, 
  subscribeToIncomingChallenges, 
  respondToChallenge, 
  sendChallenge,
  subscribeToFriends
} from './friendService';

function PlayfieldGraphic({ size = 8 }) {
  const sq = 48 / size;
  const squares = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const isLight = (r + c) % 2 === 0;
      squares.push(
        <rect
          key={`${r}-${c}`}
          x={c * sq}
          y={r * sq}
          width={sq}
          height={sq}
          fill={isLight ? 'var(--board-light, #8f9bb3)' : 'var(--board-dark, #2e384d)'}
        />
      );
    }
  }

  return (
    <svg
      width={44}
      height={44}
      viewBox="0 0 48 48"
      className={`playfield-graphic playfield-graphic-${size}`}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="3" fill="var(--board-dark, #2e384d)" />
      {squares}
      <rect
        width="48"
        height="48"
        rx="3"
        fill="none"
        stroke="var(--border-light, #334469)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function App() {
  // Navigation: 'play' | 'profile' | 'settings'
  const [navTab, setNavTab] = useState('play');

  // Lobby Sub-tab: 'quick' | 'lobby' | 'leaderboard'
  const [lobbyTab, setLobbyTab] = useState('quick');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalVariant, setCreateModalVariant] = useState('standard');
  const [lobbyRooms, setLobbyRooms] = useState([]);
  const [topLeadersPreview, setTopLeadersPreview] = useState([]);

  // Game variant: 'standard' | 'skirmish'
  const [selectedVariant, setSelectedVariant] = useState('standard');

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

  // Friends quick preview count
  const [friendsList, setFriendsList] = useState([]);

  // Matchmaking in-lobby queue state
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [queuedRoomId, setQueuedRoomId] = useState(null);
  const [queueKey, setQueueKey] = useState(null);
  const [queueSeconds, setQueueSeconds] = useState(0);

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

  // Listen to friends list for quick indicator in navbar
  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToFriends(userId, (list) => {
      setFriendsList(list);
    });
    return () => unsub();
  }, [userId]);

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
        const myName = profile?.username || `Guest_${userId.slice(-4).toUpperCase()}`;
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
        setGameState({ ...data, ...updates, players: nextPlayers });
      } else {
        setGameState(data);
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
      const myName = profile?.username || `Guest_${userId.slice(-4).toUpperCase()}`;
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

  // Handle browser Back / Forward buttons natively
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (!roomParam) {
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

  // Check if player has chosen a custom name or registered account
  const hasChosenName = Boolean(authUser || (profile?.username && profile.username.trim()));

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
      const myName = profile?.username || `Guest_${userId.slice(-4).toUpperCase()}`;
      const myElo = profile?.elo || 1200;

      await update(ref(db, `games/${roomId}`), {
        [`players/${seatColor}`]: userId,
        [`playerMeta/${seatColor}`]: { userId, username: myName, elo: myElo }
      });
      setColor(seatColor);

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

    if (color && (color === 'w' || color === 'b')) {
      const playerRef = ref(db, `games/${roomId}/players/${color}`);
      onDisconnect(playerRef).remove();
    }

    const unsub = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);

        if (color === 'spectator' && data.players) {
          if (!data.players.w && data.players.b !== userId) {
            claimSeat('w');
          } else if (!data.players.b && data.players.w !== userId) {
            claimSeat('b');
          }
        }
      } else {
        setGameState(null);
        setRoomId('');
        setColor(null);
        window.history.pushState({}, '', window.location.pathname);
      }
    });

    return () => unsub();
  }, [roomId, color, userId, claimSeat]);

  // Matchmaking queue timer
  useEffect(() => {
    let interval = null;
    if (isSearchingMatch) {
      interval = setInterval(() => {
        setQueueSeconds(s => s + 1);
      }, 1000);
    } else {
      setQueueSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearchingMatch]);

  // Real-time listener for queued room pairing: Opponent joins -> enter GameArena!
  useEffect(() => {
    if (!isSearchingMatch || !queuedRoomId) return;

    const queuedGameRef = ref(db, `games/${queuedRoomId}`);
    const unsub = onValue(queuedGameRef, (snap) => {
      const data = snap.val();
      if (data && (data.players?.b || data.status === 'playing')) {
        // Match Found! Transition into game
        setGameState(data);
        setRoomId(queuedRoomId);
        setQueuedRoomId(null);
        setQueueKey(null);
        setIsSearchingMatch(false);
        window.history.pushState({ inGame: true, roomId: queuedRoomId }, '', `?room=${queuedRoomId}`);
      }
    });

    return () => unsub();
  }, [isSearchingMatch, queuedRoomId]);

  // Cancel in-lobby matchmaking
  const handleCancelMatchmaking = useCallback(async () => {
    setIsSearchingMatch(false);
    setLoadingMsg('');
    if (queueKey) {
      await remove(ref(db, `queue/${queueKey}`)).catch(() => {});
      setQueueKey(null);
    }
    if (queuedRoomId) {
      await remove(ref(db, `games/${queuedRoomId}`)).catch(() => {});
      setQueuedRoomId(null);
    }
  }, [queueKey, queuedRoomId]);

  // Execute Public Matchmaking
  const executeFindPublic = useCallback(async (customProf = null, forcedVariant = null) => {
    const activeVariant = forcedVariant || selectedVariant;
    setSelectedVariant(activeVariant);
    setIsSearchingMatch(true);
    setQueueSeconds(0);
    setErrorMsg('');

    try {
      let targetGameId = null;
      let assignedColor = 'spectator';
      const activeProf = customProf || profile;
      const myName = activeProf?.username || `Guest_${userId.slice(-4).toUpperCase()}`;
      const myElo = activeProf?.elo || 1200;

      const queueRef = ref(db, 'queue');
      const snap = await get(queueRef);
      const queueObj = snap.val();

      if (queueObj) {
        for (const [qKey, queueVal] of Object.entries(queueObj)) {
          const queuedId = typeof queueVal === 'string' ? queueVal : queueVal?.roomId;
          const queuedVariant = typeof queueVal === 'object' ? (queueVal.variant || 'standard') : 'standard';

          // Match only if the room's variant matches the selected variant
          if (queuedVariant !== activeVariant) continue;

          await remove(ref(db, `queue/${qKey}`));

          const gameSnap = await get(ref(db, `games/${queuedId}`));
          if (gameSnap.exists()) {
            const data = gameSnap.val();
            if (!data.players || (!data.players.w && !data.players.b)) {
              continue;
            }

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
                // Auto-start Showdown ladder timer
                updates['timer/enabled'] = true;
                updates['timer/turnLimit'] = 60;
                updates['timer/banks'] = { w: 150, b: 150 };
                updates['timer/turnStartedAt'] = Date.now();
              }
              await update(ref(db, `games/${queuedId}`), updates);
              setGameState({ ...data, ...updates, players: fullPlayers });
            }
            break;
          }
        }
      }

      if (targetGameId) {
        // Paired immediately with waiting room in queue!
        setColor(assignedColor);
        setRoomId(targetGameId);
        setIsSearchingMatch(false);
        window.history.pushState({ inGame: true, roomId: targetGameId }, '', `?room=${targetGameId}`);
      } else {
        // No match in queue: Create room, add to queue, BUT STAY IN LOBBY until paired!
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const initialGame = createInitialGameState(activeVariant);
        initialGame.players = { w: userId, b: null };
        initialGame.playerMeta = {
          w: { userId, username: myName, elo: myElo },
          b: null
        };
        initialGame.status = 'waiting';
        initialGame.variant = activeVariant;

        await set(ref(db, `games/${newRoomId}`), initialGame);
        const newQueueRef = await push(ref(db, 'queue'), { roomId: newRoomId, variant: activeVariant });
        setQueueKey(newQueueRef.key);
        setQueuedRoomId(newRoomId);
        setColor('w');
        // Stay in lobby (roomId remains empty)!
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Matchmaking error: " + err.message);
      setIsSearchingMatch(false);
    }
  }, [userId, profile, selectedVariant]);

  // Execute Private Room Creation
  const executeCreatePrivate = useCallback(async (customProf = null, forcedVariant = null) => {
    const activeVariant = forcedVariant || selectedVariant;
    setSelectedVariant(activeVariant);
    setLoadingMsg("Creating room...");
    setErrorMsg('');
    try {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const initialGame = createInitialGameState(activeVariant);
      const activeProf = customProf || profile;
      const myName = activeProf?.username || `Guest_${userId.slice(-4).toUpperCase()}`;
      const myElo = activeProf?.elo || 1200;

      initialGame.players = { w: userId, b: null };
      initialGame.playerMeta = {
        w: { userId, username: myName, elo: myElo },
        b: null
      };
      initialGame.status = 'waiting';
      initialGame.variant = activeVariant;
      initialGame.timer = {
        enabled: true,
        turnLimit: 60,
        banks: { w: 150, b: 150 }
      };

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
  }, [userId, profile, selectedVariant]);



  // Quick match trigger from Lichess grid
  const handleQuickPair = useCallback((variant = 'standard', isRated = true) => {
    setSelectedVariant(variant);
    if (!hasChosenName && isRated) {
      setPendingAction({ type: 'find_match', variant });
      setAuthModalMode('choose_name');
      setShowAuthModal(true);
      return;
    }
    executeFindPublic(null, variant);
  }, [hasChosenName, executeFindPublic]);

  // Public match button clicked
  function handleFindPublic(variant = selectedVariant) {
    if (!hasChosenName) {
      setPendingAction({ type: 'find_match', variant });
      setAuthModalMode('choose_name');
      setShowAuthModal(true);
      return;
    }
    executeFindPublic(null, variant);
  }

  // Create private room button clicked
  function handleCreatePrivate(variant = selectedVariant) {
    if (!hasChosenName) {
      setPendingAction({ type: 'create_room', variant });
      setAuthModalMode('choose_name');
      setShowAuthModal(true);
      return;
    }
    executeCreatePrivate(null, variant);
  }

  // Listen to lobby rooms and fetch leaderboard preview when lobbyTab changes
  useEffect(() => {
    if (navTab !== 'play') return;
    if (lobbyTab === 'lobby') {
      const gamesRef = query(ref(db, 'games'), limitToLast(25));
      const unsub = onValue(gamesRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setLobbyRooms([]);
          return;
        }
        const rooms = Object.entries(data)
          .map(([id, game]) => ({
            id,
            variant: game.variant || 'standard',
            status: game.status || 'waiting',
            isBot: Boolean(game.isBot),
            playerW: game.playerMeta?.w?.username || 'Player 1',
            playerWElo: game.playerMeta?.w?.elo || 1200,
            playerB: game.playerMeta?.b?.username || (game.status === 'waiting' ? 'Waiting...' : 'Player 2'),
            playerBElo: game.playerMeta?.b?.elo || 1200,
            turnCount: game.turnCount || 1,
          }))
          .filter(r => !r.isBot)
          .reverse();
        setLobbyRooms(rooms);
      });
      return () => unsub();
    } else if (lobbyTab === 'leaderboard') {
      getTopLeaderboard().then(data => {
        setTopLeadersPreview((data || []).slice(0, 10));
      }).catch(console.error);
    }
  }, [navTab, lobbyTab]);

  // Join Room from input form
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

  // Handle setting chosen unregistered username
  const handleChooseUnregisteredName = useCallback(async (newName) => {
    localStorage.setItem('simulchess_chosen_username', newName);
    localStorage.setItem(`simulchess_name_${userId}`, newName);
    await updateUsername(userId, newName);
    const updated = await getOrCreateProfile(userId, Boolean(authUser), authUser?.email, newName);
    setProfile(updated);
    setShowAuthModal(false);

    if (pendingAction === 'find_match' || pendingAction?.type === 'find_match') {
      const v = pendingAction?.variant || selectedVariant;
      setPendingAction(null);
      executeFindPublic(updated, v);
    } else if (pendingAction === 'create_room' || pendingAction?.type === 'create_room') {
      const v = pendingAction?.variant || selectedVariant;
      setPendingAction(null);
      executeCreatePrivate(updated, v);
    } else if (pendingAction?.type === 'join_room') {
      const targetRoom = pendingAction.roomId;
      setPendingAction(null);
      joinRoomById(targetRoom, true);
    }
  }, [userId, authUser, pendingAction, executeFindPublic, executeCreatePrivate, joinRoomById, selectedVariant]);

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

    if (pendingAction === 'find_match' || pendingAction?.type === 'find_match') {
      const v = pendingAction?.variant || selectedVariant;
      setPendingAction(null);
      executeFindPublic(null, v);
    } else if (pendingAction === 'create_room' || pendingAction?.type === 'create_room') {
      const v = pendingAction?.variant || selectedVariant;
      setPendingAction(null);
      executeCreatePrivate(null, v);
    } else if (pendingAction?.type === 'join_room') {
      const targetRoom = pendingAction.roomId;
      setPendingAction(null);
      joinRoomById(targetRoom, true);
    }
  }, [anonUserId, pendingAction, executeFindPublic, executeCreatePrivate, joinRoomById, selectedVariant]);

  // Log out user
  const handleLogout = useCallback(async () => {
    await signOut(auth);
    setAuthUser(null);
    localStorage.removeItem('simulchess_chosen_username');
    const prof = await getOrCreateProfile(anonUserId, false, null);
    setProfile(prof);
    setNavTab('play');
  }, [anonUserId]);

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

  const onlineFriendsCount = friendsList.filter(f => f.isOnline).length;

  // IN-GAME VIEW
  if (roomId) {
    if (!gameState) {
      return (
        <div className="site-wrapper">
          <header className="site-navbar">
            <div className="site-nav-left">
              <div className="site-brand" onClick={handleLeaveRoom}>
                <div className="brand-logo-icon">
                  <Swords size={20} />
                </div>
                <div className="brand-text-block">
                  <span className="brand-title">SimulChess</span>
                  <span className="brand-badge">Connecting</span>
                </div>
              </div>
            </div>
            <div className="site-nav-right">
              <button className="btn btn-secondary btn-sm" onClick={handleLeaveRoom}>
                Cancel
              </button>
            </div>
          </header>
          <div className="page-loading-state" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <Loader2 size={36} className="animate-spin text-accent" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Entering Match Arena...</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Synchronizing room {roomId}...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="app-container">
        <GameArena
          roomId={roomId}
          playerColor={color}
          gameState={gameState}
          currentUserId={userId}
          currentUserProfile={profile}
          onLeave={handleLeaveRoom}
          onClaimSeat={claimSeat}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onOpenFriends={() => setShowFriendsModal(true)}
        />

        {/* Incoming Challenge Popup while in Game */}
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
                  <span>Accept & Switch Room</span>
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
      </div>
    );
  }

  // REAL WEBSITE / LOBBY EXPERIENCE
  return (
    <div className="app-container site-layout">
      {/* Top Main Navigation Bar */}
      <header className="site-navbar">
        <div className="site-nav-left">
          <div 
            className="site-brand" 
            onClick={() => setNavTab('play')}
            title="simulchess.online"
          >
            <div className="brand-logo-icon">
              <Swords size={20} className="logo-swords" />
            </div>
            <div className="brand-text-block">
              <span className="brand-title">simulchess.online</span>
            </div>
          </div>

          <nav className="site-nav-links">
            <button 
              className={`nav-link-btn ${navTab === 'play' ? 'active' : ''}`}
              onClick={() => setNavTab('play')}
            >
              <span>PLAY</span>
            </button>

            <button 
              className={`nav-link-btn ${navTab === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setNavTab('leaderboard')}
            >
              <span>LEADERBOARD</span>
            </button>

            <button 
              className={`nav-link-btn ${navTab === 'friends' ? 'active' : ''}`}
              onClick={() => setNavTab('friends')}
            >
              <span>FRIENDS</span>
              {onlineFriendsCount > 0 && (
                <span className="nav-badge-pill">{onlineFriendsCount}</span>
              )}
            </button>


            <button 
              className={`nav-link-btn ${navTab === 'settings' ? 'active' : ''}`}
              onClick={() => setNavTab('settings')}
            >
              <span>SETTINGS</span>
            </button>
          </nav>
        </div>

        <div className="site-nav-right">
          {hasChosenName && profile?.username ? (
            <div 
              className="navbar-user-pill"
              onClick={() => setNavTab('profile')}
              title="View your profile"
            >
              <div className="nav-user-avatar">
                <User size={14} />
              </div>
              <span className="nav-user-name">{profile.username}</span>
              <span className="nav-user-elo">{profile.elo || 1200}</span>
              {authUser ? (
                <span className="badge-registered-tag" title="Verified Account">✓</span>
              ) : null}
            </div>
          ) : (
            <div className="nav-auth-actions">
              <button 
                className="nav-ghost-btn"
                onClick={() => {
                  setAuthModalMode('login');
                  setShowAuthModal(true);
                }}
              >
                SIGN IN
              </button>
              <button 
                className="btn btn-primary btn-sm btn-choose-name-top"
                onClick={() => {
                  setAuthModalMode('choose_name');
                  setShowAuthModal(true);
                }}
              >
                <span>CHOOSE NAME</span>
              </button>
            </div>
          )}

          <button 
            className="btn-icon nav-help-btn"
            onClick={() => setNavTab('settings')}
            title="Settings & Board Themes"
          >
            <Sliders size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="site-main-viewport">
        {/* VIEW: SETTINGS */}
        {navTab === 'settings' && (
          <SettingsPage onNavigateToPlay={() => setNavTab('play')} />
        )}

        {/* VIEW: LEADERBOARD */}
        {navTab === 'leaderboard' && (
          <LeaderboardPage 
            currentUserId={userId}
            currentUser={profile}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setShowAuthModal(true);
            }}
            onNavigateToPlay={() => setNavTab('play')}
          />
        )}

        {/* VIEW: FRIENDS */}
        {navTab === 'friends' && (
          <FriendsPage 
            userId={userId}
            username={profile?.username}
            hasChosenName={hasChosenName}
            onChallengeFriend={handleChallengeFriend}
            onNavigateToPlay={() => setNavTab('play')}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setShowAuthModal(true);
            }}
          />
        )}

        {/* VIEW: PROFILE */}
        {navTab === 'profile' && (
          <ProfilePage 
            profile={profile}
            authUser={authUser}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setShowAuthModal(true);
            }}
            onLogout={handleLogout}
            onNavigateToPlay={() => setNavTab('play')}
          />
        )}

        {/* VIEW: PLAY (MAIN HUB) */}
        {navTab === 'play' && (
          <div className="play-hub-container lichess-container">
            {/* Status alerts */}
            {loadingMsg && (
              <div className="alert-box alert-info alert-hub-info" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: '#262421', border: '1px solid #36332e', color: 'var(--accent-blue)', padding: '0.6rem 1rem', borderRadius: '4px' }}>
                <Loader2 size={16} className="animate-spin" />
                <span>{loadingMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="alert-box alert-error alert-hub-error">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Main Lichess 2-Column Split */}
            <div className="lichess-lobby">
              {/* Left Sidebar */}
              <div className="lichess-sidebar">
                <div className="lichess-action-stack">
                  <button 
                    type="button"
                    className="lichess-sidebar-btn"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <div className="lichess-btn-icon-wrap">
                      <Users size={22} />
                    </div>
                    <span className="lichess-btn-label">Create a game</span>
                  </button>

                  <button 
                    type="button"
                    className="lichess-sidebar-btn"
                    onClick={() => {
                      if (!hasChosenName) {
                        setAuthModalMode('choose_name');
                        setShowAuthModal(true);
                      } else {
                        setShowFriendsModal(true);
                      }
                    }}
                  >
                    <div className="lichess-btn-icon-wrap">
                      <User size={22} />
                    </div>
                    <span className="lichess-btn-label">Challenge a friend</span>
                  </button>

                </div>



                {/* Quick Join by Code */}
                <div className="lichess-quick-join-box">
                  <form onSubmit={handleJoinSubmit} className="lichess-code-form">
                    <input 
                      type="text"
                      className="lichess-code-input"
                      placeholder="Room Code"
                      maxLength={8}
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                      disabled={isSearchingMatch}
                    />
                    <button 
                      type="submit"
                      className="lichess-code-btn"
                      disabled={!inputRoomId.trim() || isSearchingMatch}
                    >
                      Join
                    </button>
                  </form>
                </div>

                {/* Mission / Footer statement */}
                <div className="lichess-sidebar-footer">
                  <p>
                    SimulChess is a real-time simultaneous chess platform. Free, open-source, no ads.
                  </p>
                </div>
              </div>

              {/* Right Main Column */}
              <div className="lichess-main-col">
                {/* Tabs Row */}
                <div className="lichess-tabs-nav">
                  <button 
                    type="button"
                    className={`lichess-tab-nav-btn ${lobbyTab === 'quick' ? 'active' : ''}`}
                    onClick={() => setLobbyTab('quick')}
                  >
                    Quick Match
                  </button>
                  <button 
                    type="button"
                    className={`lichess-tab-nav-btn ${lobbyTab === 'lobby' ? 'active' : ''}`}
                    onClick={() => setLobbyTab('lobby')}
                  >
                    Lobby {lobbyRooms.length > 0 && <span className="tab-count-badge">({lobbyRooms.length})</span>}
                  </button>
                  <button 
                    type="button"
                    className={`lichess-tab-nav-btn ${lobbyTab === 'leaderboard' ? 'active' : ''}`}
                    onClick={() => setLobbyTab('leaderboard')}
                  >
                    Leaderboard
                  </button>
                </div>

                {/* Tab 1: Quick Match Grid */}
                {lobbyTab === 'quick' && (
                  <div className="lichess-quick-wrapper">
                    {/* Radar overlay when searching */}
                    {isSearchingMatch ? (
                      <div className="lichess-queue-overlay">
                        <div className="lichess-radar-spinner">
                          <div className="radar-circle radar-c1" />
                          <div className="radar-circle radar-c2" />
                          <div className="radar-circle radar-c3" />
                          <Radio size={36} className="radar-core-icon" />
                        </div>
                        <h3 className="queue-headline">Waiting for opponent...</h3>
                        <p className="queue-detail">
                          {selectedVariant === 'skirmish' ? '6×6 Skirmish' : '8×8 Standard'} • Rated Match
                        </p>
                        <p className="queue-timer-clock">
                          Elapsed: {Math.floor(queueSeconds / 60)}:{String(queueSeconds % 60).padStart(2, '0')}
                        </p>
                        <button 
                          type="button"
                          className="btn btn-secondary btn-cancel-queue-lichess"
                          onClick={handleCancelMatchmaking}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="lichess-quick-grid">
                        {/* Tile 1: 8x8 Standard Rated */}
                        <button 
                          type="button"
                          className="quick-tile"
                          onClick={() => handleQuickPair('standard', true)}
                        >
                          <div className="tile-primary-text">8×8 Standard</div>
                          <div className="tile-sub-text">Rated • 150s bank</div>
                        </button>

                        {/* Tile 2: 8x8 Casual */}
                        <button 
                          type="button"
                          className="quick-tile"
                          onClick={() => handleQuickPair('standard', false)}
                        >
                          <div className="tile-primary-text">8×8 Casual</div>
                          <div className="tile-sub-text">Casual match</div>
                        </button>

                        {/* Tile 3: 6x6 Skirmish Rated */}
                        <button 
                          type="button"
                          className="quick-tile"
                          onClick={() => handleQuickPair('skirmish', true)}
                        >
                          <div className="tile-primary-text">6×6 Skirmish</div>
                          <div className="tile-sub-text">Rated • 150s bank</div>
                        </button>

                        {/* Tile 4: 6x6 Skirmish Casual */}
                        <button 
                          type="button"
                          className="quick-tile"
                          onClick={() => handleQuickPair('skirmish', false)}
                        >
                          <div className="tile-primary-text">6×6 Casual</div>
                          <div className="tile-sub-text">Fast skirmish</div>
                        </button>

                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Lobby Table */}
                {lobbyTab === 'lobby' && (
                  <div className="lichess-lobby-view">
                    <div className="lobby-table-header-bar">
                      <span className="lobby-table-title">Open Game Rooms</span>
                      <button 
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={() => setShowCreateModal(true)}
                      >
                        + Create Room
                      </button>
                    </div>

                    {lobbyRooms.length === 0 ? (
                      <div className="lobby-empty-placeholder">
                        <p>No open public rooms waiting right now.</p>
                        <button 
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowCreateModal(true)}
                        >
                          Create a Room
                        </button>
                      </div>
                    ) : (
                      <div className="lobby-table-container">
                        <table className="lichess-table">
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>Rating</th>
                              <th>Mode</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lobbyRooms.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <strong>{r.playerW}</strong>
                                  {r.status === 'playing' && <span className="vs-sep"> vs {r.playerB}</span>}
                                </td>
                                <td>{r.playerWElo}</td>
                                <td>
                                  <span className="badge-variant">
                                    {r.variant === 'skirmish' ? '6×6 Skirmish' : '8×8 Standard'}
                                  </span>
                                </td>
                                <td>
                                  <span className={`status-pill status-${r.status}`}>
                                    {r.status === 'waiting' ? 'Waiting' : `Turn ${r.turnCount}`}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {r.status === 'waiting' ? (
                                    <button 
                                      type="button"
                                      className="btn btn-primary btn-xs"
                                      onClick={() => joinRoomById(r.id, true)}
                                    >
                                      Join
                                    </button>
                                  ) : (
                                    <button 
                                      type="button"
                                      className="btn btn-secondary btn-xs"
                                      onClick={() => joinRoomById(r.id, false)}
                                    >
                                      Spectate
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Leaderboard Preview */}
                {lobbyTab === 'leaderboard' && (
                  <div className="lichess-leaderboard-view">
                    <div className="lobby-table-header-bar">
                      <span className="lobby-table-title">Top Players</span>
                      <button 
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => setNavTab('leaderboard')}
                      >
                        Full Leaderboard →
                      </button>
                    </div>
                    <div className="lobby-table-container">
                      <table className="lichess-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th style={{ textAlign: 'right' }}>Rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topLeadersPreview.map((leader, idx) => (
                            <tr key={leader.id || idx}>
                              <td><strong>#{idx + 1}</strong></td>
                              <td>{leader.username}</td>
                              <td style={{ textAlign: 'right' }}><strong style={{ color: 'var(--text-bright)' }}>{leader.elo || 1200}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Widgets Row: Friends & Rules */}
            <div className="play-hub-widgets-row">
              {/* Online Friends Widget */}
              <div className="hub-widget-card">
                <div className="widget-header">
                  <div className="widget-title-row">
                    <Users size={18} className="text-accent" />
                    <h4>Friends Online</h4>
                  </div>
                  <button 
                    type="button"
                    className="auth-link-btn"
                    onClick={() => {
                      if (!hasChosenName) {
                        setAuthModalMode('choose_name');
                        setShowAuthModal(true);
                      } else {
                        setNavTab('friends');
                      }
                    }}
                  >
                    Manage List →
                  </button>
                </div>

                {friendsList.length === 0 ? (
                  <div className="widget-empty-block">
                    <p>No friends added yet.</p>
                  </div>
                ) : (
                  <div className="widget-friends-list">
                    {friendsList.slice(0, 4).map(f => (
                      <div key={f.friendId} className="widget-friend-item">
                        <div className="friend-meta-group">
                          <span className={`presence-dot ${f.isOnline ? (f.gameStatus === 'in_game' ? 'presence-ingame' : 'presence-online') : 'presence-offline'}`} />
                          <span className="widget-friend-name">{f.username}</span>
                          <span className="widget-friend-elo">({f.elo} Elo)</span>
                        </div>
                        <button 
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => handleChallengeFriend(f)}
                          disabled={!f.isOnline}
                        >
                          Challenge
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rules & Mechanics Widget */}
              <div className="hub-widget-card">
                <div className="widget-header">
                  <div className="widget-title-row">
                    <BookOpen size={18} className="text-amber" />
                    <h4>Key Mechanics</h4>
                  </div>
                  <button 
                    type="button"
                    className="auth-link-btn"
                    onClick={() => setShowHowToPlay(true)}
                  >
                    Full Guide →
                  </button>
                </div>

                <div className="widget-rules-list">
                  <div className="rule-bullet">
                    <span className="rule-bullet-num">1</span>
                    <p><strong>Simultaneous:</strong> Both moves execute at the same time each turn.</p>
                  </div>
                  <div className="rule-bullet">
                    <span className="rule-bullet-num">2</span>
                    <p><strong>Collisions:</strong> Two pieces targeting the same square destroy each other.</p>
                  </div>
                  <div className="rule-bullet">
                    <span className="rule-bullet-num">3</span>
                    <p><strong>Defend:</strong> Move onto your own piece to set a counter-ambush if attacked.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
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
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
        currentUser={authUser}
        userProfile={profile}
        onAuthSuccess={handleAuthSuccess}
        onChooseUnregisteredName={handleChooseUnregisteredName}
      />

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content lichess-create-modal">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontWeight: 700 }}>Create a game</h3>
              <button 
                type="button"
                className="modal-close-btn" 
                onClick={() => setShowCreateModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="create-modal-section">
                <label className="create-section-label">Variant</label>
                <div className="create-variant-row">
                  <button 
                    type="button"
                    className={`create-variant-btn ${createModalVariant === 'standard' ? 'active' : ''}`}
                    onClick={() => setCreateModalVariant('standard')}
                  >
                    <PlayfieldGraphic size={8} />
                    <span className="create-variant-text">Standard (8×8)</span>
                  </button>
                  <button 
                    type="button"
                    className={`create-variant-btn ${createModalVariant === 'skirmish' ? 'active' : ''}`}
                    onClick={() => setCreateModalVariant('skirmish')}
                  >
                    <PlayfieldGraphic size={6} />
                    <span className="create-variant-text">Skirmish (6×6)</span>
                  </button>
                </div>
              </div>

              <div className="create-modal-actions">
                <button 
                  type="button"
                  className="btn btn-primary btn-full"
                  onClick={() => {
                    setShowCreateModal(false);
                    handleFindPublic(createModalVariant);
                  }}
                >
                  <Play size={16} />
                  <span>Public Matchmaking (Rated)</span>
                </button>

                <button 
                  type="button"
                  className="btn btn-secondary btn-full"
                  onClick={() => {
                    setShowCreateModal(false);
                    handleCreatePrivate(createModalVariant);
                  }}
                >
                  <Users size={16} />
                  <span>Create Private Room (Invite Friend)</span>
                </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Incoming Match Challenge Popup */}
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
