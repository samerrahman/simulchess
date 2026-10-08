import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Swords, 
  Trash2, 
  Check, 
  X, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Inbox,
  UserCheck
} from 'lucide-react';
import { 
  subscribeToFriends, 
  subscribeToFriendRequests, 
  sendFriendRequest, 
  acceptFriendRequest, 
  declineFriendRequest, 
  removeFriend 
} from './friendService';

export default function FriendsPage({ 
  userId, 
  username, 
  onChallengeFriend, 
  onNavigateToPlay,
  onOpenAuth,
  hasChosenName
}) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [targetUsername, setTargetUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const unsubFriends = subscribeToFriends(userId, (list) => {
      setFriends(list);
    });

    const unsubRequests = subscribeToFriendRequests(userId, (reqs) => {
      setRequests(reqs);
    });

    return () => {
      unsubFriends();
      unsubRequests();
    };
  }, [userId]);

  async function handleSendRequest(e) {
    e.preventDefault();
    if (!targetUsername.trim()) return;

    if (!hasChosenName) {
      onOpenAuth('choose_name');
      return;
    }

    setStatusMsg(null);
    setLoading(true);

    try {
      const addedName = await sendFriendRequest(userId, username || 'Player', targetUsername.trim());
      setStatusMsg({
        type: 'success',
        text: `Friend request sent to "${addedName}"!`
      });
      setTargetUsername('');
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to send friend request.'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(req) {
    try {
      await acceptFriendRequest(userId, username || 'Player', req.fromUserId, req.fromUsername);
    } catch (err) {
      console.error("Error accepting request:", err);
    }
  }

  async function handleDecline(req) {
    try {
      await declineFriendRequest(userId, req.fromUserId);
    } catch (err) {
      console.error("Error declining request:", err);
    }
  }

  async function handleRemove(friend) {
    if (window.confirm(`Remove "${friend.username}" from your friends list?`)) {
      try {
        await removeFriend(userId, friend.friendId);
      } catch (err) {
        console.error("Error removing friend:", err);
      }
    }
  }

  const onlineFriends = friends.filter(f => f.isOnline);
  const offlineFriends = friends.filter(f => !f.isOnline);

  return (
    <div className="page-container friends-page">
      <div className="page-header-nav">
        <button className="btn btn-secondary btn-sm" onClick={onNavigateToPlay}>
          <ArrowLeft size={16} />
          <span>Back to Play</span>
        </button>
      </div>

      <div className="friends-page-header">
        <div className="friends-title-group">
          <div className="friends-icon-badge">
            <Users size={28} className="text-accent" />
          </div>
          <div>
            <h1 className="page-title">Friends</h1>
            <p className="page-subtitle">Connect and challenge players directly.</p>
          </div>
        </div>

        <div className="friends-stats-pills">
          <span className="friends-stat-pill">
            <span className="presence-dot presence-online" />
            <span><strong>{onlineFriends.length}</strong> Online</span>
          </span>
          <span className="friends-stat-pill">
            <span><strong>{friends.length}</strong> Total Friends</span>
          </span>
        </div>
      </div>

      <div className="friends-layout-grid">
        {/* Left Column: Friends List */}
        <div className="friends-main-column">
          <div className="friends-list-card">
            <div className="friends-card-header">
              <h3>Your Friends ({friends.length})</h3>
            </div>

            {friends.length === 0 ? (
              <div className="friends-empty-full">
                <Users size={44} className="text-muted" />
                <h4>No Friends Added Yet</h4>
                <p>Add friends by their username using the search box on the right to challenge them to live games!</p>
              </div>
            ) : (
              <div className="friends-full-list">
                {/* Online Friends first */}
                {onlineFriends.map(friend => (
                  <div key={friend.friendId} className="friend-row-card friend-row-online">
                    <div className="friend-row-info">
                      <span 
                        className={`presence-dot ${friend.gameStatus === 'in_game' ? 'presence-ingame' : 'presence-online'}`}
                        title={friend.gameStatus === 'in_game' ? 'In a Match' : 'Online in Lobby'}
                      />
                      <div className="friend-name-col">
                        <div className="friend-title-line">
                          <span className="friend-name-text">{friend.username}</span>
                          {friend.isRegistered && (
                            <span className="badge-registered-tag" title="Verified Account">✓</span>
                          )}
                        </div>
                        <span className="friend-presence-label">
                          {friend.gameStatus === 'in_game' ? (
                            <span className="status-ingame-label">In Game</span>
                          ) : (
                            <span className="status-online-label">Online</span>
                          )}
                          {' • '}
                          <span className="friend-elo-pill-small">{friend.elo} Elo</span>
                        </span>
                      </div>
                    </div>

                    <div className="friend-row-actions">
                      <button 
                        className="btn btn-primary btn-sm btn-challenge-action"
                        onClick={() => onChallengeFriend(friend)}
                      >
                        <Swords size={15} />
                        <span>Challenge</span>
                      </button>
                      <button 
                        className="btn-icon btn-remove-subtle"
                        onClick={() => handleRemove(friend)}
                        title="Remove friend"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Offline Friends */}
                {offlineFriends.map(friend => (
                  <div key={friend.friendId} className="friend-row-card friend-row-offline">
                    <div className="friend-row-info">
                      <span className="presence-dot presence-offline" title="Offline" />
                      <div className="friend-name-col">
                        <div className="friend-title-line">
                          <span className="friend-name-text text-muted">{friend.username}</span>
                          {friend.isRegistered && (
                            <span className="badge-registered-tag" title="Verified Account">✓</span>
                          )}
                        </div>
                        <span className="friend-presence-label">
                          <span className="status-offline-label">Offline</span>
                          {' • '}
                          <span className="friend-elo-pill-small">{friend.elo} Elo</span>
                        </span>
                      </div>
                    </div>

                    <div className="friend-row-actions">
                      <button 
                        className="btn btn-secondary btn-sm"
                        disabled
                        title="Player is currently offline"
                      >
                        Offline
                      </button>
                      <button 
                        className="btn-icon btn-remove-subtle"
                        onClick={() => handleRemove(friend)}
                        title="Remove friend"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Add Friend & Requests */}
        <div className="friends-side-column">
          {/* Add Friend Form */}
          <div className="friends-side-card">
            <div className="side-card-title-row">
              <UserPlus size={18} className="text-amber" />
              <h3>Add Friend</h3>
            </div>
            <p className="side-card-desc">
              Enter a player's exact username to send them a friend request.
            </p>

            {statusMsg && (
              <div className={`alert-box ${statusMsg.type === 'success' ? 'alert-info' : 'alert-error'}`}>
                {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSendRequest} className="add-friend-side-form">
              <input 
                type="text"
                className="input-field"
                placeholder="Enter player username..."
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                maxLength={18}
                disabled={loading}
              />
              <button 
                type="submit" 
                className="btn btn-primary btn-full"
                disabled={loading || !targetUsername.trim()}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Send Friend Request</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Pending Incoming Requests */}
          <div className="friends-side-card">
            <div className="side-card-title-row">
              <Inbox size={18} className="text-emerald" />
              <h3>Incoming Requests ({requests.length})</h3>
            </div>

            {requests.length === 0 ? (
              <div className="requests-empty-block">
                <UserCheck size={28} className="text-muted" />
                <p>No incoming friend requests.</p>
              </div>
            ) : (
              <div className="requests-side-list">
                {requests.map(req => (
                  <div key={req.fromUserId} className="request-side-card">
                    <div className="request-side-info">
                      <span className="request-side-name">{req.fromUsername}</span>
                      <span className="request-side-sub">wants to be friends</span>
                    </div>
                    <div className="request-side-btns">
                      <button 
                        className="btn btn-primary btn-xs"
                        onClick={() => handleAccept(req)}
                        title="Accept"
                      >
                        <Check size={13} />
                        <span>Accept</span>
                      </button>
                      <button 
                        className="btn btn-secondary btn-xs"
                        onClick={() => handleDecline(req)}
                        title="Decline"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
