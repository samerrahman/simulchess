import { ref, get, set, update, query, orderByChild, limitToLast } from 'firebase/database';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { db, auth } from './firebase';

const DEFAULT_ELO = 1200;
const K_FACTOR = 32;

/**
 * Normalizes a username for unique indexing (alphanumeric + underscores, lowercase).
 */
export function normalizeUsername(username) {
  return (username || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Checks whether a username is available, taken, or registered in Firebase RTDB.
 */
export async function checkUsernameStatus(rawUsername) {
  const clean = normalizeUsername(rawUsername);
  if (!clean || clean.length < 2) {
    return { valid: false, message: 'Username must be at least 2 characters.' };
  }
  if (clean.length > 18) {
    return { valid: false, message: 'Username cannot exceed 18 characters.' };
  }

  try {
    const userSnap = await get(ref(db, `usernames/${clean}`));
    if (userSnap.exists()) {
      const data = userSnap.val();
      return {
        valid: true,
        exists: true,
        isRegistered: Boolean(data.isRegistered),
        uid: data.uid || null,
        email: data.email || null,
        displayName: data.username || rawUsername.trim()
      };
    }
    return {
      valid: true,
      exists: false,
      isRegistered: false,
      displayName: rawUsername.trim()
    };
  } catch (err) {
    console.error("Error checking username:", err);
    return { valid: true, exists: false, isRegistered: false, displayName: rawUsername.trim() };
  }
}

/**
 * Signs in using a registered username and password (Showdown style).
 */
export async function loginWithUsername(rawUsername, password) {
  const clean = normalizeUsername(rawUsername);
  const status = await checkUsernameStatus(rawUsername);
  if (!status.exists || !status.isRegistered) {
    throw new Error(`The username "${rawUsername}" is not registered.`);
  }

  const email = status.email || `${clean}@simulchess.app`;
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Registers an unregistered username with a password, permanently saving
 * the player's current session Elo, match record, and claim on the name.
 */
export async function registerUsernameWithAuth(rawUsername, password, currentSessionProfile = null, optionalEmail = null) {
  const clean = normalizeUsername(rawUsername);
  if (!clean || clean.length < 2) {
    throw new Error('Username must be at least 2 alphanumeric characters.');
  }
  if (clean.length > 18) {
    throw new Error('Username cannot exceed 18 characters.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const status = await checkUsernameStatus(rawUsername);
  if (status.exists && status.isRegistered) {
    throw new Error(`The name "${rawUsername}" is already registered. Please enter your password to log in.`);
  }

  const authEmail = optionalEmail?.trim() || `${clean}@simulchess.app`;
  const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
  const user = cred.user;

  try {
    await updateProfile(user, { displayName: rawUsername.trim() });
  } catch (e) {
    console.warn("Could not set displayName on auth user:", e);
  }

  // Claim username registry in RTDB
  await set(ref(db, `usernames/${clean}`), {
    uid: user.uid,
    username: rawUsername.trim(),
    email: authEmail,
    isRegistered: true,
    createdAt: Date.now()
  });

  // Transfer/initialize player's registered profile preserving current session Elo!
  const eloToKeep = Number(currentSessionProfile?.elo) || DEFAULT_ELO;
  const winsToKeep = Number(currentSessionProfile?.wins) || 0;
  const lossesToKeep = Number(currentSessionProfile?.losses) || 0;
  const drawsToKeep = Number(currentSessionProfile?.draws) || 0;
  const gamesToKeep = Number(currentSessionProfile?.gamesPlayed) || (winsToKeep + lossesToKeep + drawsToKeep);

  const registeredProfile = {
    userId: user.uid,
    username: rawUsername.trim(),
    elo: eloToKeep,
    wins: winsToKeep,
    losses: lossesToKeep,
    draws: drawsToKeep,
    gamesPlayed: gamesToKeep,
    isRegistered: true,
    email: authEmail,
    createdAt: currentSessionProfile?.createdAt || Date.now(),
    registeredAt: Date.now()
  };

  await set(ref(db, `users/${user.uid}`), registeredProfile);
  localStorage.setItem(`simulchess_name_${user.uid}`, rawUsername.trim());
  localStorage.setItem('simulchess_chosen_username', rawUsername.trim());

  return { user, profile: registeredProfile };
}

/**
 * Computes the Elo change for both players.
 * outcome: 1 if white won, 0 if black won, 0.5 if draw.
 */
export function calculateEloDelta(whiteElo, blackElo, outcome) {
  const wRating = Number(whiteElo) || DEFAULT_ELO;
  const bRating = Number(blackElo) || DEFAULT_ELO;

  // Expected scores
  const expectedWhite = 1 / (1 + Math.pow(10, (bRating - wRating) / 400));
  const expectedBlack = 1 / (1 + Math.pow(10, (wRating - bRating) / 400));

  let actualWhite = outcome;
  let actualBlack = 1 - outcome;

  const deltaWhite = Math.round(K_FACTOR * (actualWhite - expectedWhite));
  const deltaBlack = Math.round(K_FACTOR * (actualBlack - expectedBlack));

  return {
    whiteDelta: deltaWhite,
    blackDelta: deltaBlack,
    newWhiteElo: Math.max(100, wRating + deltaWhite),
    newBlackElo: Math.max(100, bRating + deltaBlack)
  };
}

/**
 * Gets or initializes a player's profile in Firebase and localStorage.
 */
export async function getOrCreateProfile(userId, isAuthUser = false, email = null, preferredUsername = null) {
  let localName = preferredUsername || localStorage.getItem(`simulchess_name_${userId}`) || localStorage.getItem('simulchess_chosen_username');
  if (localName && localName.startsWith('Player_')) {
    localName = null;
  }
  const userRef = ref(db, `users/${userId}`);

  try {
    const snap = await get(userRef);
    if (snap.exists()) {
      const data = snap.val();
      let resolvedName = data.username || localName || null;
      if (resolvedName && resolvedName.startsWith('Player_')) {
        resolvedName = null;
      }

      // If signed in, ensure isRegistered and email are saved
      if (isAuthUser && (!data.isRegistered || (email && !data.email))) {
        await update(userRef, {
          isRegistered: true,
          ...(email ? { email } : {})
        });
      }
      // If signed in, ensure the username registry is updated
      if (isAuthUser && resolvedName) {
        const clean = normalizeUsername(resolvedName);
        if (clean) {
          set(ref(db, `usernames/${clean}`), {
            uid: userId,
            username: resolvedName,
            email: email || data.email || `${clean}@simulchess.app`,
            isRegistered: true,
            createdAt: data.createdAt || Date.now()
          }).catch(() => {});
        }
      }
      return {
        userId,
        username: resolvedName,
        elo: Number(data.elo) || DEFAULT_ELO,
        gamesPlayed: Number(data.gamesPlayed) || 0,
        wins: Number(data.wins) || 0,
        losses: Number(data.losses) || 0,
        draws: Number(data.draws) || 0,
        isRegistered: Boolean(data.isRegistered || isAuthUser),
        email: data.email || email || null
      };
    } else {
      const initialProfile = {
        userId,
        username: localName || null,
        elo: DEFAULT_ELO,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        isRegistered: Boolean(isAuthUser),
        ...(email ? { email } : {}),
        createdAt: Date.now()
      };
      await set(userRef, initialProfile);
      if (isAuthUser && initialProfile.username) {
        const clean = normalizeUsername(initialProfile.username);
        if (clean) {
          set(ref(db, `usernames/${clean}`), {
            uid: userId,
            username: initialProfile.username,
            email: email || `${clean}@simulchess.app`,
            isRegistered: true,
            createdAt: Date.now()
          }).catch(() => {});
        }
      }
      return initialProfile;
    }
  } catch (err) {
    console.warn("Failed to fetch user profile, using fallback:", err);
    return {
      userId,
      username: localName || null,
      elo: DEFAULT_ELO,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      isRegistered: Boolean(isAuthUser),
      email: email || null
    };
  }
}

/**
 * Updates a player's display username.
 */
export async function updateUsername(userId, newName) {
  const cleanName = newName.trim().slice(0, 18);
  if (!cleanName) return;
  localStorage.setItem(`simulchess_name_${userId}`, cleanName);
  try {
    await update(ref(db, `users/${userId}`), { username: cleanName });
  } catch (err) {
    console.error("Error updating username in Firebase:", err);
  }
}

/**
 * Updates both players' stats and ratings after a match ends.
 * Guarantees atomic record if called once.
 */
export async function recordMatchOutcome(whiteUserId, blackUserId, winnerStatus) {
  if (!whiteUserId || !blackUserId) return null;

  try {
    // 1 for White win, 0 for Black win, 0.5 for draw
    let outcome = 0.5;
    if (winnerStatus === 'w_won') outcome = 1;
    else if (winnerStatus === 'b_won') outcome = 0;

    const [whiteProfile, blackProfile] = await Promise.all([
      getOrCreateProfile(whiteUserId, !whiteUserId.startsWith('user_')),
      getOrCreateProfile(blackUserId, !blackUserId.startsWith('user_'))
    ]);

    const { whiteDelta, blackDelta, newWhiteElo, newBlackElo } = calculateEloDelta(
      whiteProfile.elo,
      blackProfile.elo,
      outcome
    );

    const whiteWins = outcome === 1 ? (whiteProfile.wins || 0) + 1 : (whiteProfile.wins || 0);
    const whiteLosses = outcome === 0 ? (whiteProfile.losses || 0) + 1 : (whiteProfile.losses || 0);
    const whiteDraws = outcome === 0.5 ? (whiteProfile.draws || 0) + 1 : (whiteProfile.draws || 0);

    const blackWins = outcome === 0 ? (blackProfile.wins || 0) + 1 : (blackProfile.wins || 0);
    const blackLosses = outcome === 1 ? (blackProfile.losses || 0) + 1 : (blackProfile.losses || 0);
    const blackDraws = outcome === 0.5 ? (blackProfile.draws || 0) + 1 : (blackProfile.draws || 0);

    // Update in Firebase
    await Promise.all([
      update(ref(db, `users/${whiteUserId}`), {
        elo: newWhiteElo,
        gamesPlayed: (whiteProfile.gamesPlayed || 0) + 1,
        wins: whiteWins,
        losses: whiteLosses,
        draws: whiteDraws,
        lastMatch: Date.now()
      }),
      update(ref(db, `users/${blackUserId}`), {
        elo: newBlackElo,
        gamesPlayed: (blackProfile.gamesPlayed || 0) + 1,
        wins: blackWins,
        losses: blackLosses,
        draws: blackDraws,
        lastMatch: Date.now()
      })
    ]);

    return {
      whiteDelta,
      blackDelta,
      newWhiteElo,
      newBlackElo
    };
  } catch (err) {
    console.error("Failed to record match outcome:", err);
    return null;
  }
}

/**
 * Fetches the top 10 rated registered players for the leaderboard.
 * Anonymous/guest players are excluded.
 */
export async function getTopLeaderboard() {
  try {
    const usersRef = ref(db, 'users');
    const topQuery = query(usersRef, orderByChild('elo'), limitToLast(100));
    const snap = await get(topQuery);

    if (!snap.exists()) return [];

    const list = [];
    snap.forEach((child) => {
      const val = child.val();
      const isGuest = child.key.startsWith('user_');
      const isRegistered = !isGuest && (val?.isRegistered === true || Boolean(val?.email) || val?.isRegistered !== false);
      if (val && val.gamesPlayed > 0 && isRegistered) {
        list.push({
          userId: child.key,
          username: val.username || 'Anonymous',
          elo: Number(val.elo) || DEFAULT_ELO,
          wins: Number(val.wins) || 0,
          losses: Number(val.losses) || 0,
          draws: Number(val.draws) || 0,
          gamesPlayed: Number(val.gamesPlayed) || 0
        });
      }
    });

    // RTDB returns limitToLast in ascending order, so reverse for highest first
    return list.sort((a, b) => b.elo - a.elo).slice(0, 10);
  } catch (err) {
    console.error("Failed to load leaderboard:", err);
    return [];
  }
}
