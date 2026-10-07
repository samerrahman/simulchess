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
  Undo2,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import HowToPlayModal from './HowToPlayModal';
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
import { recordMatchOutcome, calculateEloDelta } from './eloService';

const EMOJIS = ['👏', '😮', '💀', '🔥', '🤔', '🤝'];

export default function GameArena({ 
  gameState, 
  color, 
  roomId, 
  userProfile, 
  onLeaveRoom 
}) {
  const [stagedInfo, setStagedInfo] = useState({ turn: gameState.turnCount || 1, move: null });
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reactionCooldown, setReactionCooldown] = useState(0);
  const [activeReaction, setActiveReaction] = useState(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Elo post-game calculation record
  const [eloResult, setEloResult] = useState(null);

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
    if (gameState.reaction && gameState.reaction.timestamp) {
      const now = Date.now();
      if (now - gameState.reaction.timestamp < 3500) {
        const reactionTimer = setTimeout(() => {
          setActiveReaction(gameState.reaction);
        }, 0);
        const clearTimer = setTimeout(() => {
          setActiveReaction(null);
        }, 3000);
        return () => {
          clearTimeout(reactionTimer);
          clearTimeout(clearTimer);
        };
      }
    }
  }, [gameState.reaction]);

  // Board orientation
  const orientation = useMemo(() => {
    if (isFlipped) return myColor === 'b' ? 'white' : 'black';
    return myColor === 'b' ? 'black' : 'white';
  }, [isFlipped, myColor]);

  // Compute legal moves
  const legalMoves = useMemo(() => {
    if (isSpectator || myStatus || gameState.status !== 'playing') return [];
    return getLegalMoves(
      gameState.board || {},
      myColor,
      gameState.castlingRights,
      gameState.enPassantTarget
    );
  }, [
    isSpectator, 
    myStatus, 
    gameState.status, 
    gameState.board, 
    myColor, 
    gameState.castlingRights, 
    gameState.enPassantTarget
  ]);

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

      const whitePending = gameState.pendingMoves?.w;
      const blackPending = gameState.pendingMoves?.b;

      const lastMovesRecord = {
        turn: gameState.turnCount || 1,
        moves: [
          ...(whitePending ? [{ ...whitePending, color: 'w' }] : []),
          ...(blackPending ? [{ ...blackPending, color: 'b' }] : [])
        ]
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
          lastMoves: lastMovesRecord,
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

  // Handle Game Over Elo Updates (Calculated once and synchronized across both clients)
  useEffect(() => {
    const isFinished = ['w_won', 'b_won', 'draw'].includes(gameState.status);
    if (!isFinished) return;

    // If room already stored the calculated elo results, show them
    if (gameState.eloSummary) {
      const summaryTimer = setTimeout(() => {
        setEloResult(gameState.eloSummary);
      }, 0);
      return () => clearTimeout(summaryTimer);
    }

    // Process once by the primary resolver
    const isPrimaryResolver = myColor === 'w' || (myColor === 'b' && !gameState.players?.w);
    const whiteId = gameState.players?.w;
    const blackId = gameState.players?.b;

    if (isPrimaryResolver && whiteId && blackId && !gameState.eloProcessed) {
      // Mark as processed in room to prevent double-invocations
      update(ref(db, `games/${roomId}`), { eloProcessed: true });

      recordMatchOutcome(whiteId, blackId, gameState.status).then((summary) => {
        if (summary) {
          const wMeta = gameState.playerMeta?.w;
          const bMeta = gameState.playerMeta?.b;
          const fullSummary = {
            ...summary,
            prevWhiteElo: wMeta?.elo || 1200,
            prevBlackElo: bMeta?.elo || 1200
          };
          update(ref(db, `games/${roomId}`), { eloSummary: fullSummary });
          setEloResult(fullSummary);
        }
      });
    } else if (whiteId && blackId && !eloResult) {
      // Spectator or secondary client preview while database syncs
      const outcomeVal = gameState.status === 'w_won' ? 1 : gameState.status === 'b_won' ? 0 : 0.5;
      const wRating = gameState.playerMeta?.w?.elo || 1200;
      const bRating = gameState.playerMeta?.b?.elo || 1200;
      const preview = calculateEloDelta(wRating, bRating, outcomeVal);
      const previewTimer = setTimeout(() => {
        setEloResult({
          ...preview,
          prevWhiteElo: wRating,
          prevBlackElo: bRating
        });
      }, 0);
      return () => clearTimeout(previewTimer);
    }
  }, [gameState.status, gameState.eloSummary, gameState.eloProcessed, gameState.players, gameState.playerMeta, myColor, roomId, eloResult]);

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

  // Rematch mutual agreement logic
  const myRematchOffer = gameState.rematchOffers ? !!gameState.rematchOffers[myColor] : false;
  const enemyRematchOffer = gameState.rematchOffers ? !!gameState.rematchOffers[enemyColor] : false;

  async function handleOfferRematch() {
    if (isSpectator || !roomId) return;

    // If opponent already requested rematch, accepting starts the new game!
    if (enemyRematchOffer) {
      const initial = createInitialGameState();
      const updatedMeta = { ...gameState.playerMeta };
      if (eloResult) {
        if (updatedMeta.w) updatedMeta.w.elo = eloResult.newWhiteElo;
        if (updatedMeta.b) updatedMeta.b.elo = eloResult.newBlackElo;
      }

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
        history: [],
        eloProcessed: false,
        eloSummary: null,
        rematchOffers: { w: false, b: false },
        playerMeta: updatedMeta
      });
      setStagedInfo({ turn: 1, move: null });
      setEloResult(null);
    } else {
      // Otherwise record my offer in Firebase
      await update(ref(db, `games/${roomId}/rematchOffers`), {
        [myColor]: true
      });
    }
  }

  const isGameOver = ['w_won', 'b_won', 'draw'].includes(gameState.status);
  const isWaiting = gameState.status === 'waiting' || !gameState.players?.[enemyColor];

  const myCaptured = (gameState.capturedPieces && gameState.capturedPieces[enemyColor]) || [];
  const enemyCaptured = (gameState.capturedPieces && gameState.capturedPieces[myColor]) || [];

  // Player metadata (display names & Elo)
  const whiteMeta = gameState.playerMeta?.w;
  const blackMeta = gameState.playerMeta?.b;

  const opponentMeta = enemyColor === 'w' ? whiteMeta : blackMeta;
  const selfMeta = myColor === 'w' ? whiteMeta : blackMeta;

  const hasOpponent = !isWaiting && !!gameState.players?.[enemyColor];
  const opponentDisplayName = hasOpponent 
    ? (opponentMeta?.username || (enemyColor === 'w' ? 'White' : 'Black'))
    : 'Waiting for opponent...';
  const opponentElo = hasOpponent ? (opponentMeta?.elo || null) : null;

  const myDisplayName = selfMeta?.username || (userProfile?.username || (myColor === 'w' ? 'White' : 'Black'));
  const myElo = selfMeta?.elo || (userProfile?.elo || 1200);

  // Calculate my Elo change for modal
  const myDelta = eloResult ? (myColor === 'w' ? eloResult.whiteDelta : eloResult.blackDelta) : 0;
  const myNewElo = eloResult ? (myColor === 'w' ? eloResult.newWhiteElo : eloResult.newBlackElo) : myElo;

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
            onClick={() => setShowHowToPlay(true)} 
            title="How to Play"
          >
            <HelpCircle size={18} />
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
                <div className="player-name-line">
                  <span className="player-name">
                    {opponentDisplayName}
                  </span>
                  {opponentElo && (
                    <span className="player-elo-badge">
                      {opponentElo}
                    </span>
                  )}
                </div>
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
              lastMoves={gameState.lastMoves || null}
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
                <div className="player-name-line">
                  <span className="player-name">
                    {isSpectator ? 'You (Spectator)' : myDisplayName}
                  </span>
                  {!isSpectator && (
                    <span className="player-elo-badge">
                      {myElo}
                    </span>
                  )}
                </div>
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
                    title={reactionCooldown > 0 ? 'Wait a moment...' : `Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
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

          {/* Turn Log */}
          <div className="history-card">
            <h4 className="history-card-title">Turn Log</h4>
            <div className="history-scroll">
              {(!gameState.history || gameState.history.length === 0) ? (
                <div className="empty-history">Moves will appear here after each turn.</div>
              ) : (
                <div className="history-list">
                  {gameState.history.map((entry, idx) => (
                    <div key={idx} className="history-row">
                      <div className="history-row-main">
                        <span className="turn-number-tag">#{entry.turn}</span>
                        <div className="moves-pair">
                          <span className="history-move white-move">
                            <span className="mini-icon">♔</span> {entry.whiteMove}
                          </span>
                          <span className="history-move black-move">
                            <span className="mini-icon">♚</span> {entry.blackMove}
                          </span>
                        </div>
                      </div>
                      {entry.events && entry.events.length > 0 && (
                        <div className="events-sublist">
                          {entry.events.map((evt, eIdx) => (
                            <span key={eIdx} className={`event-note event-note-${evt.type}`}>
                              {evt.message}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Game Over Modal with Elo Adjustment Display */}
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
                ? `${whiteMeta?.username || 'White'} Wins!`
                : `${blackMeta?.username || 'Black'} Wins!`}
            </h2>

            <p className="modal-subtitle">
              {gameState.status === 'draw'
                ? 'Both Kings fell simultaneously in battle or mutual annihilation occurred!'
                : gameState.status === 'w_won'
                ? 'White captured Black\'s King!'
                : 'Black captured White\'s King!'}
            </p>

            {/* Elo Rating Delta Card */}
            {!isSpectator && eloResult && (
              <div className="modal-elo-box">
                <span className="elo-change-title">Rating Adjustment</span>
                <div className="elo-change-row">
                  <div className={`elo-delta-pill ${myDelta > 0 ? 'elo-plus' : myDelta < 0 ? 'elo-minus' : 'elo-even'}`}>
                    {myDelta > 0 ? (
                      <>
                        <TrendingUp size={16} /> +{myDelta}
                      </>
                    ) : myDelta < 0 ? (
                      <>
                        <TrendingDown size={16} /> {myDelta}
                      </>
                    ) : (
                      <>
                        <Minus size={16} /> 0
                      </>
                    )}
                  </div>
                  <div className="elo-calc-text">
                    New Rating: <strong>{myNewElo}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button 
                className={`btn btn-lg ${myRematchOffer ? 'btn-secondary' : 'btn-primary'}`} 
                onClick={handleOfferRematch}
                disabled={myRematchOffer}
              >
                <RotateCcw size={18} />
                <span>
                  {myRematchOffer
                    ? "Rematch Offered (Waiting for Opponent...)"
                    : enemyRematchOffer
                    ? "Accept Rematch!"
                    : "Offer Rematch"}
                </span>
              </button>
              <button className="btn btn-secondary btn-lg" onClick={onLeaveRoom}>
                <ArrowLeft size={18} /> Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      <HowToPlayModal 
        isOpen={showHowToPlay} 
        onClose={() => setShowHowToPlay(false)} 
      />
    </div>
  );
}
