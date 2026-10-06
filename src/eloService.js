import { ref, get, set, update, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from './firebase';

const DEFAULT_ELO = 1200;
const K_FACTOR = 32;

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
export async function getOrCreateProfile(userId) {
  const localName = localStorage.getItem(`simulchess_name_${userId}`);
  const userRef = ref(db, `users/${userId}`);

  try {
    const snap = await get(userRef);
    if (snap.exists()) {
      const data = snap.val();
      return {
        userId,
        username: data.username || localName || `Player_${userId.slice(-4).toUpperCase()}`,
        elo: Number(data.elo) || DEFAULT_ELO,
        gamesPlayed: Number(data.gamesPlayed) || 0,
        wins: Number(data.wins) || 0,
        losses: Number(data.losses) || 0,
        draws: Number(data.draws) || 0
      };
    } else {
      const initialProfile = {
        userId,
        username: localName || `Player_${userId.slice(-4).toUpperCase()}`,
        elo: DEFAULT_ELO,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        createdAt: Date.now()
      };
      await set(userRef, initialProfile);
      return initialProfile;
    }
  } catch (err) {
    console.warn("Failed to fetch user profile, using fallback:", err);
    return {
      userId,
      username: localName || `Player_${userId.slice(-4).toUpperCase()}`,
      elo: DEFAULT_ELO,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0
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
      getOrCreateProfile(whiteUserId),
      getOrCreateProfile(blackUserId)
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
 * Fetches the top 10 rated players for the leaderboard.
 */
export async function getTopLeaderboard() {
  try {
    const usersRef = ref(db, 'users');
    const topQuery = query(usersRef, orderByChild('elo'), limitToLast(20));
    const snap = await get(topQuery);

    if (!snap.exists()) return [];

    const list = [];
    snap.forEach((child) => {
      const val = child.val();
      if (val && val.gamesPlayed > 0) {
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
