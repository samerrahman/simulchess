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
  lastMoves = null
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [draggedSquare, setDraggedSquare] = useState(null);
  const [animatedMoves, setAnimatedMoves] = useState([]);

  // Store the last turn number that was animated to prevent re-running animations
  const lastTurnAnimatedRef = useRef(lastMoves?.turn || 0);

  const isWhiteOrientation = orientation === 'white';
  const displayRanks = isWhiteOrientation ? [...RANKS].reverse() : [...RANKS];
  const displayFiles = isWhiteOrientation ? [...FILES] : [...FILES].reverse();

  // Active square is either dragged or selected
  const activeSquare = draggedSquare || selectedSquare;

  // Track animations ONLY when a genuinely NEW turn's lastMoves arrives
  useEffect(() => {
    if (!lastMoves || !lastMoves.moves || lastMoves.moves.length === 0) return;
    if (lastMoves.turn <= lastTurnAnimatedRef.current) return;

    lastTurnAnimatedRef.current = lastMoves.turn;

    // Trigger piece movement animation for 1.2 seconds
    const startTimer = setTimeout(() => {
      setAnimatedMoves(lastMoves.moves);
    }, 0);

    const endTimer = setTimeout(() => {
      setAnimatedMoves([]);
    }, 1200);

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

  // Filter legal destination moves from the active square
  const activeDestinations = useMemo(() => {
    if (!activeSquare) return new Map();
    const map = new Map();
    legalMoves.forEach(m => {
      if (m.from === activeSquare) {
        map.set(m.to, m);
      }
    });
    return map;
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

  // Handle clicking on a square
  function handleSquareClick(square) {
    if (disabled || isLocked || playerColor === 'spectator') return;

    // 1. If we already have an active piece selected and click a valid destination:
    if (activeSquare && activeDestinations.has(square)) {
      const move = activeDestinations.get(square);
      onStageMove(move);
      setSelectedSquare(null);
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

    const matchingMove = legalMoves.find(m => m.from === fromSquare && m.to === targetSquare);
    if (matchingMove) {
      onStageMove(matchingMove);
      setSelectedSquare(null);
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
    <div className="native-chessboard-wrapper">
      <div className="native-chessboard-grid">
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
            const isLegalTarget = activeDestinations.has(square);
            const isTargetEnemy = isLegalTarget && originalPiece && originalPiece.color !== playerColor;
            const hasCollision = collisionSquares.has(square);

            const isMovedFrom = movedFromSquares.has(square);
            const isMovedTo = movedToSquares.has(square);

            const canDrag = !disabled && !isLocked && displayPiece && displayPiece.color === playerColor;

            // Check if this square is the destination of an active animated move
            const anim = animatedMoves.find(m => m.to === square);
            const animPieceType = anim ? anim.piece?.type : null;
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
                {rankIndex === 7 && (
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
                    } ${anim ? `anim-piece anim-${animPieceType || 'default'}` : ''}`}
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
                {isLegalTarget && !isTargetEnemy && (
                  <div className="legal-dot-indicator" />
                )}
                {isTargetEnemy && (
                  <div className="legal-capture-ring" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
