import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Send, 
  User, 
  Shield, 
  Skull, 
  Timer, 
  Vote, 
  Trophy, 
  Play, 
  Plus, 
  LogIn,
  RefreshCw,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { useP2PGame } from './hooks/useP2PGame';

export default function App() {
  const {
    gameState,
    error,
    isHost,
    myId,
    createRoom: p2pCreateRoom,
    joinRoom: p2pJoinRoom,
    startGame,
    sendMessage: p2pSendMessage,
    skipDiscussion,
    vote,
    leaveRoom,
    setError
  } = useP2PGame();

  const [playerName, setPlayerName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [pokemonName, setPokemonName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameState?.pokemonId && !pokemonName) {
      fetch(`https://pokeapi.co/api/v2/pokemon/${gameState.pokemonId}`)
        .then(res => res.json())
        .then(data => setPokemonName(data.name))
        .catch(err => console.error('Failed to fetch pokemon name', err));
    }
    if (gameState?.phase === 'LOBBY') {
      setPokemonName(null);
    }
  }, [gameState?.pokemonId, gameState?.phase]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.messages]);

  const handleCreateRoom = () => {
    if (!playerName.trim()) return setError('Enter your name');
    p2pCreateRoom(playerName);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) return setError('Enter your name');
    if (!roomInput.trim()) return setError('Enter room code');
    p2pJoinRoom(roomInput.trim(), playerName);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    p2pSendMessage(messageInput);
    setMessageInput('');
  };

  const copyRoomCode = () => {
    if (gameState?.roomCode) {
      navigator.clipboard.writeText(gameState.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const me = gameState?.players.find(p => p.id === myId);
  const isMyTurn = gameState?.phase === 'PLAYING' && gameState.players[gameState.currentPlayerIndex].id === myId;

  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (gameState?.phase === 'PLAYING' && gameState.turnEndTime) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((gameState.turnEndTime! - Date.now()) / 1000));
        setTimeLeft(remaining);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [gameState?.phase, gameState?.turnEndTime]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-red-500 p-2 border-2 border-black">
              <RefreshCw className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black uppercase tracking-tighter">PokeSpy</h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${myId ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-bold uppercase opacity-50">
                  {myId ? 'P2P Ready' : 'Initializing...'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 p-3 flex items-start gap-3">
              <Info className="text-blue-500 shrink-0 mt-0.5" size={16} />
              <p className="text-[10px] font-bold uppercase text-blue-700 leading-tight">
                Vercel Compatible: This version uses Peer-to-Peer technology. No backend server required!
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">Your Name</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="ASH KETCHUM"
                className="w-full border-2 border-black p-3 font-mono text-lg focus:outline-none focus:bg-yellow-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleCreateRoom}
                disabled={!myId}
                className={`border-2 border-black p-4 font-bold uppercase flex items-center justify-center gap-2 transition-all ${
                  !myId 
                    ? 'bg-gray-300 cursor-not-allowed opacity-50' 
                    : 'bg-emerald-400 hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                <Plus size={20} /> Create
              </button>
              <div className="space-y-2">
                <input 
                  type="text" 
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="HOST ID"
                  className="w-full border-2 border-black p-3 font-mono text-center uppercase focus:outline-none focus:bg-yellow-50"
                />
                <button 
                  onClick={handleJoinRoom}
                  disabled={!myId}
                  className={`w-full border-2 border-black p-4 font-bold uppercase flex items-center justify-center gap-2 transition-all ${
                    !myId
                      ? 'bg-gray-300 cursor-not-allowed opacity-50'
                      : 'bg-blue-400 hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  <LogIn size={20} /> Join
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-2 p-3 font-bold text-sm text-center bg-red-100 border-red-500 text-red-600"
              >
                <p>{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-2 block w-full text-[10px] underline uppercase font-black hover:text-red-800"
                >
                  Click here to Refresh & Retry
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Game Info & Players */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Room Code</h2>
                <div className="bg-black text-white px-2 py-1 text-xs font-bold uppercase">
                  {gameState.phase}
                </div>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 p-2 border-2 border-black">
                <code className="text-xs font-mono truncate flex-1">{gameState.roomCode}</code>
                <button 
                  onClick={copyRoomCode}
                  className="p-1 hover:bg-gray-200 transition-colors"
                  title="Copy Code"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase opacity-50 flex items-center gap-2">
                <Users size={14} /> Players ({gameState.players.length}/5)
              </h3>
              {gameState.players.map((p) => (
                <div 
                  key={p.id}
                  className={`flex items-center justify-between p-3 border-2 border-black ${
                    !p.isAlive ? 'bg-gray-200 opacity-50 grayscale' : 
                    p.id === myId ? 'bg-yellow-100' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {p.isAlive ? <User size={18} /> : <Skull size={18} />}
                    <span className="font-bold uppercase tracking-tight">
                      {p.name} {p.id === myId && '(YOU)'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {gameState.phase === 'VOTING' && p.hasVoted && (
                      <div className="bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase">Voted</div>
                    )}
                    {gameState.phase === 'DISCUSSION' && p.hasSkippedDiscussion && (
                      <div className="bg-emerald-500 text-white px-2 py-0.5 text-[10px] font-bold uppercase">Skip</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 mt-6">
              {gameState.phase === 'LOBBY' && isHost && (
                <button 
                  onClick={startGame}
                  disabled={gameState.players.length < 3}
                  className="w-full bg-red-500 text-white border-2 border-black p-4 font-bold uppercase flex items-center justify-center gap-2 hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play size={20} /> Start Game
                </button>
              )}

              <button 
                onClick={leaveRoom}
                className="w-full bg-white border-2 border-black p-4 font-bold uppercase flex items-center justify-center gap-2 hover:translate-x-1 hover:translate-y-1 hover:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                {isHost ? 'Delete Lobby' : 'Leave Room'}
              </button>
            </div>
          </div>

          {/* Role Card */}
          {gameState.phase !== 'LOBBY' && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 ${
                me?.isImposter ? 'bg-red-500 text-white' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                {me?.isImposter ? <Skull size={24} /> : <Shield size={24} />}
                <h3 className="text-xl font-black uppercase">Your Role: {me?.isImposter ? 'Imposter' : 'Crew'}</h3>
              </div>
              
              {!me?.isImposter ? (
                <div className="space-y-4">
                  <p className="text-sm font-bold uppercase opacity-80">Describe this Pokemon:</p>
                  <div className="aspect-square bg-gray-100 border-2 border-black p-4 flex items-center justify-center overflow-hidden">
                    <img 
                      src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${gameState.pokemonId}.png`}
                      alt="Pokemon"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <p className="text-center text-2xl font-black uppercase tracking-widest">{pokemonName}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-bold uppercase opacity-80">You don't know the Pokemon!</p>
                  <div className="aspect-square bg-black border-2 border-white/20 p-4 flex items-center justify-center">
                    <span className="text-6xl font-black">?</span>
                  </div>
                  <p className="text-center text-sm font-bold uppercase">Blend in and guess what they are describing.</p>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Column: Main Game Area */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-8rem)]">
          
          {/* Game Status Bar */}
          <div className="bg-black text-white p-4 border-2 border-black flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Timer size={18} />
                <span className="font-bold uppercase text-sm">
                  {gameState.phase === 'PLAYING' ? `Round ${gameState.currentRound}/3` : 
                   gameState.phase === 'DISCUSSION' ? 'Discussion' : 
                   gameState.phase === 'VOTING' ? 'Voting' : 'Game Over'}
                </span>
              </div>
            </div>
            {gameState.phase === 'PLAYING' && (
              <div className="flex items-center gap-4">
                <div className="text-sm font-bold uppercase">
                  Turn: <span className="text-yellow-400">{gameState.players[gameState.currentPlayerIndex].name}</span>
                </div>
                <div className={`text-sm font-black px-2 py-1 border-2 border-white ${timeLeft !== null && timeLeft <= 5 ? 'bg-red-500 animate-pulse' : 'bg-black'}`}>
                  {timeLeft}s
                </div>
              </div>
            )}
            {gameState.phase === 'DISCUSSION' && gameState.discussionEndTime && (
              <div className="text-sm font-bold uppercase text-red-400">
                Time Left: {Math.max(0, Math.floor((gameState.discussionEndTime - Date.now()) / 1000))}s
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden relative">
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
              {gameState.messages.length === 0 && gameState.phase === 'PLAYING' && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                  <Info size={48} className="mb-4" />
                  <p className="font-bold uppercase">Waiting for the first description...</p>
                </div>
              )}
              
              {gameState.messages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex flex-col ${msg.playerId === myId ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase bg-black text-white px-1">R{msg.round}</span>
                    <span className="text-xs font-bold uppercase">{msg.playerName}</span>
                  </div>
                  <div className={`max-w-[80%] p-3 border-2 border-black font-bold ${
                    msg.playerId === myId ? 'bg-yellow-100 shadow-[-4px_4px_0px_0px_rgba(0,0,0,1)]' : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Phase Overlays */}
            <AnimatePresence>
              {gameState.phase === 'DISCUSSION' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-20"
                >
                  <Timer size={64} className="text-white mb-6 animate-pulse" />
                  <h2 className="text-4xl font-black text-white uppercase mb-4">Discussion Period</h2>
                  <p className="text-white/70 font-bold uppercase mb-8">Discuss who you think the imposter is!</p>
                  
                  <div className="flex flex-col items-center gap-4">
                    <button 
                      onClick={skipDiscussion}
                      disabled={me?.hasSkippedDiscussion || !me?.isAlive}
                      className="bg-emerald-400 border-2 border-black px-8 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50"
                    >
                      {me?.hasSkippedDiscussion ? 'Waiting for others...' : 'Skip Discussion'}
                    </button>
                    <p className="text-white text-xs font-bold uppercase">
                      {gameState.players.filter(p => p.isAlive && p.hasSkippedDiscussion).length} / {Math.ceil(gameState.players.filter(p => p.isAlive).length / 2) + 1} needed to skip
                    </p>
                  </div>
                </motion.div>
              )}

              {gameState.phase === 'VOTING' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white flex flex-col p-8 z-20"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <Vote size={32} />
                    <h2 className="text-3xl font-black uppercase">Who is the Imposter?</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    {gameState.players.filter(p => p.isAlive).map(p => (
                      <button
                        key={p.id}
                        onClick={() => vote(p.id)}
                        disabled={me?.hasVoted || !me?.isAlive}
                        className={`p-4 border-2 border-black font-black uppercase text-left flex items-center justify-between transition-all ${
                          me?.hasVoted ? 'opacity-50' : 'hover:bg-red-50 hover:border-red-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <User size={20} />
                          {p.name} {p.id === myId && '(YOU)'}
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => vote('skip')}
                      disabled={me?.hasVoted || !me?.isAlive}
                      className={`p-4 border-2 border-black font-black uppercase text-left flex items-center justify-between transition-all ${
                        me?.hasVoted ? 'opacity-50' : 'hover:bg-gray-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
                      }`}
                    >
                      Skip Vote
                    </button>
                  </div>

                  {me?.hasVoted && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <div className="bg-black text-white p-4 font-black uppercase mb-2">Vote Submitted</div>
                      <p className="font-bold uppercase opacity-50">Waiting for other players...</p>
                    </div>
                  )}
                </motion.div>
              )}

              {gameState.phase === 'RESULT' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-black text-white flex flex-col items-center justify-center p-8 z-30"
                >
                  <Trophy size={80} className="text-yellow-400 mb-6" />
                  <h2 className="text-6xl font-black uppercase mb-2 tracking-tighter">
                    {gameState.winner === 'CREW' ? 'Crew Wins!' : 'Imposter Wins!'}
                  </h2>
                  <p className="text-xl font-bold uppercase mb-8 opacity-70">
                    {gameState.winner === 'CREW' ? 'The imposter was caught!' : 'The imposter successfully blended in!'}
                  </p>

                  <div className="bg-white/10 border-2 border-white/20 p-8 rounded-lg mb-8 w-full max-w-md">
                    <div className="flex flex-col items-center gap-4">
                      <p className="text-xs font-black uppercase opacity-50">The Imposter was</p>
                      <div className="flex items-center gap-3">
                        <Skull size={24} className="text-red-500" />
                        <span className="text-3xl font-black uppercase">
                          {gameState.players.find(p => p.isImposter)?.name}
                        </span>
                      </div>
                      <div className="w-full h-px bg-white/20 my-2" />
                      <p className="text-xs font-black uppercase opacity-50">The Pokemon was</p>
                      <div className="flex flex-col items-center gap-2">
                        <img 
                          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${gameState.pokemonId}.png`}
                          alt="Pokemon"
                          className="w-32 h-32 object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-2xl font-black uppercase tracking-widest text-yellow-400">{pokemonName}</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => window.location.reload()}
                    className="bg-white text-black border-2 border-white px-8 py-4 font-black uppercase shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    Play Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area */}
            {gameState.phase === 'PLAYING' && (
              <div className="p-6 bg-gray-50 border-t-2 border-black">
                <form onSubmit={handleSendMessage} className="flex gap-4">
                  <input 
                    type="text" 
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={!isMyTurn || !me?.isAlive}
                    placeholder={isMyTurn ? "Describe the Pokemon in one sentence..." : "Waiting for your turn..."}
                    className="flex-1 border-2 border-black p-4 font-bold focus:outline-none focus:bg-yellow-50 disabled:opacity-50"
                  />
                  <button 
                    type="submit"
                    disabled={!isMyTurn || !me?.isAlive || !messageInput.trim()}
                    className="bg-black text-white border-2 border-black px-6 py-4 font-black uppercase flex items-center gap-2 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    <Send size={20} /> Send
                  </button>
                </form>
                {isMyTurn && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] font-black uppercase mt-2 text-red-500 animate-pulse"
                  >
                    It's your turn! Describe the Pokemon.
                  </motion.p>
                )}
              </div>
            )}
          </div>

          {/* Last Event Ticker */}
          {gameState.lastVotedOut && (
            <div className="mt-4 bg-red-100 border-2 border-red-500 p-3 flex items-center gap-3">
              <Info size={18} className="text-red-500" />
              <p className="text-sm font-bold uppercase text-red-700">
                Last Vote Result: <span className="font-black">{gameState.lastVotedOut}</span> was voted out.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
