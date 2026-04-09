import { useEffect, useState } from 'react';
import { Swords, Loader2, Play, Users } from 'lucide-react';
import ChessBoardWrapper from './ChessBoardWrapper';
import { db } from './firebase';
import { ref, get, set, update, onValue, remove, push, onDisconnect } from 'firebase/database';
import { createInitialBoard } from './gameLogic';

function App() {
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [color, setColor] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [userId] = useState(() => Math.random().toString(36).substring(2, 10));

  useEffect(() => {
    if (!roomId) return;
    const gameRef = ref(db, `games/${roomId}`);
    
    // Set up disconnect cleanup
    if (color && (color === 'w' || color === 'b')) {
      const playerRef = ref(db, `games/${roomId}/players/${color}`);
      onDisconnect(playerRef).remove();
    }

    const unsub = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameState(data);
        if (data.status === 'playing' && color === 'spectator') {
          // If we somehow joined but missing a color, check if we can claim one
          if (!data.players.w && data.players.b !== userId) {
            updateColor('w');
          } else if (!data.players.b && data.players.w !== userId) {
            updateColor('b');
          }
        }
      }
    });
    
    return () => unsub();
  }, [roomId, color, userId]);

  async function updateColor(newColor) {
    setColor(newColor);
    await update(ref(db, `games/${roomId}/players`), { [newColor]: userId });
    
    // If both players are now in, start game
    const snap = await get(ref(db, `games/${roomId}/players`));
    const players = snap.val();
    if (players && players.w && players.b) {
      const stateSnap = await get(ref(db, `games/${roomId}/status`));
      if (stateSnap.val() === 'waiting') {
        await update(ref(db, `games/${roomId}`), { status: 'playing' });
      }
    }
  }

  async function handleCreatePrivate() {
    setLoadingMsg("Creating room...");
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const initialData = {
      board: createInitialBoard(),
      players: { w: userId },
      status: 'waiting',
      pendingMoves: { w: null, b: null },
      submitted: { w: false, b: false }
    };
    
    await set(ref(db, `games/${newRoomId}`), initialData);
    setColor('w');
    setRoomId(newRoomId);
    setLoadingMsg('');
  }

  async function handleJoinPrivate(e) {
    if (e) e.preventDefault();
    const id = inputRoomId.trim().toUpperCase();
    if (!id) return;
    
    setLoadingMsg("Joining...");
    const snap = await get(ref(db, `games/${id}`));
    if (snap.exists()) {
      const data = snap.val();
      let assignedColor = 'spectator';
      
      const updates = {};
      if (!data.players?.w) { assignedColor = 'w'; updates[`players/w`] = userId; }
      else if (!data.players?.b) { assignedColor = 'b'; updates[`players/b`] = userId; }
      
      if (assignedColor !== 'spectator') {
        const fullPlayers = { ...data.players, [assignedColor]: userId };
        if (fullPlayers.w && fullPlayers.b && data.status === 'waiting') {
          updates['status'] = 'playing';
        }
        await update(ref(db, `games/${id}`), updates);
      }
      
      setColor(assignedColor);
      setRoomId(id);
    } else {
      alert("Room not found");
    }
    setLoadingMsg('');
  }

  async function handleFindPublic() {
    setLoadingMsg("Looking for a match...");
    const queueRef = ref(db, 'queue');
    const snap = await get(queueRef);
    const topEntry = snap.val() ? Object.entries(snap.val())[0] : null;

    if (topEntry) {
      // Join existing game in queue
      const [qKey, gameId] = topEntry;
      await remove(ref(db, `queue/${qKey}`)); // pop from queue
      setInputRoomId(gameId);
      
      const gameSnap = await get(ref(db, `games/${gameId}`));
      if (gameSnap.exists()) {
         let assignedColor = 'spectator';
         const data = gameSnap.val();
         const updates = {};
         if (!data.players?.w) { assignedColor = 'w'; updates[`players/w`] = userId; }
         else if (!data.players?.b) { assignedColor = 'b'; updates[`players/b`] = userId; }
         
         if (assignedColor !== 'spectator') {
            const fullPlayers = { ...data.players, [assignedColor]: userId };
            if (fullPlayers.w && fullPlayers.b && data.status === 'waiting') {
               updates['status'] = 'playing';
            }
            await update(ref(db, `games/${gameId}`), updates);
         }
         setColor(assignedColor);
         setRoomId(gameId);
      } else {
         // Fallback if game was deleted
         handleCreatePublic();
      }
    } else {
      // Create new game and add to queue
      handleCreatePublic();
    }
    setLoadingMsg('');
  }
  
  async function handleCreatePublic() {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const initialData = {
      board: createInitialBoard(),
      players: { w: userId },
      status: 'waiting',
      pendingMoves: { w: false, b: false }, // Use bool for presence, store actual moves in private node if needed, but for simplicity we store directly and rely on UI to hide it
      submitted: { w: false, b: false }
    };
    await set(ref(db, `games/${newRoomId}`), initialData);
    await push(ref(db, 'queue'), newRoomId);
    setColor('w');
    setRoomId(newRoomId);
  }

  async function submitMove(move) {
    if (!roomId || !color || color === 'spectator') return;
    
    const gameRef = ref(db, `games/${roomId}`);
    
    // We only update our move and our submitted status
    await update(gameRef, {
      [`pendingMoves/${color}`]: move,
      [`submitted/${color}`]: true
    });
  }

  if (!roomId) {
    return (
      <div className="lobby-container" style={{ margin: 'auto', padding: '4rem', maxWidth: '500px', width: '100%' }}>
        <h1 className="lobby-title" style={{ fontSize: '2rem', fontWeight: 600, color: '#111', marginBottom: '2.5rem' }}>SimulChess</h1>
        
        {loadingMsg && <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem', color:'#444'}}><Loader2 className="animate-spin" size={18}/> {loadingMsg}</div>}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          <button className="btn btn-primary" onClick={handleFindPublic} disabled={!!loadingMsg}>
            <Play size={18} /> Find Public Match
          </button>
          
          <div className="divider">or</div>
          
          <button className="btn btn-secondary" onClick={handleCreatePrivate} disabled={!!loadingMsg}>
            <Users size={18} /> Create Private Room
          </button>
          
          <form onSubmit={handleJoinPrivate} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Room Code"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
              style={{ flexGrow: 1 }}
              maxLength={6}
              disabled={!!loadingMsg}
            />
            <button type="submit" className="btn btn-secondary" disabled={!!loadingMsg || !inputRoomId.trim()}>
              Join
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return <div style={{ margin: 'auto', display: 'flex', gap: '1rem', color: '#333' }}><Loader2 size={24} className="animate-spin" /> Loading game...</div>;
  }

  return (
    <ChessBoardWrapper 
      gameState={gameState} 
      color={color} 
      submitMove={submitMove}
      roomId={roomId}
    />
  );
}

export default App;
