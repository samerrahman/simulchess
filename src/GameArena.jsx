import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Swords, 
  Copy, 
  Check, 
  RotateCcw, 
  ArrowLeft, 
  Lock, 
  Share2, 
  Trophy, 
  Skull, 
  AlertTriangle,
  Undo2
} from 'lucide-react';
import { ref, update } from 'firebase/database';
import { db } from './firebase';
import NativeChessboard from './NativeChessboard';
import { ChessPiece } from './ChessPiece';
import { 
  getLegalMoves, 
  resolveTurn, 
  createInitialGameState, 
  pieceName 
} from './gameLogic';

const EMOJIS = ['👏', '😮', '💀', '🔥', '🤔', '🤝'];

export default function GameArena({ gameState, color, roomId, onLeaveRoom }) {
  const [stagedInfo, setStagedInfo] = useState({ turn: gameState.turnCount || 1, move: null });
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reactionCooldown, setReactionCooldown] = useState(0);
  const [activeReaction, setActiveReaction] = useState(null);

  const isSpectator = color === 'spectator';
  const myColor = color;
  const enemyColor = color === 'w' ? 'b' : 'w';

  const myStatus = !isSpectator && gameState.submitted ? !!gameState.submitted[myColor] : false;
  const enemyStatus = !isSpectator && gameState.submitted ? !!gameState.submitted[enemyColor] : false;

  // Staged move is valid for the current turn count
  const intendedMove = (myStatus && gameState.pendingMoves?.[myColor]) 
    ? gameState.pendingMoves[myColor] 
    : (stagedInfo.turn === (gameState.turnCount || 1) ? stagedInfo.move : null);

  // Anti-spam reaction cooldown timer
  useEffect(() => {
    if (reactionCooldown <= 0) return;
    const timer = setInterval(() => {
      setReactionCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [reactionCooldown]);

  // Listen to emoji reactions from Firebase
  useEffect(() => {
    if (!gameState.reaction?.timestamp) return;
    const reaction = gameState.reaction;
    const age = Date.now() - reaction.timestamp;
    if (age < 3500) {
      const showTimer = setTimeout(() => {
        setActiveReaction(reaction);
      }, 10);
      const hideTimer = setTimeout(() => {
        setActiveReaction(null);
      }, 2500);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [gameState.reaction]);

  // Board orientation
  const orientation = useMemo(() => {
    if (isFlipped) {
      return myColor === 'b' ? 'white' : 'black';
    }
    return myColor === 'b' ? 'black' : 'white';
  }, [isFlipped, myColor]);

  // Compute legal moves for current player
  const legalMoves = useMemo(() => {
    if (isSpectator || !gameState.board || gameState.status !== 'playing' || myStatus) {
      return [];
    }
    return getLegalMoves(
      gameState.board, 
      myColor, 
      gameState.castlingRights, 
      gameState.enPassantTarget
    );
  }, [gameState.board, gameState.status, gameState.castlingRights, gameState.enPassantTarget, myColor, isSpectator, myStatus]);

  // Master turn resolution when both moves are submitted
  useEffect(() => {
    if (gameState.status !== 'playing') return;
    if (!gameState.submitted?.w || !gameState.submitted?.b) return;

    // White resolves turn (or Black fallback if White is not connected)
    const isPrimaryResolver = myColor === 'w' || (myColor === 'b' && !gameState.players?.w);

    if (isPrimaryResolver) {
      const turnResult = resolveTurn(
        gameState.board,
        gameState.pendingMoves?.w,
        gameState.pendingMoves?.b,
        gameState.castlingRights,
        gameState.enPassantTarget
      );

      const mergedCaptured = {
        w: [...(gameState.capturedPieces?.w || []), ...(turnResult.capturedPieces?.w || [])],
        b: [...(gameState.capturedPieces?.b || []), ...(turnResult.capturedPieces?.b || [])]
      };

      let newStatus = 'playing';
      if (turnResult.winner === 'draw') newStatus = 'draw';
      else if (turnResult.winner === 'w') newStatus = 'w_won';
      else if (turnResult.winner === 'b') newStatus = 'b_won';

      const whiteSan = gameState.pendingMoves?.w?.san || 
        (gameState.pendingMoves?.w ? `${gameState.pendingMoves.w.from}➔${gameState.pendingMoves.w.to}` : 'None');
      const blackSan = gameState.pendingMoves?.b?.san || 
        (gameState.pendingMoves?.b ? `${gameState.pendingMoves.b.from}➔${gameState.pendingMoves.b.to}` : 'None');

      const newHistoryEntry = {
        turn: gameState.turnCount || 1,
        whiteMove: whiteSan,
        blackMove: blackSan,
        events: turnResult.events || []
      };

      const timer = setTimeout(() => {
        update(ref(db, `games/${roomId}`), {
          board: turnResult.newBoard,
          castlingRights: turnResult.newCastlingRights,
          enPassantTarget: turnResult.newEnPassantTarget,
          turnCount: (gameState.turnCount || 1) + 1,
          status: newStatus,
          submitted: { w: false, b: false },
          pendingMoves: { w: null, b: null },
          capturedPieces: mergedCaptured,
          lastEvents: turnResult.events || [],
          history: [...(gameState.history || []), newHistoryEntry]
        });
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [
    gameState,
    myColor, 
    roomId
  ]);

  // Immediately lock in move on piece placement
  async function handleMovePiece(move) {
    if (myStatus || gameState.status !== 'playing' || !roomId || isSpectator) return;
    setStagedInfo({ turn: gameState.turnCount || 1, move });
    await update(ref(db, `games/${roomId}`), {
      [`pendingMoves/${myColor}`]: move,
      [`submitted/${myColor}`]: true
    });
  }

  // Cancel / Undo Move before opponent submits
  async function handleUndoMove() {
    if (!myStatus || !roomId || isSpectator || enemyStatus) return;
    setStagedInfo({ turn: gameState.turnCount || 1, move: null });
    await update(ref(db, `games/${roomId}`), {
      [`pendingMoves/${myColor}`]: null,
      [`submitted/${myColor}`]: false
    });
  }

  // Send an emoji reaction
  const handleSendReaction = useCallback(async (emoji) => {
    if (reactionCooldown > 0 || !roomId || isSpectator) return;
    setReactionCooldown(3); // 3 second cooldown
    const ts = Date.now();
    await update(ref(db, `games/${roomId}`), {
      reaction: {
        emoji,
        sender: myColor,
        timestamp: ts
      }
    });
  }, [reactionCooldown, roomId, isSpectator, myColor]);

  // Copy room link
  function handleCopyLink() {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // Copy room code
  function handleCopyCode() {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  // Restart / Rematch
  async function handleRematch() {
    const initial = createInitialGameState();
    await update(ref(db, `games/${roomId}`), {
      board: initial.board,
      castlingRights: initial.castlingRights,
      enPassantTarget: null,
      turnCount: 1,
      status: 'playing',
      submitted: { w: false, b: false },
      pendingMoves: { w: null, b: null },
      capturedPieces: { w: [], b: [] },
      lastEvents: [],
      history: []
    });
    setStagedInfo({ turn: 1, move: null });
  }

  const isGameOver = ['w_won', 'b_won', 'draw'].includes(gameState.status);
  const isWaiting = gameState.status === 'waiting';

  const myCaptured = (gameState.capturedPieces && gameState.capturedPieces[enemyColor]) || [];
  const enemyCaptured = (gameState.capturedPieces && gameState.capturedPieces[myColor]) || [];

  return (
    <div className="game-arena-layout">
      {/* Top Header Bar */}
      <header className="arena-header">
        <div className="header-left">
          <button className="btn-icon" onClick={onLeaveRoom} title="Return to Lobby">
            <ArrowLeft size={18} />
            <span className="hide-mobile">Lobby</span>
          </button>
          <div className="arena-brand">
            <Swords size={20} className="brand-icon" />
            <span className="brand-title">SimulChess</span>
            <span className="turn-pill">Turn #{gameState.turnCount || 1}</span>
          </div>
        </div>

        <div className="header-right">
          <button className="room-code-badge" onClick={handleCopyCode} title="Click to copy room code">
            <span className="code-label">Room:</span>
            <span className="code-text">{roomId}</span>
            {copiedCode ? <Check size={14} className="copied-check" /> : <Copy size={14} />}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleCopyLink} title="Copy shareable link">
            {copiedLink ? <Check size={16} className="copied-check" /> : <Share2 size={16} />}
            <span>{copiedLink ? 'Copied' : 'Invite'}</span>
          </button>

          <button 
            className="btn-icon" 
            onClick={() => setIsFlipped(!isFlipped)} 
            title="Flip Chessboard"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      {/* Main Arena Grid */}
      <main className="arena-main-content">
        {/* Left Column: Board & Player Strips */}
        <section className="board-section">
          {/* Opponent Strip (Top) */}
          <div className={`player-strip opponent-strip ${enemyStatus ? 'player-locked' : ''}`}>
            <div className="player-meta">
              <div className="avatar-wrapper">
                <div className={`player-avatar avatar-${enemyColor}`}>
                  {enemyColor === 'w' ? '♔' : '♚'}
                </div>
                {/* Floating Reaction from Opponent */}
                {activeReaction && activeReaction.sender === enemyColor && (
                  <div className="floating-reaction-badge">
                    {activeReaction.emoji}
                  </div>
                )}
              </div>
              <div className="player-details">
                <span className="player-name">
                  Opponent ({enemyColor === 'w' ? 'White' : 'Black'})
                </span>
                <span className="player-status-text">
                  {isWaiting ? (
                    'Waiting to connect...'
                  ) : enemyStatus ? (
                    <span className="status-locked-tag">
                      <Lock size={12} /> Locked In
                    </span>
                  ) : (
                    <span className="status-thinking-tag">
                      <span className="pulse-dot"></span> Thinking...
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Captured by opponent */}
            <div className="captured-tray">
              {enemyCaptured.map((p, idx) => (
                <span key={idx} className="captured-mini-piece">
                  <ChessPiece type={p.type} color={p.color} />
                </span>
              ))}
            </div>
          </div>

          {/* Interactive Chessboard */}
          <div className="chessboard-center-stage">
            <NativeChessboard
              board={gameState.board || {}}
              playerColor={myColor}
              orientation={orientation}
              legalMoves={legalMoves}
              intendedMove={intendedMove}
              onStageMove={handleMovePiece}
              isLocked={myStatus}
              disabled={gameState.status !== 'playing'}
              lastEvents={gameState.lastEvents || []}
            />
          </div>

          {/* You Strip (Bottom) */}
          <div className={`player-strip self-strip ${myStatus ? 'player-locked' : ''}`}>
            <div className="player-meta">
              <div className="avatar-wrapper">
                <div className={`player-avatar avatar-${myColor}`}>
                  {myColor === 'w' ? '♔' : myColor === 'b' ? '♚' : '👁️'}
                </div>
                {/* Floating Reaction from Self */}
                {activeReaction && activeReaction.sender === myColor && (
                  <div className="floating-reaction-badge">
                    {activeReaction.emoji}
                  </div>
                )}
              </div>
              <div className="player-details">
                <span className="player-name">
                  You ({myColor === 'w' ? 'White' : myColor === 'b' ? 'Black' : 'Spectator'})
                </span>
                <span className="player-status-text">
                  {isSpectator ? (
                    'Spectating match'
                  ) : myStatus ? (
                    <span className="status-locked-tag">
                      <Lock size={12} /> Move Locked In
                    </span>
                  ) : (
                    'Your turn — drag or click a piece'
                  )}
                </span>
              </div>
            </div>

            {/* Captured by you */}
            <div className="captured-tray">
              {myCaptured.map((p, idx) => (
                <span key={idx} className="captured-mini-piece">
                  <ChessPiece type={p.type} color={p.color} />
                </span>
              ))}
            </div>
          </div>

          {/* Reaction Bar & Quick Controls */}
          {!isSpectator && gameState.status === 'playing' && (
            <div className="reactions-bar">
              <span className="reactions-label">React:</span>
              <div className="emoji-list">
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    className="btn-emoji"
                    disabled={reactionCooldown > 0}
                    onClick={() => handleSendReaction(emoji)}
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {reactionCooldown > 0 && (
                <span className="cooldown-pill">{reactionCooldown}s</span>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Actions, Events & Turn History */}
        <section className="side-panel-section">
          {/* Waiting Banner */}
          {isWaiting && (
            <div className="waiting-card">
              <div className="waiting-pulse-icon">
                <Share2 size={28} />
              </div>
              <h3>Waiting for Opponent</h3>
              <p>Share this link or code with a friend to play simultaneously in real time.</p>
              <div className="waiting-copy-box">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}${window.location.pathname}?room=${roomId}`}
                  className="input-field share-input"
                  onClick={(e) => e.target.select()}
                />
                <button className="btn btn-primary" onClick={handleCopyLink}>
                  {copiedLink ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Stable Fixed-Height Action Control Card (No UI shifts) */}
          {gameState.status === 'playing' && !isSpectator && (
            <div className="action-control-card fixed-action-card">
              <div className="action-card-header">
                <span className="action-card-title">Turn #{gameState.turnCount || 1} Status</span>
                {myStatus && !enemyStatus && (
                  <button className="btn btn-secondary btn-xs undo-btn" onClick={handleUndoMove}>
                    <Undo2 size={13} /> Undo Move
                  </button>
                )}
              </div>

              <div className="action-status-content">
                {!myStatus ? (
                  <div className="prompt-status-row">
                    <span className="dot-indicator pulse-blue"></span>
                    <span className="status-label">Your turn: pick a move</span>
                  </div>
                ) : (
                  <div className="prompt-status-row">
                    <span className="dot-indicator pulse-green"></span>
                    <span className="status-label">
                      {enemyStatus
                        ? "Both locked in — resolving turn..."
                        : "Move locked in — waiting for opponent..."}
                    </span>
                  </div>
                )}
                {intendedMove && (
                  <div className="staged-mini-badge">
                    {pieceName(intendedMove.piece)} {intendedMove.from.toUpperCase()} ➔ {intendedMove.to.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Latest Events & Collision Alert */}
          {gameState.lastEvents && gameState.lastEvents.length > 0 && (
            <div className="combat-events-card">
              <h4 className="combat-card-title">Last Turn Results</h4>
              <div className="events-list">
                {gameState.lastEvents.map((evt, idx) => (
                  <div 
                    key={idx} 
                    className={`combat-event-row event-${evt.type}`}
                  >
                    <span className="event-msg">{evt.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Move History Log */}
          <div className="history-card">
            <h4 className="history-card-title">Turn Log</h4>
            <div className="history-scroll">
              {(!gameState.history || gameState.history.length === 0) ? (
                <div className="empty-history">Moves will appear here after each turn.</div>
              ) : (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>White</th>
                      <th>Black</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameState.history.map((entry, idx) => (
                      <tr key={idx}>
                        <td className="hist-turn">{entry.turn}</td>
                        <td className="hist-move">{entry.whiteMove}</td>
                        <td className="hist-move">{entry.blackMove}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="modal-backdrop">
          <div className="game-over-modal">
            <div className="modal-icon-header">
              {gameState.status === 'draw' ? (
                <AlertTriangle size={48} className="modal-icon-draw" />
              ) : (
                (gameState.status === 'w_won' && myColor === 'w') || (gameState.status === 'b_won' && myColor === 'b') ? (
                  <Trophy size={48} className="modal-icon-win" />
                ) : (
                  <Skull size={48} className="modal-icon-lose" />
                )
              )}
            </div>

            <h2 className="modal-title">
              {gameState.status === 'draw'
                ? 'Game Draw!'
                : gameState.status === 'w_won'
                ? 'White Wins!'
                : 'Black Wins!'}
            </h2>

            <p className="modal-subtitle">
              {gameState.status === 'draw'
                ? 'Both Kings fell simultaneously in battle or mutual annihilation occurred!'
                : gameState.status === 'w_won'
                ? 'White captured Black\'s King!'
                : 'Black captured White\'s King!'}
            </p>

            <div className="modal-actions">
              <button className="btn btn-primary btn-lg" onClick={handleRematch}>
                <RotateCcw size={18} /> Rematch
              </button>
              <button className="btn btn-secondary btn-lg" onClick={onLeaveRoom}>
                <ArrowLeft size={18} /> Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
