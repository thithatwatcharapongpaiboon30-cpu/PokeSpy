export type GamePhase = 'LOBBY' | 'PLAYING' | 'DISCUSSION' | 'VOTING' | 'RESULT';

export interface Player {
  id: string;
  name: string;
  isImposter: boolean;
  isAlive: boolean;
  hasVoted: boolean;
  hasSkippedDiscussion: boolean;
}

export interface GameState {
  roomCode: string;
  players: Player[];
  phase: GamePhase;
  pokemonId: number | null;
  pokemonName: string | null;
  currentRound: number;
  currentPlayerIndex: number;
  messages: ChatMessage[];
  discussionEndTime: number | null;
  turnEndTime: number | null;
  winner: 'CREW' | 'IMPOSTER' | null;
  lastVotedOut: string | null;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  round: number;
}

export interface ServerToClientEvents {
  gameUpdate: (state: GameState) => void;
  error: (message: string) => void;
  gameStarted: (state: GameState) => void;
}

export interface ClientToServerEvents {
  joinRoom: (roomCode: string, playerName: string) => void;
  createRoom: (playerName: string) => void;
  startGame: () => void;
  sendMessage: (text: string) => void;
  skipDiscussion: () => void;
  vote: (targetId: string | 'skip') => void;
  leaveRoom: () => void;
}
