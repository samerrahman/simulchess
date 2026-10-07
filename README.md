# SimulChess ♟️⚡

> Real-time simultaneous multiplayer chess with collision physics, rated matchmaking, and Pokémon Showdown-style identity and rating.

[![Live App](https://img.shields.io/badge/Live%20App-simulchess--daf26.web.app-blue?style=for-the-badge&logo=firebase)](https://simulchess-daf26.web.app)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev/)

---

## 🎮 Play Online

**[👉 Play SimulChess Live Here](https://simulchess-daf26.web.app)**

---

## 📖 Overview

Standard chess is turn-based, giving the defending player complete information before making their move. **SimulChess** flips this paradigm on its head:

- **Simultaneous Turns**: Both players plan and lock in their moves secretly during a turn countdown.
- **Simultaneous Resolution**: When both players lock in (or the timer expires), both moves execute at the exact same moment.
- **Collision & Destruction**: If two pieces collide into the same destination square or cross each other's path head-on, **both pieces are destroyed in an explosion** (Mutually Assured Destruction).
- **Decisive Kings**: Check and checkmate restrictions do not exist—you can move through checked squares, and games conclude when an opposing King is captured.

---

## ✨ Features

- **⚡ Real-Time Multiplayer**: Seamless room creation, shareable invite links, and public matchmaking powered by Firebase Realtime Database.
- **🎯 Pokémon Showdown-Style Identity**:
  - **Play Instantly as Guest**: Pick a username and jump directly into games without needing an upfront password or email.
  - **Password-Protected Names**: Claimed usernames require a password to log in.
  - **Register Anytime**: Register your username whenever you want; all active session rating progress ($Elo$) and win/loss records are permanently preserved and transferred to your account.
- **🏆 Elo Rating & Hall of Fame**:
  - Elo calculation with standard factor ($K=32$) atomically updating after every game.
  - Public Hall of Fame leaderboard ranking top registered players.
- **🎨 Smooth Visual Experience**:
  - Linear-interpolated (LERP) piece glide animations on simultaneous move resolution.
  - Tournament-standard C. Burnett vector piece set.
  - Move indicators, capture rings, and ghost piece previews for staged moves.
- **⌨️ Intuitive Controls**:
  - Drag-and-drop or click-to-move piece selection.
  - Instant move unlock with the <kbd>Esc</kbd> key before turn resolution.

---

## 📜 How to Play

| Phase | Description |
| :--- | :--- |
| **1. Planning** | Both White and Black secretly choose a legal move within the time limit. A ghost indicator previews your selected destination. |
| **2. Lock In** | Hit **Lock In Move** (or press <kbd>Space</kbd>). If you change your mind before your opponent locks in, press <kbd>Esc</kbd> or click **Unlock Move**. |
| **3. Resolution** | Once both players are locked in (or time expires), pieces glide simultaneously to their targets. |
| **4. Collisions** | 💥 **Head-on / Same Square**: Both pieces explode and are removed.<br>⚔️ **Capture**: Moving onto an enemy square captures that piece if it did not escape. |
| **5. Victory** | The game ends immediately when a King is captured, on resignation, or when time runs out. |

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
- **State & Multiplayer Backend**: [Firebase Realtime Database](https://firebase.google.com/products/realtime-database)
- **Authentication**: [Firebase Authentication](https://firebase.google.com/products/auth) (Showdown-style custom credentials)
- **Hosting**: [Firebase Hosting](https://firebase.google.com/products/hosting)
- **Chess Engine**: [chess.js](https://github.com/jhlywa/chess.js) (customized for simultaneous validation)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/samerrahman/simulchess.git
   cd simulchess
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

The production output will be generated inside the `dist/` directory.

---

## 📄 License

MIT License. Feel free to use, modify, and build upon this project.
