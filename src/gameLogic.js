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
        } else if (fwd1Sq && board[fwd1Sq]?.color === friendlyColor) {
          // Defend 1 step forward into friendly piece
          if (r + pawnDirection === promoRank) {
            ['q', 'r', 'b', 'n'].forEach(pr => {
              moves.push({ from: sq, to: fwd1Sq, piece, isDefend: true, promotion: pr, san: `${fwd1Sq}=${pr.toUpperCase()}[D]` });
            });
          } else {
            moves.push({ from: sq, to: fwd1Sq, piece, isDefend: true, san: `${fwd1Sq}[D]` });
          }
        }

        // Diagonal captures and friendly defense
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
          } else if (targetPiece && targetPiece.color === friendlyColor) {
            if (r + pawnDirection === promoRank) {
              ['q', 'r', 'b', 'n'].forEach(pr => {
                moves.push({
                  from: sq,
                  to: capSq,
                  piece,
                  isDefend: true,
                  promotion: pr,
                  san: `${FILES[f]}~${capSq}=${pr.toUpperCase()}`
                });
              });
            } else {
              moves.push({
                from: sq,
                to: capSq,
                piece,
                isDefend: true,
                san: `${FILES[f]}~${capSq}`
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
          } else if (targetPiece.color === friendlyColor) {
            moves.push({ from: sq, to: targetSq, piece, isDefend: true, san: `N~${targetSq}` });
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
              } else if (targetPiece.color === friendlyColor) {
                moves.push({ from: sq, to: targetSq, piece, isDefend: true, san: `B~${targetSq}` });
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
              } else if (targetPiece.color === friendlyColor) {
                moves.push({ from: sq, to: targetSq, piece, isDefend: true, san: `R~${targetSq}` });
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
              } else if (targetPiece.color === friendlyColor) {
                moves.push({ from: sq, to: targetSq, piece, isDefend: true, san: `Q~${targetSq}` });
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
          } else if (targetPiece.color === friendlyColor) {
            moves.push({ from: sq, to: targetSq, piece, isDefend: true, san: `K~${targetSq}` });
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

  // Determine if White or Black is attempting a Defend move on a friendly piece
  const whiteIsDefend = Boolean(whiteMove && (whiteMove.isDefend || (whiteTo && board[whiteTo]?.color === 'w')));
  const blackIsDefend = Boolean(blackMove && (blackMove.isDefend || (blackTo && board[blackTo]?.color === 'b')));

  // Remove moving pieces from origin squares
  if (whiteFrom) delete newBoard[whiteFrom];
  if (blackFrom) delete newBoard[blackFrom];

  // Castling rook origins
  let whiteRookMove = null;
  if (!whiteIsDefend && (whiteMove?.isCastling || (whitePieceObj?.type === 'k' && whiteFrom === 'e1' && (whiteTo === 'g1' || whiteTo === 'c1')))) {
    const isKingSide = whiteTo === 'g1';
    whiteRookMove = {
      from: isKingSide ? 'h1' : 'a1',
      to: isKingSide ? 'f1' : 'd1',
      piece: { type: 'r', color: 'w' }
    };
    delete newBoard[whiteRookMove.from];
  }

  let blackRookMove = null;
  if (!blackIsDefend && (blackMove?.isCastling || (blackPieceObj?.type === 'k' && blackFrom === 'e8' && (blackTo === 'g8' || blackTo === 'c8')))) {
    const isKingSide = blackTo === 'g8';
    blackRookMove = {
      from: isKingSide ? 'h8' : 'a8',
      to: isKingSide ? 'f8' : 'd8',
      piece: { type: 'r', color: 'b' }
    };
    delete newBoard[blackRookMove.from];
  }

  function updateRightsForSquare(sq) {
    if (sq === 'e1') { rights.w.k = false; rights.w.q = false; }
    if (sq === 'h1') { rights.w.k = false; }
    if (sq === 'a1') { rights.w.q = false; }
    if (sq === 'e8') { rights.b.k = false; rights.b.q = false; }
    if (sq === 'h8') { rights.b.k = false; }
    if (sq === 'a8') { rights.b.q = false; }
  }

  // Detect collisions
  const isSquareCollision = whiteTo && blackTo && whiteTo === blackTo;
  const isSwapPass = whiteTo && blackTo && whiteTo === blackFrom && blackTo === whiteFrom;

  // Resolve destinations
  if (isSquareCollision) {
    const targetSq = whiteTo;
    if (whiteIsDefend && !blackIsDefend) {
      // White defender counter-ambushes Black attacker on targetSq
      capturedPieces.b.push(blackPieceObj);

      const stationaryPiece = board[targetSq];
      if (stationaryPiece?.type === 'k') {
        // King is saved! Bodyguard defender sacrifices itself
        capturedPieces.w.push(whitePieceObj);
        newBoard[targetSq] = stationaryPiece;
        events.push({
          type: 'counter_ambush',
          by: 'w',
          square: targetSq,
          savedKing: true,
          message: `White's ${pieceName(whitePieceObj)} sacrifices itself on ${targetSq} to destroy ${pieceName(blackPieceObj)}, saving the King!`
        });
      } else {
        // Non-King: stationary piece traded, White defender claims square
        if (stationaryPiece) capturedPieces.w.push(stationaryPiece);
        newBoard[targetSq] = whitePieceObj;
        events.push({
          type: 'counter_ambush',
          by: 'w',
          square: targetSq,
          message: `White counter-ambushes on ${targetSq}! ${pieceName(whitePieceObj)} eliminates ${pieceName(blackPieceObj)} (trading ${pieceName(stationaryPiece)})`
        });
      }
      if (whiteFrom) updateRightsForSquare(whiteFrom);
      if (blackFrom) updateRightsForSquare(blackFrom);
      updateRightsForSquare(targetSq);

    } else if (blackIsDefend && !whiteIsDefend) {
      // Black defender counter-ambushes White attacker on targetSq
      capturedPieces.w.push(whitePieceObj);

      const stationaryPiece = board[targetSq];
      if (stationaryPiece?.type === 'k') {
        // King is saved! Bodyguard defender sacrifices itself
        capturedPieces.b.push(blackPieceObj);
        newBoard[targetSq] = stationaryPiece;
        events.push({
          type: 'counter_ambush',
          by: 'b',
          square: targetSq,
          savedKing: true,
          message: `Black's ${pieceName(blackPieceObj)} sacrifices itself on ${targetSq} to destroy ${pieceName(whitePieceObj)}, saving the King!`
        });
      } else {
        // Non-King: stationary piece traded, Black defender claims square
        if (stationaryPiece) capturedPieces.b.push(stationaryPiece);
        newBoard[targetSq] = blackPieceObj;
        events.push({
          type: 'counter_ambush',
          by: 'b',
          square: targetSq,
          message: `Black counter-ambushes on ${targetSq}! ${pieceName(blackPieceObj)} eliminates ${pieceName(whitePieceObj)} (trading ${pieceName(stationaryPiece)})`
        });
      }
      if (whiteFrom) updateRightsForSquare(whiteFrom);
      if (blackFrom) updateRightsForSquare(blackFrom);
      updateRightsForSquare(targetSq);

    } else {
      // Standard same-square collision: both moving pieces destroyed
      const originalPieceAtSquare = board[targetSq];
      if (originalPieceAtSquare) {
        capturedPieces[originalPieceAtSquare.color].push(originalPieceAtSquare);
      }
      capturedPieces.w.push(whitePieceObj);
      capturedPieces.b.push(blackPieceObj);
      delete newBoard[targetSq];

      events.push({
        type: 'collision',
        subtype: 'square',
        square: targetSq,
        message: `Collision on ${targetSq}: ${pieceName(whitePieceObj)} and ${pieceName(blackPieceObj)} destroyed`
      });
      if (whiteFrom) updateRightsForSquare(whiteFrom);
      if (blackFrom) updateRightsForSquare(blackFrom);
      updateRightsForSquare(targetSq);
    }
  } else {
    if (isSwapPass) {
      events.push({
        type: 'pass',
        message: `Pass: ${pieceName(whitePieceObj)} & ${pieceName(blackPieceObj)} swapped squares`
      });
    }

    // White lands or holds
    if (whitePieceObj && whiteTo) {
      if (whiteIsDefend) {
        // Opponent did not attack defended square -> turn resolves to nothing happening
        newBoard[whiteFrom] = board[whiteFrom];
        events.push({
          type: 'defend_hold',
          color: 'w',
          square: whiteTo,
          from: whiteFrom,
          message: `White ${pieceName(whitePieceObj)} held position at ${whiteFrom} (${whiteTo} was not attacked)`
        });
      } else {
        const stationaryPiece = board[whiteTo];
        if (stationaryPiece && stationaryPiece.color === 'b' && (whiteTo !== blackFrom || (blackIsDefend && blackTo !== whiteTo))) {
          capturedPieces.b.push(stationaryPiece);
          events.push({
            type: 'capture',
            by: 'w',
            square: whiteTo,
            piece: whitePieceObj,
            captured: stationaryPiece,
            message: `White captures ${pieceName(stationaryPiece)} on ${whiteTo}`
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
              message: `White en passant on ${epSq}`
            });
          }
        }

        newBoard[whiteTo] = whitePieceObj;
        if (whiteFrom) updateRightsForSquare(whiteFrom);
        updateRightsForSquare(whiteTo);
      }
    }

    // Black lands or holds
    if (blackPieceObj && blackTo) {
      if (blackIsDefend) {
        // Opponent did not attack defended square -> turn resolves to nothing happening
        newBoard[blackFrom] = board[blackFrom];
        events.push({
          type: 'defend_hold',
          color: 'b',
          square: blackTo,
          from: blackFrom,
          message: `Black ${pieceName(blackPieceObj)} held position at ${blackFrom} (${blackTo} was not attacked)`
        });
      } else {
        const stationaryPiece = board[blackTo];
        if (stationaryPiece && stationaryPiece.color === 'w' && (blackTo !== whiteFrom || (whiteIsDefend && whiteTo !== blackTo))) {
          capturedPieces.w.push(stationaryPiece);
          events.push({
            type: 'capture',
            by: 'b',
            square: blackTo,
            piece: blackPieceObj,
            captured: stationaryPiece,
            message: `Black captures ${pieceName(stationaryPiece)} on ${blackTo}`
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
              message: `Black en passant on ${epSq}`
            });
          }
        }

        newBoard[blackTo] = blackPieceObj;
        if (blackFrom) updateRightsForSquare(blackFrom);
        updateRightsForSquare(blackTo);
      }
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
