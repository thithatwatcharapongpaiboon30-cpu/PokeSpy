import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { GameState, Player, ChatMessage, GamePhase } from './src/types';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const PORT = 3000;

const rooms = new Map<string, GameState>();
const roomTimers = new Map<string, NodeJS.Timeout>();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function startTurn(roomCode: string) {
  const state = rooms.get(roomCode);
  if (!state || state.phase !== 'PLAYING') return;

  state.turnEndTime = Date.now() + 25000;
  
  // Clear existing timer for this room
  if (roomTimers.has(roomCode)) {
    clearTimeout(roomTimers.get(roomCode));
  }

  // Set new timer
  const timer = setTimeout(() => {
    handleTurnTimeout(roomCode);
  }, 25000);
  roomTimers.set(roomCode, timer);
}

function handleTurnTimeout(roomCode: string) {
  const state = rooms.get(roomCode);
  if (!state || state.phase !== 'PLAYING') return;

  const player = state.players[state.currentPlayerIndex];
  
  // Auto-send a message if they timed out
  state.messages.push({
    playerId: player.id,
    playerName: player.name,
    text: "... (Timed out)",
    timestamp: Date.now(),
    round: state.currentRound,
  });

  advanceTurn(roomCode);
}

function advanceTurn(roomCode: string) {
  const state = rooms.get(roomCode);
  if (!state) return;

  // Next player
  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  while (!state.players[nextIndex].isAlive) {
    nextIndex = (nextIndex + 1) % state.players.length;
  }
  state.currentPlayerIndex = nextIndex;

  // Check if round ended
  const alivePlayers = state.players.filter(p => p.isAlive);
  const messagesInRound = state.messages.filter(m => m.round === state.currentRound);
  
  if (messagesInRound.length === alivePlayers.length) {
    if (state.currentRound < 3) {
      state.currentRound++;
      startTurn(roomCode);
    } else {
      // Start Discussion
      state.phase = 'DISCUSSION';
      state.discussionEndTime = Date.now() + 180000; // 3 minutes
      state.players.forEach(p => p.hasSkippedDiscussion = false);
      state.turnEndTime = null;
      if (roomTimers.has(roomCode)) {
        clearTimeout(roomTimers.get(roomCode));
        roomTimers.delete(roomCode);
      }
    }
  } else {
    startTurn(roomCode);
  }

  io.to(roomCode).emit('gameUpdate', state);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', (playerName: string) => {
    console.log('createRoom received from:', socket.id, 'playerName:', playerName);
    const roomCode = generateRoomCode();
    console.log('Generated roomCode:', roomCode);
    const state: GameState = {
      roomCode,
      players: [{
        id: socket.id,
        name: playerName,
        isImposter: false,
        isAlive: true,
        hasVoted: false,
        hasSkippedDiscussion: false,
      }],
      phase: 'LOBBY',
      pokemonId: null,
      pokemonName: null,
      currentRound: 1,
      currentPlayerIndex: 0,
      messages: [],
      discussionEndTime: null,
      turnEndTime: null,
      winner: null,
      lastVotedOut: null,
    };
    rooms.set(roomCode, state);
    socket.join(roomCode);
    socket.emit('gameUpdate', state);
  });

  socket.on('joinRoom', (roomCode: string, playerName: string) => {
    const state = rooms.get(roomCode.toUpperCase());
    if (!state) {
      socket.emit('error', 'Room not found');
      return;
    }
    if (state.phase !== 'LOBBY') {
      socket.emit('error', 'Game already in progress');
      return;
    }
    if (state.players.length >= 5) {
      socket.emit('error', 'Room full');
      return;
    }

    state.players.push({
      id: socket.id,
      name: playerName,
      isImposter: false,
      isAlive: true,
      hasVoted: false,
      hasSkippedDiscussion: false,
    });
    socket.join(roomCode.toUpperCase());
    io.to(roomCode.toUpperCase()).emit('gameUpdate', state);
  });

  socket.on('startGame', () => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomCode) return;
    const state = rooms.get(roomCode);
    if (!state) return;

    if (state.players.length < 3) {
      socket.emit('error', 'Need at least 3 players');
      return;
    }

    // Assign Imposter
    const imposterIndex = Math.floor(Math.random() * state.players.length);
    state.players.forEach((p, i) => p.isImposter = i === imposterIndex);

    // Pick Pokemon (1-1010)
    state.pokemonId = Math.floor(Math.random() * 1010) + 1;
    state.phase = 'PLAYING';
    state.currentRound = 1;
    state.currentPlayerIndex = Math.floor(Math.random() * state.players.length);
    state.messages = [];
    state.winner = null;

    startTurn(roomCode);
    io.to(roomCode).emit('gameUpdate', state);
  });

  socket.on('sendMessage', (text: string) => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomCode) return;
    const state = rooms.get(roomCode);
    if (!state) return;

    const player = state.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.id !== socket.id) return;

    state.messages.push({
      playerId: socket.id,
      playerName: player.name,
      text,
      timestamp: Date.now(),
      round: state.currentRound,
    });

    advanceTurn(roomCode);
  });

  socket.on('leaveRoom', () => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomCode) return;
    
    const state = rooms.get(roomCode);
    if (!state) return;

    const playerIndex = state.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== -1) {
      const isHost = playerIndex === 0;
      
      if (isHost || state.phase === 'LOBBY') {
        // If host leaves or it's lobby, just destroy or handle
        if (isHost) {
          io.to(roomCode).emit('error', 'Host deleted the lobby');
          io.to(roomCode).emit('gameUpdate', null);
          rooms.delete(roomCode);
          if (roomTimers.has(roomCode)) {
            clearTimeout(roomTimers.get(roomCode));
            roomTimers.delete(roomCode);
          }
        } else {
          state.players.splice(playerIndex, 1);
          io.to(roomCode).emit('gameUpdate', state);
        }
      } else {
        // Mid-game leave
        state.players[playerIndex].isAlive = false;
        // Check if it was their turn
        if (state.currentPlayerIndex === playerIndex) {
          advanceTurn(roomCode);
        } else {
          io.to(roomCode).emit('gameUpdate', state);
        }
      }
    }
    socket.leave(roomCode);
    socket.emit('gameUpdate', null);
  });

  socket.on('skipDiscussion', () => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomCode) return;
    const state = rooms.get(roomCode);
    if (!state) return;

    const player = state.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive) return;

    player.hasSkippedDiscussion = true;
    const alivePlayers = state.players.filter(p => p.isAlive);
    const skipCount = state.players.filter(p => p.isAlive && p.hasSkippedDiscussion).length;

    if (skipCount > alivePlayers.length / 2) {
      state.phase = 'VOTING';
      state.players.forEach(p => p.hasVoted = false);
    }

    io.to(roomCode).emit('gameUpdate', state);
  });

  socket.on('vote', (targetId: string | 'skip') => {
    const roomCode = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomCode) return;
    const state = rooms.get(roomCode);
    if (!state) return;

    const player = state.players.find(p => p.id === socket.id);
    if (!player || !player.isAlive || player.hasVoted) return;

    // Store vote on the player object temporarily or in a separate map
    // For simplicity, let's add a `votedFor` property to Player
    (player as any).votedFor = targetId;
    player.hasVoted = true;

    const alivePlayers = state.players.filter(p => p.isAlive);
    const voteCount = state.players.filter(p => p.isAlive && p.hasVoted).length;

    if (voteCount === alivePlayers.length) {
      // Tally votes
      const tallies: Record<string, number> = {};
      state.players.filter(p => p.isAlive).forEach(p => {
        const target = (p as any).votedFor;
        tallies[target] = (tallies[target] || 0) + 1;
      });

      let maxVotes = 0;
      let votedOutId: string | null = null;
      let tie = false;

      for (const [id, count] of Object.entries(tallies)) {
        if (count > maxVotes) {
          maxVotes = count;
          votedOutId = id;
          tie = false;
        } else if (count === maxVotes) {
          tie = true;
        }
      }

      if (!tie && votedOutId && votedOutId !== 'skip') {
        const votedOutPlayer = state.players.find(p => p.id === votedOutId);
        if (votedOutPlayer) {
          votedOutPlayer.isAlive = false;
          state.lastVotedOut = votedOutPlayer.name;
          
          if (votedOutPlayer.isImposter) {
            state.winner = 'CREW';
            state.phase = 'RESULT';
          }
        }
      } else {
        state.lastVotedOut = 'Nobody (Tie or Skip)';
      }

      if (state.phase !== 'RESULT') {
        const remainingAlive = state.players.filter(p => p.isAlive);
        const imposterAlive = remainingAlive.some(p => p.isImposter);
        
        if (!imposterAlive) {
          state.winner = 'CREW';
          state.phase = 'RESULT';
        } else if (remainingAlive.length <= 2) {
          state.winner = 'IMPOSTER';
          state.phase = 'RESULT';
        } else {
          // Continue to next rounds
          state.phase = 'PLAYING';
          state.currentRound = 1;
          // Reset current player to a random alive player
          const aliveIndices = state.players.map((p, i) => p.isAlive ? i : -1).filter(i => i !== -1);
          state.currentPlayerIndex = aliveIndices[Math.floor(Math.random() * aliveIndices.length)];
          state.messages = [];
        }
      }
    }

    io.to(roomCode).emit('gameUpdate', state);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Handle disconnection - maybe mark as dead or remove from room
    for (const [roomCode, state] of rooms.entries()) {
      const playerIndex = state.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        if (state.phase === 'LOBBY') {
          if (playerIndex === 0) {
            io.to(roomCode).emit('error', 'Host disconnected');
            io.to(roomCode).emit('gameUpdate', null);
            rooms.delete(roomCode);
          } else {
            state.players.splice(playerIndex, 1);
            io.to(roomCode).emit('gameUpdate', state);
          }
        } else {
          if (playerIndex === 0) {
            io.to(roomCode).emit('error', 'Host disconnected');
            io.to(roomCode).emit('gameUpdate', null);
            rooms.delete(roomCode);
          } else {
            state.players[playerIndex].isAlive = false;
          // Check win conditions if game is running
          const remainingAlive = state.players.filter(p => p.isAlive);
          if (remainingAlive.length === 0) {
            rooms.delete(roomCode);
          } else {
            // Check if imposter left
            if (state.players[playerIndex].isImposter) {
              state.winner = 'CREW';
              state.phase = 'RESULT';
            } else if (remainingAlive.length <= 2 && remainingAlive.some(p => p.isImposter)) {
              state.winner = 'IMPOSTER';
              state.phase = 'RESULT';
            }
            io.to(roomCode).emit('gameUpdate', state);
          }
        }
      }
      break;
    }
  }
});
});

async function startServer() {
  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", rooms: rooms.size });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
