import React, { useState, useMemo, useEffect } from 'react';
import { 
  Swords, 
  Copy, 
  Check, 
  RotateCcw, 
  ArrowLeft, 
  Zap, 
  Lock, 
  Unlock, 
  Share2, 
  Trophy, 
  Skull, 
  AlertTriangle 
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

export default function GameArena({ gameState, color, roomId, onLeaveRoom }) {
  const [stagedInfo, setStagedInfo] = useState({ turn: gameState.turnCount || 1, move: null });
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const isSpectator = color === 'spectator';
  const myColor = color;
  const enemyColor = color === 'w' ? 'b' : 'w';

  const myStatus = !isSpectator && gameState.submitted ? !!gameState.submitted[myColor] : false;
  const enemyStatus = !isSpectator && gameState.submitted ? !!gameState.submitted[enemyColor] : false;

  // Staged move is valid for the current turn count
  const intendedMove = (stagedInfo.turn === (gameState.turnCount || 1)) ? stagedInfo.move : null;

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

  // Stage a move from the board
  function handleStageMove(move) {
    if (myStatus || gameState.status !== 'playing') return;
    setStagedInfo({ turn: gameState.turnCount || 1, move });
  }

  function handleClearMove() {
    setStagedInfo({ turn: gameState.turnCount || 1, move: null });
  }

  // Lock In Move
  async function handleLockInMove() {
    if (!intendedMove || myStatus || !roomId || isSpectator) return;
    await update(ref(db, `games/${roomId}`), {
      [`pendingMoves/${myColor}`]: intendedMove,
      [`submitted/${myColor}`]: true
    });
  }

  // Cancel / Change Move
  async function handleChangeMove() {
    if (!myStatus || !roomId || isSpectator) return;
    // Only allow changing if other player hasn't locked in yet or turn not resolved
    await update(ref(db, `games/${roomId}`), {
      [`pendingMoves/${myColor}`]: null,
      [`submitted/${myColor}`]: false
    });
  }

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

  // Status message calculation
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
            <span>{copiedLink ? 'Copied Link!' : 'Invite Friend'}</span>
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
              <div className={`player-avatar avatar-${enemyColor}`}>
                {enemyColor === 'w' ? '♔' : '♚'}
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
                      <Lock size={12} /> Move Locked In
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
              onStageMove={handleStageMove}
              isLocked={myStatus}
              disabled={gameState.status !== 'playing'}
              lastEvents={gameState.lastEvents || []}
            />
          </div>

          {/* You Strip (Bottom) */}
          <div className={`player-strip self-strip ${myStatus ? 'player-locked' : ''}`}>
            <div className="player-meta">
              <div className={`player-avatar avatar-${myColor}`}>
                {myColor === 'w' ? '♔' : myColor === 'b' ? '♚' : '👁️'}
              </div>
              <div className="player-details">
                <span className="player-name">
                  You ({myColor === 'w' ? 'White' : myColor === 'b' ? 'Black' : 'Spectator'})
                </span>
                <span className="player-status-text">
                  {isSpectator ? (
                    'Spectating live match'
                  ) : myStatus ? (
                    <span className="status-locked-tag">
                      <Lock size={12} /> Move Locked In
                    </span>
                  ) : intendedMove ? (
                    <span className="status-staged-tag">
                      <Zap size={12} /> Ready to lock in
                    </span>
                  ) : (
                    'Your turn - pick a move'
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
              <p>Share this link or room code with a friend to play simultaneously online in real time!</p>
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

          {/* Turn Action Controls (When Playing) */}
          {gameState.status === 'playing' && !isSpectator && (
            <div className="action-control-card">
              <h3 className="action-card-title">Turn #{gameState.turnCount || 1} Controls</h3>
              
              {!myStatus ? (
                <div className="stage-actions-box">
                  {intendedMove ? (
                    <div className="staged-details">
                      <div className="staged-preview-info">
                        <span className="staged-label">Planned Move:</span>
                        <span className="staged-move-text">
                          {pieceName(intendedMove.piece)} {intendedMove.from.toUpperCase()} ➔ {intendedMove.to.toUpperCase()}
                          {intendedMove.promotion ? ` (${intendedMove.promotion.toUpperCase()})` : ''}
                        </span>
                      </div>
                      <div className="staged-buttons">
                        <button className="btn btn-lock-in" onClick={handleLockInMove}>
                          <Zap size={18} /> Lock In Move
                        </button>
                        <button className="btn btn-secondary" onClick={handleClearMove}>
                          Clear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="no-move-prompt">
                      <p>Click or drag one of your pieces to preview your simultaneous move.</p>
                      <span className="prompt-hint">Both players move at the exact same second!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="locked-in-box">
                  <div className="locked-in-header">
                    <Lock size={20} className="lock-icon-pulse" />
                    <div>
                      <h4>Move Locked In!</h4>
                      <p className="locked-sub">
                        {enemyStatus 
                          ? 'Both players locked in! Resolving simultaneous turn...' 
                          : 'Waiting for opponent to lock in their move...'}
                      </p>
                    </div>
                  </div>

                  {!enemyStatus && (
                    <button className="btn btn-secondary btn-sm change-move-btn" onClick={handleChangeMove}>
                      <Unlock size={14} /> Change Move
                    </button>
                  )}
                </div>
              )}
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
