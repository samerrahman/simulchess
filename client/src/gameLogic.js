import { Chess } from 'chess.js';

// Helper to convert standard starting positions to our simplified board map
export function createInitialBoard() {
  const chess = new Chess();
  const board = {};
  const squares = chess.board();
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = squares[rank][file];
      if (piece) {
        // e.g. a8, b8, etc.
        const squareId = String.fromCharCode('a'.charCodeAt(0) + file) + (8 - rank);
        board[squareId] = piece; // { type: 'r', color: 'b' }
      }
    }
  }
  return board;
}

// Generate legal moves for a given color from the current board state
export function getLegalMoves(board, color) {
  let fen = '';
  for (let rank = 8; rank >= 1; rank--) {
    let emptyCount = 0;
    for (let file = 0; file < 8; file++) {
      const squareId = String.fromCharCode('a'.charCodeAt(0) + file) + rank;
      const piece = board[squareId];
      if (piece) {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        fen += piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) fen += emptyCount;
    if (rank > 1) fen += '/';
  }
  
  // Append turn, castling, en passant, half-move, full-move
  fen += ` ${color} KQkq - 0 1`;
  
  try {
    const chess = new Chess(fen);
    return chess.moves({ verbose: true });
  } catch (e) {
    return [];
  }
}

export function resolveTurn(board, m1, m2) {
  // m1 is White's move, m2 is Black's move.
  const newBoard = { ...board };

  // 1. Remove moving pieces from their origin
  delete newBoard[m1.from];
  delete newBoard[m2.from];

  const m1Piece = m1.promotion ? { type: m1.promotion, color: m1.piece.color } : m1.piece;
  const m2Piece = m2.promotion ? { type: m2.promotion, color: m2.piece.color } : m2.piece;

  const isSquareCollision = m1.to === m2.to;
  const isSwapCollision = (m1.to === m2.from) && (m1.from === m2.to);

  if (isSquareCollision) {
    delete newBoard[m1.to]; 
  } else if (isSwapCollision) {
    // Both pieces destroyed
  } else {
    newBoard[m1.to] = m1Piece;
    newBoard[m2.to] = m2Piece;
  }

  return newBoard;
}

export function checkGameOver(board) {
  let whiteKing = false;
  let blackKing = false;

  for (const sq in board) {
    const p = board[sq];
    if (p.type === 'k') {
      if (p.color === 'w') whiteKing = true;
      if (p.color === 'b') blackKing = true;
    }
  }

  if (!whiteKing && !blackKing) return 'draw';
  if (!whiteKing) return 'b';
  if (!blackKing) return 'w';
  return null;
}
