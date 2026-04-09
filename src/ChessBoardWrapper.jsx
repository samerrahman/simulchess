import { useState, useMemo, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Send, CheckCircle2, Copy } from 'lucide-react';
import { db } from './firebase';
import { ref, update } from 'firebase/database';
import { resolveTurn, checkGameOver, getLegalMoves } from './gameLogic';

export default function ChessBoardWrapper({ gameState, color, submitMove, roomId }) {
  const [intendedMove, setIntendedMove] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [shakeSquare, setShakeSquare] = useState(null);
  
  const isSpectator = color === 'spectator';
  const myStatus = color !== 'spectator' ? gameState.submitted[color] : false;
  const enemyColor = color === 'w' ? 'b' : 'w';
  const enemyStatus = color !== 'spectator' ? gameState.submitted[enemyColor] : false;

  // Master logic to resolve turns once both submitted
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.submitted.w && gameState.submitted.b) {
      // Let White handle the resolution to prevent race conditions
      if (color === 'w') {
        const newBoard = resolveTurn(gameState.board, gameState.pendingMoves.w, gameState.pendingMoves.b);
        const winner = checkGameOver(newBoard);
        
        let newStatus = 'playing';
        if (winner === 'draw') newStatus = 'draw';
        else if (winner === 'w') newStatus = 'w_won';
        else if (winner === 'b') newStatus = 'b_won';

        update(ref(db, `games/${roomId}`), {
          board: newBoard,
          status: newStatus,
          submitted: { w: false, b: false },
          pendingMoves: { w: null, b: null }
        });
      }
    }
  }, [gameState.status, gameState.submitted, gameState.board, gameState.pendingMoves, color, roomId]);

  // Convert custom board `{ e2: { type: 'p', color: 'w' } }` to `react-chessboard` format `{ e2: 'wP' }`
  const position = useMemo(() => {
    const pos = {};
    for (const sq in gameState.board) {
      const piece = gameState.board[sq];
      pos[sq] = `${piece.color}${piece.type.toUpperCase()}`;
    }
    if (intendedMove) {
      delete pos[intendedMove.from];
      pos[intendedMove.to] = `${intendedMove.piece.color}${intendedMove.piece.type.toUpperCase()}`;
    }
    return pos;
  }, [gameState.board, intendedMove]);

  useEffect(() => {
    if (!myStatus && intendedMove) {
      setIntendedMove(null);
    }
  }, [myStatus]);

  function tryMove(from, to, promotion = 'q') {
    if (isSpectator || gameState.status !== 'playing' || myStatus) return false;
    
    const sourcePiece = gameState.board[from];
    if (!sourcePiece || sourcePiece.color !== color) return false;

    // If there's an intended move, getLegalMoves should probably evaluate from the original board state
    // since simultaneous moves are resolved cleanly from the base turn state.
    const legal = getLegalMoves(gameState.board, color);
    const isLegal = legal.find(m => m.from === from && m.to === to && (!m.promotion || m.promotion === promotion));
    
    if (isLegal) {
      const prm = (sourcePiece.type === 'p' && (to[1] === '8' || to[1] === '1')) ? promotion : undefined;
      setIntendedMove({ from, to, promotion: prm, piece: sourcePiece });
      setSelectedSquare(null);
      setPossibleMoves([]);
      return true; // Allow the visual drop
    }
    
    // Shake animation
    setShakeSquare(to);
    setTimeout(() => setShakeSquare(null), 300);
    return false;
  }

  function handlePieceDrop(from, to, piece) {
    const success = tryMove(from, to);
    return success;
  }

  function onSquareClick(square) {
    if (isSpectator || gameState.status !== 'playing' || myStatus) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else {
        const success = tryMove(selectedSquare, square);
        if (!success) {
           // Maybe they clicked a different friendly piece
           const piece = gameState.board[square];
           if (piece && piece.color === color) {
             setSelectedSquare(square);
             const legal = getLegalMoves(gameState.board, color).filter(m => m.from === square);
             setPossibleMoves(legal.map(m => m.to));
           } else {
             setSelectedSquare(null);
             setPossibleMoves([]);
           }
        }
      }
    } else {
      const piece = gameState.board[square];
      if (piece && piece.color === color) {
        setSelectedSquare(square);
        const legal = getLegalMoves(gameState.board, color).filter(m => m.from === square);
        setPossibleMoves(legal.map(m => m.to));
      }
    }
  }

  function handleLockIn() {
    if (intendedMove && !myStatus) {
      submitMove(intendedMove);
    }
  }

  const customSquareStyles = {};
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(0, 0, 0, 0.1)' };
  }
  possibleMoves.forEach(sq => {
    customSquareStyles[sq] = {
      background: gameState.board[sq] ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)' : 'radial-gradient(circle, rgba(0,0,0,.15) 25%, transparent 25%)',
      borderRadius: '50%'
    };
  });
  if (shakeSquare) {
    customSquareStyles[shakeSquare] = { ...customSquareStyles[shakeSquare], animation: 'shake 0.3s cubic-bezier(.36,.07,.19,.97) both' };
  }

  let statusText = "Waiting for Opponent to Join...";
  if (gameState.status === 'playing') {
    if (myStatus && enemyStatus) statusText = "Resolving...";
    else if (myStatus) statusText = "Waiting for Opponent...";
    else statusText = "Your Turn. Plan your move!";
  } else if (gameState.status === 'w_won') statusText = "White Wins!";
  else if (gameState.status === 'b_won') statusText = "Black Wins!";
  else if (gameState.status === 'draw') statusText = "Draw! Double King Capture!";

  return (
    <div className="game-container">
      <div className="board-area">
        <div style={{ width: '100%', maxWidth: '70vh' }}>
          <Chessboard 
            id="SimultaneousBoard"
            position={position}
            boardOrientation={color === 'b' ? 'black' : 'white'}
            onPieceDrop={handlePieceDrop}
            onSquareClick={onSquareClick}
            customSquareStyles={customSquareStyles}
            isDraggablePiece={({ piece }) => piece[0] === color && !myStatus && gameState.status === 'playing'}
            customDarkSquareStyle={{ backgroundColor: '#ced4da' }}
            customLightSquareStyle={{ backgroundColor: '#f8f9fa' }}
            animationDuration={300}
          />
        </div>
      </div>

      <div className="info-panel">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111' }}>SimulChess</h2>
        
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Room Code: <strong style={{color:'#111', background:'#eee', padding:'2px 6px', borderRadius:'4px'}}>{roomId}</strong>
          <button className="icon-btn" onClick={() => navigator.clipboard.writeText(roomId)} title="Copy code"><Copy size={14}/></button>
        </div>

        <div className={`status-badge ${gameState.status === 'playing' ? (myStatus ? 'waiting' : 'ready') : ''}`}>
          {statusText}
        </div>

        {gameState.status === 'playing' && !isSpectator && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 'auto' }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              {intendedMove ? `Intended move: ${intendedMove.from} → ${intendedMove.to}` : "Drag or click a piece to plan your move."}
            </div>
            
            <button 
              className="btn btn-primary"
              disabled={!intendedMove || myStatus}
              onClick={handleLockIn}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {myStatus ? <CheckCircle2 size={18} /> : <Send size={18} />}
              {myStatus ? "Move Locked" : "Lock In Move"}
            </button>
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid #eee' }}>
          <div className="player-info" style={{ marginBottom: '1rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: enemyStatus ? '#34d399' : '#f87171' }} />
            <span style={{color: '#444'}}>Opponent {enemyStatus ? '(Ready)' : '(Thinking)'}</span>
          </div>
          <div className="player-info">
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: myStatus ? '#34d399' : '#f87171' }} />
            <span style={{color: '#444'}}>You {myStatus ? '(Ready)' : '(Thinking)'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
