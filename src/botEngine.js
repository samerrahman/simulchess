import { getLegalMoves, sqToFileRank } from './gameLogic.js';

const PIECE_VALUES = {
  p: 10,
  n: 32,
  b: 33,
  r: 50,
  q: 90,
  k: 1000
};

/**
 * Computes a smart move for the computer bot in simultaneous chess.
 * Evaluates captures, central board positioning, piece safety, and slight randomness.
 */
export function getBotMove(board, botColor = 'b', castlingRights = null, enPassantTarget = null, variant = 'standard') {
  const legalMoves = getLegalMoves(board, botColor, castlingRights, enPassantTarget, variant);
  if (!legalMoves || legalMoves.length === 0) return null;

  const opponentColor = botColor === 'w' ? 'b' : 'w';
  const boardSize = variant === 'skirmish' ? 6 : 8;
  const centerCoord = (boardSize - 1) / 2;

  let bestMove = legalMoves[0];
  let bestScore = -Infinity;

  for (const move of legalMoves) {
    let score = 0;

    // 1. Capture evaluation
    const targetPiece = board[move.to];
    if (targetPiece && targetPiece.color === opponentColor) {
      const capturedVal = PIECE_VALUES[targetPiece.type] || 10;
      const myVal = PIECE_VALUES[move.piece?.type] || 10;
      // High value for capturing opponent pieces
      score += capturedVal * 2 - myVal * 0.5;
    }

    // 2. Promotion bonus
    if (move.promotion) {
      score += 80;
    }

    // 3. Central square control
    const { f, r } = sqToFileRank(move.to);
    const fileDist = Math.abs(f - centerCoord);
    const rankDist = Math.abs(r - centerCoord);
    const centerDist = fileDist + rankDist;
    score += Math.max(0, 4 - centerDist) * 1.5;

    // 4. Minor piece development in early game
    if (move.piece?.type === 'n' || move.piece?.type === 'b') {
      score += 2;
    }

    // 5. King caution: don't charge King forward unless end of game
    if (move.piece?.type === 'k') {
      score -= 3;
    }

    // 6. Natural unpredictability jitter
    score += (Math.random() * 4 - 2);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
