import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  UserCheck, 
  X, 
  Swords, 
  Loader2, 
  AlertCircle, 
  Check, 
  Trash2, 
  Sparkles,
  Inbox
} from 'lucide-react';
import { 
  subscribeToFriends, 
  subscribeToFriendRequests, 
  sendFriendRequest, 
  acceptFriendRequest, 
  declineFriendRequest, 
  removeFriend 
} from './friendService';

export default function FriendsModal({ 
  isOpen, 
  onClose, 
  userId, 
  username, 
  onChallengeFriend 
}) {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'add' | 'requests'
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [targetUsername, setTargetUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success' | 'error', text: '' }

  // Subscribe to friends & friend requests in real-time
  useEffect(() => {
    if (!isOpen || !userId) return;

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
  }, [isOpen, userId]);

  if (!isOpen) return null;

  async function handleSendRequest(e) {
    e.preventDefault();
    if (!targetUsername.trim()) return;

    setStatusMsg(null);
    setLoading(true);

    try {
      const addedName = await sendFriendRequest(userId, username, targetUsername.trim());
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
      await acceptFriendRequest(userId, username, req.fromUserId, req.fromUsername);
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

  const onlineFriendsCount = friends.filter(f => f.isOnline).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container friends-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Users size={22} className="text-accent" />
            <h2 className="modal-title">Friends</h2>
          </div>
          <button className="btn-icon modal-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="friends-nav-tabs">
          <button 
            className={`friends-nav-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => { setActiveTab('friends'); setStatusMsg(null); }}
          >
            <span>Friends</span>
            {friends.length > 0 && (
              <span className="friends-count-pill">{onlineFriendsCount}/{friends.length}</span>
            )}
          </button>

          <button 
            className={`friends-nav-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => { setActiveTab('add'); setStatusMsg(null); }}
          >
            <UserPlus size={15} />
            <span>Add Friend</span>
          </button>

          <button 
            className={`friends-nav-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => { setActiveTab('requests'); setStatusMsg(null); }}
          >
            <Inbox size={15} />
            <span>Requests</span>
            {requests.length > 0 && (
              <span className="requests-badge">{requests.length}</span>
            )}
          </button>
        </div>

        <div className="modal-body friends-modal-body">
          {/* TAB 1: FRIENDS LIST */}
          {activeTab === 'friends' && (
            <div className="friends-list-view">
              {friends.length === 0 ? (
                <div className="friends-empty-state">
                  <Users size={32} className="text-muted" />
                  <p>You haven't added any friends yet.</p>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('add')}
                  >
                    <UserPlus size={14} />
                    <span>Add your first friend</span>
                  </button>
                </div>
              ) : (
                <div className="friends-items-list">
                  {friends.map((friend) => (
                    <div key={friend.friendId} className="friend-card">
                      <div className="friend-info">
                        <div className="friend-presence-wrapper">
                          <span 
                            className={`presence-dot ${
                              friend.isOnline 
                                ? friend.gameStatus === 'in_game' 
                                  ? 'presence-ingame' 
                                  : 'presence-online' 
                                : 'presence-offline'
                            }`} 
                            title={
                              friend.isOnline 
                                ? friend.gameStatus === 'in_game' 
                                  ? 'In a Match' 
                                  : 'Online in Lobby' 
                                : 'Offline'
                            }
                          />
                        </div>
                        <div className="friend-text-block">
                          <div className="friend-name-row">
                            <span className="friend-name">{friend.username}</span>
                            {friend.isRegistered && (
                              <span className="badge-registered-tag" title="Verified registered account">✓</span>
                            )}
                          </div>
                          <span className="friend-status-text">
                            {friend.isOnline ? (
                              friend.gameStatus === 'in_game' ? (
                                <span className="status-ingame-label">In Game</span>
                              ) : (
                                <span className="status-online-label">Online</span>
                              )
                            ) : (
                              <span className="status-offline-label">Offline</span>
                            )}
                            {' • '}
                            <span className="friend-elo-label">{friend.elo} Elo</span>
                          </span>
                        </div>
                      </div>

                      <div className="friend-actions">
                        <button 
                          className="btn btn-primary btn-xs btn-challenge"
                          onClick={() => {
                            if (onChallengeFriend) {
                              onChallengeFriend(friend);
                              onClose();
                            }
                          }}
                          disabled={!friend.isOnline}
                          title={friend.isOnline ? "Challenge friend to a match" : "Friend is currently offline"}
                        >
                          <Swords size={13} />
                          <span>Challenge</span>
                        </button>
                        <button 
                          className="btn-icon btn-remove-friend"
                          onClick={() => handleRemove(friend)}
                          title="Remove friend"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD FRIEND */}
          {activeTab === 'add' && (
            <div className="add-friend-view">
              <form onSubmit={handleSendRequest} className="add-friend-form">
                <p className="add-friend-hint">
                  Enter a player's exact username to send them a friend request.
                </p>

                {statusMsg && (
                  <div className={`alert-box ${statusMsg.type === 'success' ? 'alert-info' : 'alert-error'}`}>
                    {statusMsg.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                    <span>{statusMsg.text}</span>
                  </div>
                )}

                <div className="auth-input-group">
                  <label className="auth-label">Player Username</label>
                  <input 
                    type="text" 
                    required 
                    autoFocus
                    className="input-field" 
                    placeholder="Username" 
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                    disabled={loading}
                    maxLength={18}
                  />
                </div>

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
          )}

          {/* TAB 3: REQUESTS */}
          {activeTab === 'requests' && (
            <div className="friend-requests-view">
              {requests.length === 0 ? (
                <div className="friends-empty-state">
                  <UserCheck size={32} className="text-muted" />
                  <p>No incoming friend requests.</p>
                </div>
              ) : (
                <div className="requests-items-list">
                  {requests.map((req) => (
                    <div key={req.fromUserId} className="request-card">
                      <div className="request-info">
                        <span className="request-from-name">{req.fromUsername}</span>
                        <span className="request-time-text">wants to be friends</span>
                      </div>
                      <div className="request-actions">
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
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
