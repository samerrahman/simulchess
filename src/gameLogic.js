// Helper constants
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function sqToFileRank(sq) {
  if (!sq || sq.length < 2) return [-1, -1];
  const file = FILES.indexOf(sq[0].toLowerCase());
  const rank = parseInt(sq[1], 10) - 1;
  return [file, rank];
}

export function toSq(file, rank) {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${rank + 1}`;
}

export function createInitialBoard() {
  const board = {};

  // Pawns
  for (let f = 0; f < 8; f++) {
    board[toSq(f, 1)] = { type: 'p', color: 'w' };
    board[toSq(f, 6)] = { type: 'p', color: 'b' };
  }

  // Pieces
  const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++) {
    board[toSq(f, 0)] = { type: backRank[f], color: 'w' };
    board[toSq(f, 7)] = { type: backRank[f], color: 'b' };
  }

  return board;
}

export function createInitialGameState() {
  return {
    board: createInitialBoard(),
    castlingRights: {
      w: { k: true, q: true },
      b: { k: true, q: true }
    },
    enPassantTarget: null,
    turnCount: 1,
    history: [],
    status: 'waiting',
    players: { w: null, b: null },
    pendingMoves: { w: null, b: null },
    submitted: { w: false, b: false },
    capturedPieces: { w: [], b: [] },
    lastEvents: []
  };
}

export function getLegalMoves(board, color, castlingRights = null, enPassantTarget = null) {
  if (!board || !color) return [];

  const moves = [];
  const friendlyColor = color;
  const enemyColor = color === 'w' ? 'b' : 'w';
  const pawnDirection = color === 'w' ? 1 : -1;
  const startPawnRank = color === 'w' ? 1 : 6;
  const promoRank = color === 'w' ? 7 : 0;

  for (const sq in board) {
    const piece = board[sq];
    if (!piece || piece.color !== friendlyColor) continue;

    const [f, r] = sqToFileRank(sq);
    if (f === -1 || r === -1) continue;

    switch (piece.type) {
      case 'p': {
        // 1 step forward
        const fwd1Sq = toSq(f, r + pawnDirection);
        if (fwd1Sq && !board[fwd1Sq]) {
          if (r + pawnDirection === promoRank) {
            ['q', 'r', 'b', 'n'].forEach(pr => {
              moves.push({ from: sq, to: fwd1Sq, piece, promotion: pr, san: `${fwd1Sq}=${pr.toUpperCase()}` });
            });
          } else {
            moves.push({ from: sq, to: fwd1Sq, piece, san: fwd1Sq });
            // 2 steps forward from initial rank
            if (r === startPawnRank) {
              const fwd2Sq = toSq(f, r + 2 * pawnDirection);
              if (fwd2Sq && !board[fwd2Sq]) {
                moves.push({ from: sq, to: fwd2Sq, piece, isTwoSquarePawn: true, san: fwd2Sq });
              }
            }
          }
        }

        // Diagonal captures
        for (const df of [-1, 1]) {
          const capSq = toSq(f + df, r + pawnDirection);
          if (!capSq) continue;

          const targetPiece = board[capSq];
          const isEnPassant = enPassantTarget && capSq === enPassantTarget;

          if ((targetPiece && targetPiece.color === enemyColor) || isEnPassant) {
            if (r + pawnDirection === promoRank) {
              ['q', 'r', 'b', 'n'].forEach(pr => {
                moves.push({
                  from: sq,
                  to: capSq,
                  piece,
                  promotion: pr,
                  captured: targetPiece || { type: 'p', color: enemyColor },
                  isEnPassant,
                  san: `${FILES[f]}x${capSq}=${pr.toUpperCase()}`
                });
              });
            } else {
              moves.push({
                from: sq,
                to: capSq,
                piece,
                captured: targetPiece || (isEnPassant ? { type: 'p', color: enemyColor } : null),
                isEnPassant,
                san: `${FILES[f]}x${capSq}`
              });
            }
          }
        }
        break;
      }

      case 'n': {
        const knightDeltas = [
          [-2, -1], [-2, 1], [-1, -2], [-1, 2],
          [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [df, dr] of knightDeltas) {
          const targetSq = toSq(f + df, r + dr);
          if (!targetSq) continue;
          const targetPiece = board[targetSq];
          if (!targetPiece) {
            moves.push({ from: sq, to: targetSq, piece, san: `N${targetSq}` });
          } else if (targetPiece.color === enemyColor) {
            moves.push({ from: sq, to: targetSq, piece, captured: targetPiece, san: `Nx${targetSq}` });
          }
        }
        break;
      }

      case 'b': {
        const bishopDirections = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [df, dr] of bishopDirections) {
          let step = 1;
          while (true) {
            const targetSq = toSq(f + step * df, r + step * dr);
            if (!targetSq) break;
            const targetPiece = board[targetSq];
            if (!targetPiece) {
              moves.push({ from: sq, to: targetSq, piece, san: `B${targetSq}` });
            } else {
              if (targetPiece.color === enemyColor) {
                moves.push({ from: sq, to: targetSq, piece, captured: targetPiece, san: `Bx${targetSq}` });
              }
              break;
            }
            step++;
          }
        }
        break;
      }

      case 'r': {
        const rookDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [df, dr] of rookDirections) {
          let step = 1;
          while (true) {
            const targetSq = toSq(f + step * df, r + step * dr);
            if (!targetSq) break;
            const targetPiece = board[targetSq];
            if (!targetPiece) {
              moves.push({ from: sq, to: targetSq, piece, san: `R${targetSq}` });
            } else {
              if (targetPiece.color === enemyColor) {
                moves.push({ from: sq, to: targetSq, piece, captured: targetPiece, san: `Rx${targetSq}` });
              }
              break;
            }
            step++;
          }
        }
        break;
      }

      case 'q': {
        const queenDirections = [
          [1, 0], [-1, 0], [0, 1], [0, -1],
          [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];
        for (const [df, dr] of queenDirections) {
          let step = 1;
          while (true) {
            const targetSq = toSq(f + step * df, r + step * dr);
            if (!targetSq) break;
            const targetPiece = board[targetSq];
            if (!targetPiece) {
              moves.push({ from: sq, to: targetSq, piece, san: `Q${targetSq}` });
            } else {
              if (targetPiece.color === enemyColor) {
                moves.push({ from: sq, to: targetSq, piece, captured: targetPiece, san: `Qx${targetSq}` });
              }
              break;
            }
            step++;
          }
        }
        break;
      }

      case 'k': {
        const kingDirections = [
          [1, 0], [-1, 0], [0, 1], [0, -1],
          [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];
        for (const [df, dr] of kingDirections) {
          const targetSq = toSq(f + df, r + dr);
          if (!targetSq) continue;
          const targetPiece = board[targetSq];
          if (!targetPiece) {
            moves.push({ from: sq, to: targetSq, piece, san: `K${targetSq}` });
          } else if (targetPiece.color === enemyColor) {
            moves.push({ from: sq, to: targetSq, piece, captured: targetPiece, san: `Kx${targetSq}` });
          }
        }

        // Castling
        const colorRights = castlingRights ? castlingRights[color] : { k: true, q: true };
        const kingRank = color === 'w' ? 0 : 7;
        const kingStartSq = color === 'w' ? 'e1' : 'e8';

        if (sq === kingStartSq && colorRights) {
          // Kingside: e1 -> g1 (squares f1, g1 empty, rook on h1)
          if (colorRights.k) {
            const fSq = toSq(5, kingRank);
            const gSq = toSq(6, kingRank);
            const hSq = toSq(7, kingRank);
            const rook = board[hSq];
            if (rook && rook.type === 'r' && rook.color === color && !board[fSq] && !board[gSq]) {
              moves.push({
                from: sq,
                to: gSq,
                piece,
                isCastling: true,
                castlingSide: 'k',
                rookFrom: hSq,
                rookTo: fSq,
                san: 'O-O'
              });
            }
          }
          // Queenside: e1 -> c1 (squares b1, c1, d1 empty, rook on a1)
          if (colorRights.q) {
            const bSq = toSq(1, kingRank);
            const cSq = toSq(2, kingRank);
            const dSq = toSq(3, kingRank);
            const aSq = toSq(0, kingRank);
            const rook = board[aSq];
            if (rook && rook.type === 'r' && rook.color === color && !board[bSq] && !board[cSq] && !board[dSq]) {
              moves.push({
                from: sq,
                to: cSq,
                piece,
                isCastling: true,
                castlingSide: 'q',
                rookFrom: aSq,
                rookTo: dSq,
                san: 'O-O-O'
              });
            }
          }
        }
        break;
      }
    }
  }

  return moves;
}

export function resolveTurn(board, m1, m2, currentCastlingRights = null, currentEnPassantTarget = null) {
  const newBoard = { ...board };
  const events = [];
  const capturedPieces = { w: [], b: [] };

  const rights = currentCastlingRights ? JSON.parse(JSON.stringify(currentCastlingRights)) : {
    w: { k: true, q: true },
    b: { k: true, q: true }
  };

  const whiteMove = m1 && m1.from && m1.to ? m1 : null;
  const blackMove = m2 && m2.from && m2.to ? m2 : null;

  const whiteFrom = whiteMove ? whiteMove.from : null;
  const whiteTo = whiteMove ? whiteMove.to : null;
  const blackFrom = blackMove ? blackMove.from : null;
  const blackTo = blackMove ? blackMove.to : null;

  const whitePieceObj = whiteMove
    ? (whiteMove.promotion ? { type: whiteMove.promotion, color: 'w' } : (board[whiteFrom] || whiteMove.piece))
    : null;
  const blackPieceObj = blackMove
    ? (blackMove.promotion ? { type: blackMove.promotion, color: 'b' } : (board[blackFrom] || blackMove.piece))
    : null;

  // Remove moving pieces from origin squares
  if (whiteFrom) delete newBoard[whiteFrom];
  if (blackFrom) delete newBoard[blackFrom];

  // Castling rook origins
  let whiteRookMove = null;
  if (whiteMove?.isCastling || (whitePieceObj?.type === 'k' && whiteFrom === 'e1' && (whiteTo === 'g1' || whiteTo === 'c1'))) {
    const isKingSide = whiteTo === 'g1';
    whiteRookMove = {
      from: isKingSide ? 'h1' : 'a1',
      to: isKingSide ? 'f1' : 'd1',
      piece: { type: 'r', color: 'w' }
    };
    delete newBoard[whiteRookMove.from];
  }

  let blackRookMove = null;
  if (blackMove?.isCastling || (blackPieceObj?.type === 'k' && blackFrom === 'e8' && (blackTo === 'g8' || blackTo === 'c8'))) {
    const isKingSide = blackTo === 'g8';
    blackRookMove = {
      from: isKingSide ? 'h8' : 'a8',
      to: isKingSide ? 'f8' : 'd8',
      piece: { type: 'r', color: 'b' }
    };
    delete newBoard[blackRookMove.from];
  }

  // Detect collisions: only same-square collision destroys both pieces
  const isSquareCollision = whiteTo && blackTo && whiteTo === blackTo;
  const isSwapPass = whiteTo && blackTo && whiteTo === blackFrom && blackTo === whiteFrom;

  function updateRightsForSquare(sq) {
    if (sq === 'e1') { rights.w.k = false; rights.w.q = false; }
    if (sq === 'h1') { rights.w.k = false; }
    if (sq === 'a1') { rights.w.q = false; }
    if (sq === 'e8') { rights.b.k = false; rights.b.q = false; }
    if (sq === 'h8') { rights.b.k = false; }
    if (sq === 'a8') { rights.b.q = false; }
  }

  if (whiteFrom) updateRightsForSquare(whiteFrom);
  if (blackFrom) updateRightsForSquare(blackFrom);
  if (whiteTo) updateRightsForSquare(whiteTo);
  if (blackTo) updateRightsForSquare(blackTo);

  // Resolve destinations
  if (isSquareCollision) {
    const originalPieceAtSquare = board[whiteTo];
    if (originalPieceAtSquare) {
      capturedPieces[originalPieceAtSquare.color].push(originalPieceAtSquare);
    }
    capturedPieces.w.push(whitePieceObj);
    capturedPieces.b.push(blackPieceObj);
    delete newBoard[whiteTo];

    events.push({
      type: 'collision',
      subtype: 'square',
      square: whiteTo,
      message: `Same-Square Collision on ${whiteTo}! White's ${pieceName(whitePieceObj)} and Black's ${pieceName(blackPieceObj)} annihilated each other!`
    });
  } else {
    if (isSwapPass) {
      events.push({
        type: 'pass',
        message: `🔄 White's ${pieceName(whitePieceObj)} and Black's ${pieceName(blackPieceObj)} bypassed each other in transit!`
      });
    }

    // White lands
    if (whitePieceObj && whiteTo) {
      const stationaryPiece = board[whiteTo];
      if (stationaryPiece && stationaryPiece.color === 'b' && whiteTo !== blackFrom) {
        capturedPieces.b.push(stationaryPiece);
        events.push({
          type: 'capture',
          by: 'w',
          square: whiteTo,
          piece: whitePieceObj,
          captured: stationaryPiece,
          message: `⚔️ White's ${pieceName(whitePieceObj)} captured Black's ${pieceName(stationaryPiece)} on ${whiteTo}.`
        });
      } else if (whiteTo === blackFrom) {
        events.push({
          type: 'evasion',
          by: 'b',
          square: whiteTo,
          message: `💨 Black's piece on ${whiteTo} moved away just in time!`
        });
      }

      // En passant for White
      if (whitePieceObj.type === 'p' && whiteTo === currentEnPassantTarget && !board[whiteTo]) {
        const epSq = toSq(sqToFileRank(whiteTo)[0], sqToFileRank(whiteTo)[1] - 1);
        if (epSq && newBoard[epSq] && newBoard[epSq].color === 'b') {
          capturedPieces.b.push(newBoard[epSq]);
          delete newBoard[epSq];
          events.push({
            type: 'capture',
            by: 'w',
            square: epSq,
            message: `⚔️ White executed en passant capture on ${epSq}!`
          });
        }
      }

      newBoard[whiteTo] = whitePieceObj;
    }

    // Black lands
    if (blackPieceObj && blackTo) {
      const stationaryPiece = board[blackTo];
      if (stationaryPiece && stationaryPiece.color === 'w' && blackTo !== whiteFrom) {
        capturedPieces.w.push(stationaryPiece);
        events.push({
          type: 'capture',
          by: 'b',
          square: blackTo,
          piece: blackPieceObj,
          captured: stationaryPiece,
          message: `⚔️ Black's ${pieceName(blackPieceObj)} captured White's ${pieceName(stationaryPiece)} on ${blackTo}.`
        });
      } else if (blackTo === whiteFrom) {
        events.push({
          type: 'evasion',
          by: 'w',
          square: blackTo,
          message: `💨 White's piece on ${blackTo} moved away just in time!`
        });
      }

      // En passant for Black
      if (blackPieceObj.type === 'p' && blackTo === currentEnPassantTarget && !board[blackTo]) {
        const epSq = toSq(sqToFileRank(blackTo)[0], sqToFileRank(blackTo)[1] + 1);
        if (epSq && newBoard[epSq] && newBoard[epSq].color === 'w') {
          capturedPieces.w.push(newBoard[epSq]);
          delete newBoard[epSq];
          events.push({
            type: 'capture',
            by: 'b',
            square: epSq,
            message: `⚔️ Black executed en passant capture on ${epSq}!`
          });
        }
      }

      newBoard[blackTo] = blackPieceObj;
    }
  }

  // Castled rooks placement
  if (whiteRookMove) {
    if (!newBoard[whiteRookMove.to] || newBoard[whiteRookMove.to].color !== 'b') {
      newBoard[whiteRookMove.to] = whiteRookMove.piece;
    }
  }
  if (blackRookMove) {
    if (!newBoard[blackRookMove.to] || newBoard[blackRookMove.to].color !== 'w') {
      newBoard[blackRookMove.to] = blackRookMove.piece;
    }
  }

  // New En Passant target
  let newEnPassantTarget = null;
  if (whiteMove?.isTwoSquarePawn || (whitePieceObj?.type === 'p' && whiteFrom && whiteTo && Math.abs(parseInt(whiteTo[1], 10) - parseInt(whiteFrom[1], 10)) === 2)) {
    const f = sqToFileRank(whiteFrom)[0];
    newEnPassantTarget = toSq(f, 2);
  } else if (blackMove?.isTwoSquarePawn || (blackPieceObj?.type === 'p' && blackFrom && blackTo && Math.abs(parseInt(blackTo[1], 10) - parseInt(blackFrom[1], 10)) === 2)) {
    const f = sqToFileRank(blackFrom)[0];
    newEnPassantTarget = toSq(f, 5);
  }

  // Winner evaluation
  const winner = checkGameOver(newBoard);

  return {
    newBoard,
    newCastlingRights: rights,
    newEnPassantTarget,
    events,
    capturedPieces,
    winner
  };
}

export function checkGameOver(board) {
  let whiteKing = false;
  let blackKing = false;

  for (const sq in board) {
    const p = board[sq];
    if (p && p.type === 'k') {
      if (p.color === 'w') whiteKing = true;
      if (p.color === 'b') blackKing = true;
    }
  }

  if (!whiteKing && !blackKing) return 'draw';
  if (!whiteKing) return 'b';
  if (!blackKing) return 'w';

  let whitePieces = 0;
  let blackPieces = 0;
  for (const sq in board) {
    const p = board[sq];
    if (p) {
      if (p.color === 'w') whitePieces++;
      if (p.color === 'b') blackPieces++;
    }
  }

  if (whitePieces === 0 && blackPieces === 0) return 'draw';
  if (whitePieces === 0) return 'b';
  if (blackPieces === 0) return 'w';

  return null;
}

export function pieceName(piece) {
  if (!piece) return 'Piece';
  const names = {
    p: 'Pawn',
    n: 'Knight',
    b: 'Bishop',
    r: 'Rook',
    q: 'Queen',
    k: 'King'
  };
  return names[piece.type] || 'Piece';
}
