import { 
  ref, 
  get, 
  set, 
  remove, 
  onValue, 
  onDisconnect 
} from 'firebase/database';
import { db } from './firebase';
import { normalizeUsername } from './eloService';

/**
 * Sets up real-time presence for the player using Firebase .info/connected.
 */
export function setupUserPresence(userId) {
  if (!userId) return () => {};

  const connectedRef = ref(db, '.info/connected');
  const userStatusRef = ref(db, `users/${userId}/status`);

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      // Set to online on connect
      set(userStatusRef, {
        state: 'online',
        lastChanged: Date.now()
      });

      // Set to offline automatically on disconnect
      onDisconnect(userStatusRef).set({
        state: 'offline',
        lastChanged: Date.now()
      });
    }
  });

  return () => {
    unsub();
    set(userStatusRef, {
      state: 'offline',
      lastChanged: Date.now()
    }).catch(() => {});
  };
}

/**
 * Updates player game status (e.g., 'in_game' or 'in_lobby').
 */
export async function setUserGameStatus(userId, gameStatus) {
  if (!userId) return;
  try {
    const statusRef = ref(db, `users/${userId}/status/gameStatus`);
    await set(statusRef, gameStatus);
  } catch (err) {
    console.warn("Failed to update user game status:", err);
  }
}

/**
 * Sends a friend request to a target username.
 */
export async function sendFriendRequest(myUserId, myUsername, targetRawUsername) {
  const cleanTarget = normalizeUsername(targetRawUsername);
  if (!cleanTarget || cleanTarget.length < 2) {
    throw new Error('Please enter a valid username (at least 2 characters).');
  }

  // 1. Look up target user in usernames registry
  const userSnap = await get(ref(db, `usernames/${cleanTarget}`));
  if (!userSnap.exists()) {
    throw new Error(`User "${targetRawUsername}" not found. Make sure they have chosen a username.`);
  }

  const targetData = userSnap.val();
  const targetUid = targetData.uid;

  if (targetUid === myUserId) {
    throw new Error("You cannot add yourself as a friend.");
  }

  // 2. Check if already friends
  const alreadyFriendSnap = await get(ref(db, `friends/${myUserId}/${targetUid}`));
  if (alreadyFriendSnap.exists()) {
    throw new Error(`You and "${targetData.username}" are already friends!`);
  }

  // 3. Record pending friend request
  await set(ref(db, `friendRequests/${targetUid}/${myUserId}`), {
    fromUserId: myUserId,
    fromUsername: myUsername || 'Player',
    timestamp: Date.now()
  });

  return targetData.username;
}

/**
 * Accepts a pending friend request.
 */
export async function acceptFriendRequest(myUserId, myUsername, requesterUserId, requesterUsername) {
  const now = Date.now();

  // Symmetrically write friend relationships
  await Promise.all([
    set(ref(db, `friends/${myUserId}/${requesterUserId}`), {
      friendId: requesterUserId,
      username: requesterUsername,
      addedAt: now
    }),
    set(ref(db, `friends/${requesterUserId}/${myUserId}`), {
      friendId: myUserId,
      username: myUsername,
      addedAt: now
    }),
    remove(ref(db, `friendRequests/${myUserId}/${requesterUserId}`))
  ]);
}

/**
 * Declines a pending friend request.
 */
export async function declineFriendRequest(myUserId, requesterUserId) {
  await remove(ref(db, `friendRequests/${myUserId}/${requesterUserId}`));
}

/**
 * Removes a friend.
 */
export async function removeFriend(myUserId, friendUserId) {
  await Promise.all([
    remove(ref(db, `friends/${myUserId}/${friendUserId}`)),
    remove(ref(db, `friends/${friendUserId}/${myUserId}`))
  ]);
}

/**
 * Subscribes to the player's friends list with real-time updates on each friend's presence & rating.
 */
export function subscribeToFriends(userId, onUpdate) {
  if (!userId) return () => {};

  const friendsRef = ref(db, `friends/${userId}`);
  const userUnsubs = new Map();

  const unsubFriends = onValue(friendsRef, (snap) => {
    const friendsObj = snap.val() || {};
    const friendIds = Object.keys(friendsObj);

    if (friendIds.length === 0) {
      // Clear any individual listeners
      userUnsubs.forEach(u => u());
      userUnsubs.clear();
      onUpdate([]);
      return;
    }

    const friendsData = new Map();

    // Clean up listeners for removed friends
    for (const [id, unsub] of userUnsubs.entries()) {
      if (!friendIds.includes(id)) {
        unsub();
        userUnsubs.delete(id);
      }
    }

    // Attach listeners for each friend's user node to get live presence and elo
    friendIds.forEach((friendId) => {
      if (!userUnsubs.has(friendId)) {
        const friendUserRef = ref(db, `users/${friendId}`);
        const unsubUser = onValue(friendUserRef, (uSnap) => {
          const uVal = uSnap.val() || {};
          const status = uVal.status || {};
          const isOnline = status.state === 'online';
          const gameStatus = status.gameStatus || 'in_lobby';

          friendsData.set(friendId, {
            friendId,
            username: uVal.username || friendsObj[friendId]?.username || 'Player',
            elo: Number(uVal.elo) || 1200,
            wins: Number(uVal.wins) || 0,
            losses: Number(uVal.losses) || 0,
            isOnline,
            gameStatus: isOnline ? gameStatus : 'offline',
            isRegistered: Boolean(uVal.isRegistered)
          });

          // Emit updated list
          onUpdate(Array.from(friendsData.values()));
        });
        userUnsubs.set(friendId, unsubUser);
      }
    });
  });

  return () => {
    unsubFriends();
    userUnsubs.forEach(u => u());
    userUnsubs.clear();
  };
}

/**
 * Subscribes to incoming friend requests.
 */
export function subscribeToFriendRequests(userId, onUpdate) {
  if (!userId) return () => {};

  const requestsRef = ref(db, `friendRequests/${userId}`);
  return onValue(requestsRef, (snap) => {
    const data = snap.val() || {};
    const list = Object.entries(data).map(([fromUserId, val]) => ({
      fromUserId,
      fromUsername: val.fromUsername || 'Player',
      timestamp: val.timestamp || Date.now()
    }));
    onUpdate(list);
  });
}

/**
 * Sends a live challenge to a friend.
 */
export async function sendChallenge(fromUserId, fromUsername, fromElo, toUserId, roomId) {
  const challengeId = `chal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const challengeRef = ref(db, `challenges/${toUserId}/${challengeId}`);

  const challengeData = {
    challengeId,
    fromUserId,
    fromUsername: fromUsername || 'Player',
    fromElo: fromElo || 1200,
    roomId,
    status: 'pending',
    timestamp: Date.now()
  };

  await set(challengeRef, challengeData);
  onDisconnect(challengeRef).remove();

  return challengeId;
}

/**
 * Accepts or declines an incoming match challenge.
 */
export async function respondToChallenge(myUserId, challengeId, accept) {
  const challengeRef = ref(db, `challenges/${myUserId}/${challengeId}`);
  if (!accept) {
    await remove(challengeRef);
  } else {
    await set(ref(db, `challenges/${myUserId}/${challengeId}/status`), 'accepted');
  }
}

/**
 * Subscribes to incoming live match challenges.
 */
export function subscribeToIncomingChallenges(userId, onChallenge) {
  if (!userId) return () => {};

  const challengesRef = ref(db, `challenges/${userId}`);
  return onValue(challengesRef, (snap) => {
    const data = snap.val() || {};
    const pending = Object.values(data).find(c => c.status === 'pending');
    onChallenge(pending || null);
  });
}
