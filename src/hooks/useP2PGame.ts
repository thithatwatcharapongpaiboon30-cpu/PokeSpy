import { useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { GameState, Player, ChatMessage, GamePhase } from '../types';

export function useP2PGame() {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myId, setMyId] = useState<string>('');
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [peerVersion, setPeerVersion] = useState(0);

  const gameStateRef = useRef<GameState | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const isHostRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Initialize Peer
  useEffect(() => {
    const newPeer = new Peer();
    
    newPeer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
      setMyId(id);
      setPeer(newPeer);
      setIsDisconnected(false);
      setError(null);
    });

    newPeer.on('disconnected', () => {
      console.log('Peer disconnected from signaling server. Attempting to reconnect...');
      setIsDisconnected(true);
      // Small delay before reconnecting to avoid rapid-fire attempts
      setTimeout(() => {
        if (newPeer && !newPeer.destroyed && newPeer.disconnected) {
          newPeer.reconnect();
        }
      }, 3000);
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      const errorType = err.type;
      
      switch (errorType) {
        case 'server-error':
          setError('Signaling server error. We are trying to reconnect...');
          break;
        case 'network':
          setError('Network error. Please check your internet connection.');
          break;
        case 'disconnected':
          setError('Lost connection to signaling server. Reconnecting...');
          setIsDisconnected(true);
          newPeer.reconnect();
          break;
        case 'socket-error':
        case 'socket-closed':
          setError('Connection to server lost. Reconnecting...');
          setIsDisconnected(true);
          newPeer.reconnect();
          break;
        case 'peer-unavailable':
          setError('The host you are trying to reach is unavailable. Check the ID.');
          break;
        default:
          setError(`Connection issue (${errorType}). We are attempting to fix it...`);
      }

      if (newPeer.destroyed) {
        setError('Fatal connection error. Please click Reset to try again.');
      }
    });

    return () => {
      newPeer.destroy();
    };
  }, [peerVersion]);

  // Broadcast state to all connected peers
  const broadcastState = useCallback((state: GameState) => {
    setGameState(state);
    connectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send({ type: 'STATE_UPDATE', state });
      }
    });
  }, []);

  // Handle incoming data
  const handleData = useCallback((data: any, conn: DataConnection) => {
    console.log('Received data:', data.type, 'from:', conn.peer);
    
    if (isHostRef.current) {
      // Host handles actions from clients
      if (!gameStateRef.current) return;
      const state = { ...gameStateRef.current };
      
      switch (data.type) {
        case 'JOIN':
          console.log('Player joining:', data.playerName);
          if (state.players.length >= 5) {
            conn.send({ type: 'ERROR', message: 'Room full' });
            return;
          }
          // Check if player already exists
          if (state.players.some(p => p.id === conn.peer)) {
            conn.send({ type: 'STATE_UPDATE', state });
            return;
          }

          state.players.push({
            id: conn.peer,
            name: data.playerName,
            isImposter: false,
            isAlive: true,
            hasVoted: false,
            hasSkippedDiscussion: false,
          });
          
          broadcastState(state);
          // Explicitly send to the new connection to ensure they get it immediately
          setTimeout(() => {
            if (conn.open) conn.send({ type: 'STATE_UPDATE', state });
          }, 100);
          break;

        case 'START_GAME':
          if (state.players.length < 3) {
            conn.send({ type: 'ERROR', message: 'Need at least 3 players' });
            return;
          }
          // Assign Imposter
          const imposterIndex = Math.floor(Math.random() * state.players.length);
          state.players.forEach((p, i) => p.isImposter = i === imposterIndex);
          
          state.pokemonId = Math.floor(Math.random() * 1010) + 1;
          
          fetch(`https://pokeapi.co/api/v2/pokemon/${state.pokemonId}`)
            .then(res => res.json())
            .then(data => {
              if (gameStateRef.current) {
                const newState = { ...gameStateRef.current };
                newState.pokemonType = data.types[0].type.name;
                newState.phase = 'PLAYING';
                newState.currentRound = 1;
                newState.currentPlayerIndex = Math.floor(Math.random() * newState.players.length);
                newState.messages = [];
                newState.winner = null;
                newState.turnEndTime = Date.now() + 25000;
                broadcastState(newState);
              }
            })
            .catch(err => {
              console.error(err);
              if (gameStateRef.current) {
                const newState = { ...gameStateRef.current };
                newState.pokemonType = 'unknown';
                newState.phase = 'PLAYING';
                newState.currentRound = 1;
                newState.currentPlayerIndex = Math.floor(Math.random() * newState.players.length);
                newState.messages = [];
                newState.winner = null;
                newState.turnEndTime = Date.now() + 25000;
                broadcastState(newState);
              }
            });
          break;

        case 'TOGGLE_PRIVATE':
          if (conn.peer === state.players[0].id) {
            state.isPrivate = !state.isPrivate;
            broadcastState(state);
            
            if (state.isPrivate) {
              fetch(`/api/rooms/${state.roomCode}`, { method: 'DELETE' }).catch(() => {});
            } else {
              fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: state.roomCode, hostName: state.players[0].name, playerCount: state.players.length })
              }).catch(() => {});
            }
          }
          break;

        case 'PLAY_AGAIN':
          if (conn.peer === state.players[0].id) {
            state.phase = 'LOBBY';
            state.players.forEach(p => {
              p.isAlive = true;
              p.hasVoted = false;
              p.hasSkippedDiscussion = false;
              p.isImposter = false;
              delete (p as any).votedFor;
            });
            state.pokemonId = null;
            state.pokemonName = null;
            state.pokemonType = null;
            state.currentRound = 1;
            state.currentPlayerIndex = 0;
            state.messages = [];
            state.discussionEndTime = null;
            state.votingEndTime = null;
            state.turnEndTime = null;
            state.winner = null;
            state.lastVotedOut = null;
            broadcastState(state);
          }
          break;

        case 'SEND_MESSAGE':
          const player = state.players.find(p => p.id === conn.peer);
          if (!player || !player.isAlive) return;

          if (state.phase === 'PLAYING') {
            if (state.players[state.currentPlayerIndex].id !== conn.peer) return;
            state.messages.push({
              playerId: conn.peer,
              playerName: player.name,
              text: data.text,
              timestamp: Date.now(),
              round: state.currentRound,
            });
            advanceTurn(state);
          } else if (state.phase === 'DISCUSSION') {
            state.messages.push({
              playerId: conn.peer,
              playerName: player.name,
              text: data.text,
              timestamp: Date.now(),
              round: state.currentRound,
              isDiscussion: true,
            });
          } else {
            return;
          }
          
          broadcastState(state);
          break;

        case 'SKIP_DISCUSSION':
          const pSkip = state.players.find(p => p.id === conn.peer);
          if (pSkip) {
            pSkip.hasSkippedDiscussion = true;
            const alivePlayers = state.players.filter(p => p.isAlive);
            const skipCount = state.players.filter(p => p.isAlive && p.hasSkippedDiscussion).length;
            if (skipCount > alivePlayers.length / 2) {
              state.phase = 'VOTING';
              state.votingEndTime = Date.now() + 60000; // 60 seconds to vote
              state.players.forEach(p => p.hasVoted = false);
            }
            broadcastState(state);
          }
          break;

        case 'VOTE':
          const pVote = state.players.find(p => p.id === conn.peer);
          if (pVote && !pVote.hasVoted) {
            (pVote as any).votedFor = data.targetId;
            pVote.hasVoted = true;
            
            const alivePlayers = state.players.filter(p => p.isAlive);
            const voteCount = state.players.filter(p => p.isAlive && p.hasVoted).length;
            
            if (voteCount === alivePlayers.length) {
              tallyVotes(state);
            }
            broadcastState(state);
          }
          break;
      }
    } else {
      // Client handles state updates from host
      if (data.type === 'STATE_UPDATE') {
        setGameState(data.state);
      } else if (data.type === 'ERROR') {
        setError(data.message);
      }
    }
  }, [isHost, broadcastState]);

  const advanceTurn = (state: GameState) => {
    let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    while (!state.players[nextIndex].isAlive) {
      nextIndex = (nextIndex + 1) % state.players.length;
    }
    state.currentPlayerIndex = nextIndex;

    const alivePlayers = state.players.filter(p => p.isAlive);
    const messagesInRound = state.messages.filter(m => m.round === state.currentRound);
    
    if (messagesInRound.length === alivePlayers.length) {
      if (state.currentRound < 3) {
        state.currentRound++;
        state.turnEndTime = Date.now() + 25000;
      } else {
        state.phase = 'DISCUSSION';
        state.discussionEndTime = Date.now() + 180000;
        state.players.forEach(p => p.hasSkippedDiscussion = false);
        state.turnEndTime = null;
      }
    } else {
      state.turnEndTime = Date.now() + 25000;
    }
  };

  const tallyVotes = (state: GameState) => {
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
        state.phase = 'PLAYING';
        state.currentRound++;
        const aliveIndices = state.players.map((p, i) => p.isAlive ? i : -1).filter(i => i !== -1);
        state.currentPlayerIndex = aliveIndices[Math.floor(Math.random() * aliveIndices.length)];
        state.turnEndTime = Date.now() + 25000;
        state.votingEndTime = null;
        state.discussionEndTime = null;
      }
    }
  };

  // Host setup
  const createRoom = (playerName: string) => {
    if (!peer) {
      setError('Connection not ready. Please try again in a moment.');
      return;
    }
    setIsHost(true);
    const initialState: GameState = {
      roomCode: myId,
      players: [{
        id: myId,
        name: playerName,
        isImposter: false,
        isAlive: true,
        hasVoted: false,
        hasSkippedDiscussion: false,
      }],
      phase: 'LOBBY',
      pokemonId: null,
      pokemonName: null,
      pokemonType: null,
      isPrivate: false,
      currentRound: 1,
      currentPlayerIndex: 0,
      messages: [],
      discussionEndTime: null,
      votingEndTime: null,
      turnEndTime: null,
      winner: null,
      lastVotedOut: null,
    };
    setGameState(initialState);
    
    // Register room as public
    fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: myId, hostName: playerName, playerCount: 1 })
    }).catch(err => console.error('Failed to register room:', err));

    peer.on('connection', (conn) => {
      console.log('Incoming connection from:', conn.peer);
      conn.on('open', () => {
        console.log('Connection opened with:', conn.peer);
        setConnections(prev => {
          if (prev.find(c => c.peer === conn.peer)) return prev;
          return [...prev, conn];
        });
        conn.on('data', (data) => handleData(data, conn));
      });
      conn.on('close', () => {
        console.log('Connection closed with:', conn.peer);
        setConnections(prev => prev.filter(c => c.peer !== conn.peer));
        // Handle player disconnect
        if (gameStateRef.current) {
          const state = { ...gameStateRef.current };
          const idx = state.players.findIndex(p => p.id === conn.peer);
          if (idx !== -1) {
            if (state.phase === 'LOBBY') {
              state.players.splice(idx, 1);
            } else {
              state.players[idx].isAlive = false;
            }
            broadcastState(state);
          }
        }
      });
    });
  };

  // Client setup
  const joinRoom = (roomCode: string, playerName: string) => {
    if (!peer) {
      setError('Connection not ready. Please try again in a moment.');
      return;
    }

    const sanitizedId = roomCode.trim();
    if (!sanitizedId) {
      setError('Invalid Room ID');
      return;
    }

    if (sanitizedId === myId) {
      setError('You cannot join your own room!');
      return;
    }

    console.log('Connecting to room:', sanitizedId);
    try {
      const conn = peer.connect(sanitizedId);
      
      conn.on('open', () => {
        console.log('Connected to host:', sanitizedId);
        setConnections([conn]);
        conn.send({ type: 'JOIN', playerName });
        conn.on('data', (data) => handleData(data, conn));
      });
      
      conn.on('error', (err) => {
        console.error('Connection error:', err);
        setError('Failed to connect to host. Make sure the ID is correct.');
      });
      
      conn.on('close', () => {
        console.log('Connection to host closed');
        setError('Connection to host lost');
        setGameState(null);
      });
    } catch (err: any) {
      console.error('Peer connect error:', err);
      setError('Invalid Room ID format or connection failed.');
    }
  };

  // Actions
  const startGame = () => {
    if (isHost) {
      handleData({ type: 'START_GAME' }, { peer: myId } as any);
    } else {
      connections[0]?.send({ type: 'START_GAME' });
    }
  };

  const sendMessage = (text: string) => {
    if (isHost) {
      handleData({ type: 'SEND_MESSAGE', text }, { peer: myId } as any);
    } else {
      connections[0]?.send({ type: 'SEND_MESSAGE', text });
    }
  };

  const skipDiscussion = () => {
    if (isHost) {
      handleData({ type: 'SKIP_DISCUSSION' }, { peer: myId } as any);
    } else {
      connections[0]?.send({ type: 'SKIP_DISCUSSION' });
    }
  };

  const vote = (targetId: string | 'skip') => {
    if (isHost) {
      handleData({ type: 'VOTE', targetId }, { peer: myId } as any);
    } else {
      connections[0]?.send({ type: 'VOTE', targetId });
    }
  };

  const playAgain = () => {
    if (isHost) {
      handleData({ type: 'PLAY_AGAIN' }, { peer: myId } as any);
    } else {
      connections[0]?.send({ type: 'PLAY_AGAIN' });
    }
  };

  const leaveRoom = () => {
    if (peer) {
      if (isHost) {
        fetch(`/api/rooms/${myId}`, { method: 'DELETE' }).catch(() => {});
      }
      connections.forEach(c => c.close());
      setGameState(null);
      setIsHost(false);
      setConnections([]);
    }
  };

  const reconnect = () => {
    if (peer) {
      if (peer.destroyed) {
        setPeerVersion(v => v + 1);
      } else if (peer.disconnected) {
        peer.reconnect();
      }
    } else {
      setPeerVersion(v => v + 1);
    }
  };

  // Timer logic for host
  useEffect(() => {
    if (!isHost || !gameState) return;

    const timer = setInterval(() => {
      const now = Date.now();
      let state = { ...gameState };
      let changed = false;

      if (state.phase === 'PLAYING' && state.turnEndTime && now > state.turnEndTime) {
        const player = state.players[state.currentPlayerIndex];
        state.messages.push({
          playerId: player.id,
          playerName: player.name,
          text: "... (Timed out)",
          timestamp: now,
          round: state.currentRound,
        });
        advanceTurn(state);
        changed = true;
      } else if (state.phase === 'DISCUSSION' && state.discussionEndTime && now > state.discussionEndTime) {
        state.phase = 'VOTING';
        state.votingEndTime = Date.now() + 60000; // 60 seconds to vote
        state.players.forEach(p => p.hasVoted = false);
        changed = true;
      } else if (state.phase === 'VOTING' && state.votingEndTime && now > state.votingEndTime) {
        // Auto-skip for those who haven't voted
        state.players.filter(p => p.isAlive && !p.hasVoted).forEach(p => {
          (p as any).votedFor = 'skip';
          p.hasVoted = true;
        });
        tallyVotes(state);
        changed = true;
      }

      if (changed) {
        broadcastState(state);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isHost, gameState, broadcastState]);

  // Heartbeat for host
  useEffect(() => {
    if (!isHost || !myId || !gameState || gameState.isPrivate) return;
    
    const interval = setInterval(() => {
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: myId, 
          hostName: gameState.players[0].name, 
          playerCount: gameState.players.length 
        })
      }).catch(() => {});
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isHost, myId, gameState]);

  const togglePrivate = () => {
    if (isHost) {
      handleData({ type: 'TOGGLE_PRIVATE' }, { peer: myId } as any);
    }
  };

  return {
    gameState,
    error,
    isHost,
    myId,
    createRoom,
    joinRoom,
    startGame,
    sendMessage,
    skipDiscussion,
    vote,
    playAgain,
    leaveRoom,
    togglePrivate,
    setError,
    isDisconnected,
    reconnect
  };
}
