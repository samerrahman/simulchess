# SimulChess ♟️⚡

Real-time simultaneous multiplayer chess with collision mechanics, rated matchmaking, and a Pokémon Showdown-style account system.

**[🎮 Play Online](https://simulchess-daf26.web.app)**

---

## ⚡ How It Works

- **Simultaneous Turns**: Both players plan and lock in moves secretly at the same time.
- **Simultaneous Resolution**: Moves resolve at the exact same moment.
- **Collisions**: Pieces that target the same square or cross paths head-on **both explode**.
- **Win Condition**: Capture the enemy King. (No checks or checkmates).

---

## ✨ Features

- **Live Multiplayer**: Public matchmaking queue and private room codes via Firebase.
- **Showdown-Style Accounts**: Play immediately without a password, or register anytime to permanently save your Elo progress.
- **Hall of Fame**: Elo-rated leaderboard for registered accounts ($K=32$).
- **Smooth Board Animations**: Jitter-free LERP piece gliding on move resolution.
- **Fast Controls**: Drag-and-drop, click-to-move, and <kbd>Esc</kbd> to unlock your move.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite
- **Backend**: Firebase Realtime Database & Auth
- **Engine**: chess.js

---

## 🚀 Quickstart

```bash
git clone https://github.com/samerrahman/simulchess.git
cd simulchess
npm install
npm run dev
```

---

## 📄 License

MIT
