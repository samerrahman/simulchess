import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChessPiece } from './ChessPiece';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

export default function NativeChessboard({
  board,
  playerColor, // 'w' | 'b' | 'spectator'
  orientation = 'white', // 'white' | 'black'
  legalMoves = [],
  intendedMove = null,
  onStageMove,
  isLocked = false,
  disabled = false,
  lastEvents = [],
  lastMoves = null,
  variant = 'standard'
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [draggedSquare, setDraggedSquare] = useState(null);
  const [animatedMoves, setAnimatedMoves] = useState([]);
  const [pendingPromotion, setPendingPromotion] = useState(null);

  // Store the last turn number that was animated to prevent re-running animations
  const lastTurnAnimatedRef = useRef(lastMoves?.turn || 0);

  const boardSize = variant === 'skirmish' ? 6 : 8;
  const activeFiles = useMemo(() => FILES.slice(0, boardSize), [boardSize]);
  const activeRanks = useMemo(() => RANKS.slice(0, boardSize), [boardSize]);

  const isWhiteOrientation = orientation === 'white';
  const displayRanks = isWhiteOrientation ? [...activeRanks].reverse() : [...activeRanks];
  const displayFiles = isWhiteOrientation ? [...activeFiles] : [...activeFiles].reverse();

  // Active square is either dragged or selected
  const activeSquare = draggedSquare || selectedSquare;

  // Track animations ONLY when a genuinely NEW turn's lastMoves arrives
  useEffect(() => {
    if (!lastMoves || !lastMoves.moves || lastMoves.moves.length === 0) return;
    if (lastMoves.turn <= lastTurnAnimatedRef.current) return;

    lastTurnAnimatedRef.current = lastMoves.turn;

    // Trigger clean LERP glide animation for 300ms
    const startTimer = setTimeout(() => {
      setAnimatedMoves(lastMoves.moves);
    }, 0);

    const endTimer = setTimeout(() => {
      setAnimatedMoves([]);
    }, 300);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(endTimer);
    };
  }, [lastMoves]);

  // Sets of squares involved in recent moves for persistent path highlighting
  const movedFromSquares = useMemo(() => {
    if (!lastMoves || !lastMoves.moves) return new Set();
    return new Set(lastMoves.moves.map(m => m.from));
  }, [lastMoves]);

  const movedToSquares = useMemo(() => {
    if (!lastMoves || !lastMoves.moves) return new Set();
    return new Set(lastMoves.moves.map(m => m.to));
  }, [lastMoves]);

  // Set of legal target squares from activeSquare
  const legalTargetSquares = useMemo(() => {
    if (!activeSquare) return new Set();
    const set = new Set();
    legalMoves.forEach(m => {
      if (m.from === activeSquare) {
        set.add(m.to);
      }
    });
    return set;
  }, [activeSquare, legalMoves]);

  // Collision squares from last turn to show highlights
  const collisionSquares = useMemo(() => {
    const set = new Set();
    lastEvents.forEach(evt => {
      if (evt.type === 'collision') {
        if (evt.square) set.add(evt.square);
        if (evt.squares) evt.squares.forEach(sq => set.add(sq));
      }
    });
    return set;
  }, [lastEvents]);

  // Stage or trigger promotion dialog for a move from -> to
  function attemptMove(fromSquare, targetSquare) {
    const matchingMoves = legalMoves.filter(m => m.from === fromSquare && m.to === targetSquare);
    if (matchingMoves.length === 0) return;

    const promoMoves = matchingMoves.filter(m => Boolean(m.promotion));
    if (promoMoves.length > 0) {
      setPendingPromotion({
        from: fromSquare,
        to: targetSquare,
        color: playerColor,
        moves: promoMoves,
        piece: matchingMoves[0].piece
      });
      setSelectedSquare(null);
      setDraggedSquare(null);
      return;
    }

    onStageMove(matchingMoves[0]);
    setSelectedSquare(null);
    setDraggedSquare(null);
  }

  // Handle clicking on a square
  function handleSquareClick(square) {
    if (disabled || isLocked || playerColor === 'spectator') return;

    // 1. If we already have an active piece selected and click a valid destination:
    if (activeSquare && legalTargetSquares.has(square)) {
      attemptMove(activeSquare, square);
      return;
    }

    // 2. Check if clicking a friendly piece
    const piece = board[square];
    if (piece && piece.color === playerColor) {
      if (selectedSquare === square) {
        setSelectedSquare(null); // Toggle deselect
      } else {
        setSelectedSquare(square); // Select new piece
      }
      return;
    }

    // 3. Clicked empty square or opponent square that is not a legal move
    setSelectedSquare(null);
  }

  // Handle HTML5 Drag and Drop Start
  function handleDragStart(e, square, piece) {
    if (disabled || isLocked || playerColor === 'spectator') {
      e.preventDefault();
      return;
    }
    if (!piece || piece.color !== playerColor) {
      e.preventDefault();
      return;
    }

    setDraggedSquare(square);
    setSelectedSquare(square);
    e.dataTransfer.setData('text/plain', square);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  // Handle Drop on Target Square
  function handleDrop(e, targetSquare) {
    e.preventDefault();
    const fromSquare = e.dataTransfer.getData('text/plain') || draggedSquare;
    setDraggedSquare(null);

    if (!fromSquare || fromSquare === targetSquare) return;

    if (legalTargetSquares.has(targetSquare)) {
      attemptMove(fromSquare, targetSquare);
    }
  }

  // Helper to compute translation vector (percentage of square width/height)
  function getMoveOffset(fromSq, toSq) {
    if (!fromSq || !toSq) return { dx: 0, dy: 0 };
    const fromFile = fromSq.charCodeAt(0) - 97;
    const fromRank = parseInt(fromSq[1], 10) - 1;
    const toFile = toSq.charCodeAt(0) - 97;
    const toRank = parseInt(toSq[1], 10) - 1;

    let dFile = toFile - fromFile;
    let dRank = toRank - fromRank;

    // Adjust for board view orientation
    if (orientation === 'black') {
      dFile = -dFile;
      dRank = -dRank;
    }

    // dx: positive is right, dy: positive is down (rank increases upward, so dy = -dRank)
    return {
      dx: dFile * 100,
      dy: -dRank * 100
    };
  }

  return (
    <div className={`native-chessboard-wrapper ${variant === 'skirmish' ? 'variant-skirmish' : ''}`}>
      <div 
        className="native-chessboard-grid"
        style={{
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          gridTemplateRows: `repeat(${boardSize}, 1fr)`
        }}
      >
        {displayRanks.map((rank, rankIndex) =>
          displayFiles.map((file, fileIndex) => {
            const square = `${file}${rank}`;
            const fileNum = FILES.indexOf(file);
            const rankNum = parseInt(rank, 10) - 1;
            const isLight = (fileNum + rankNum) % 2 !== 0;

            const originalPiece = board[square];

            // Staged intended move adjustments
            let displayPiece = originalPiece;
            const isOriginOfIntended = intendedMove && intendedMove.from === square;
            const isDestOfIntended = intendedMove && intendedMove.to === square;

            if (isOriginOfIntended) {
              displayPiece = null; // Piece vacated origin in preview
            } else if (isDestOfIntended) {
              displayPiece = intendedMove.promotion
                ? { type: intendedMove.promotion, color: intendedMove.piece.color }
                : intendedMove.piece;
            }

            const isSelected = selectedSquare === square;
            const isLegalTarget = legalTargetSquares.has(square);
            const isTargetEnemy = isLegalTarget && originalPiece && originalPiece.color !== playerColor;
            const isTargetDefend = isLegalTarget && originalPiece && originalPiece.color === playerColor;
            const hasCollision = collisionSquares.has(square);

            const isMovedFrom = movedFromSquares.has(square);
            const isMovedTo = movedToSquares.has(square);

            const canDrag = !disabled && !isLocked && displayPiece && displayPiece.color === playerColor;

            // Check if this square is the destination of an active animated move
            const anim = animatedMoves.find(m => m.to === square);
            const offset = anim ? getMoveOffset(anim.from, anim.to) : null;

            return (
              <div
                key={square}
                className={`board-square ${isLight ? 'square-light' : 'square-dark'} ${
                  isSelected ? 'square-selected' : ''
                } ${isOriginOfIntended ? 'square-origin-staged' : ''} ${
                  isDestOfIntended ? 'square-dest-staged' : ''
                } ${isMovedFrom ? 'square-moved-from' : ''} ${
                  isMovedTo ? 'square-moved-to' : ''
                } ${hasCollision ? 'square-collision-highlight' : ''}`}
                onClick={() => handleSquareClick(square)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, square)}
              >
                {/* Coordinates */}
                {fileIndex === 0 && (
                  <span className="coord-rank">{rank}</span>
                )}
                {rankIndex === (boardSize - 1) && (
                  <span className="coord-file">{file}</span>
                )}

                {/* Move Step & Trail Highlights */}
                {isMovedFrom && (
                  <div className="square-path-marker from-marker" title="Departed square" />
                )}
                {isMovedTo && (
                  <div className="square-path-marker to-marker" title="Arrived square" />
                )}

                {/* Piece Rendering */}
                {displayPiece && (
                  <div
                    className={`piece-container ${canDrag ? 'piece-draggable' : ''} ${
                      isDestOfIntended ? 'piece-staged-preview' : ''
                    } ${anim ? 'anim-piece' : ''}`}
                    style={
                      anim && offset
                        ? {
                            '--start-x': `${-offset.dx}%`,
                            '--start-y': `${-offset.dy}%`
                          }
                        : undefined
                    }
                    draggable={canDrag}
                    onDragStart={(e) => handleDragStart(e, square, displayPiece)}
                    onDragEnd={() => setDraggedSquare(null)}
                  >
                    <ChessPiece type={displayPiece.type} color={displayPiece.color} />
                  </div>
                )}

                {/* Staged Move Origin Indicator */}
                {isOriginOfIntended && (
                  <div className="staged-origin-ghost">
                    <ChessPiece
                      type={intendedMove.piece.type}
                      color={intendedMove.piece.color}
                      className="ghost-svg"
                    />
                  </div>
                )}

                {/* Legal Move Indicators */}
                {isLegalTarget && !isTargetEnemy && !isTargetDefend && (
                  <div className="legal-dot-indicator" />
                )}
                {isTargetEnemy && (
                  <div className="legal-capture-ring" />
                )}
                {isTargetDefend && (
                  <div className="legal-defend-ring" title="Defend / Counter-Ambush square" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Pawn Promotion Selector Modal */}
      {pendingPromotion && (
        <div 
          className="promotion-overlay" 
          onClick={() => setPendingPromotion(null)}
        >
          <div 
            className="promotion-dialog" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="promotion-title">Promote Pawn</div>
            <div className="promotion-subtitle">
              Pawn to {pendingPromotion.to.toUpperCase()}
            </div>
            <div className="promotion-pieces-grid">
              {['q', 'r', 'b', 'n'].map((type) => {
                const promoMove = pendingPromotion.moves.find(m => m.promotion === type);
                if (!promoMove) return null;
                const pieceName = type === 'q' ? 'Queen' : type === 'r' ? 'Rook' : type === 'b' ? 'Bishop' : 'Knight';
                return (
                  <button
                    key={type}
                    type="button"
                    className="promotion-piece-card"
                    onClick={() => {
                      onStageMove(promoMove);
                      setPendingPromotion(null);
                    }}
                    title={`Promote to ${pieceName}`}
                  >
                    <div className="promotion-piece-preview">
                      <ChessPiece type={type} color={pendingPromotion.color} />
                    </div>
                    <span className="promotion-piece-label">{pieceName}</span>
                  </button>
                );
              })}
            </div>
            <button 
              type="button"
              className="btn btn-secondary btn-sm promotion-cancel-btn" 
              onClick={() => setPendingPromotion(null)}
            >
              Cancel Move
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
