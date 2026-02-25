import express from 'express';
import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json());
const httpServer = createServer(app);
const PORT = 3000;

interface PublicRoom {
  id: string;
  hostName: string;
  playerCount: number;
  lastSeen: number;
}

let publicRooms: PublicRoom[] = [];

// Prune inactive rooms every minute
setInterval(() => {
  const now = Date.now();
  publicRooms = publicRooms.filter(room => now - room.lastSeen < 60000);
}, 60000);

async function startServer() {
  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/rooms/random", (req, res) => {
    if (publicRooms.length === 0) {
      return res.status(404).json({ message: "No public rooms available" });
    }
    const randomIndex = Math.floor(Math.random() * publicRooms.length);
    res.json(publicRooms[randomIndex]);
  });

  app.post("/api/rooms", (req, res) => {
    const { id, hostName, playerCount } = req.body;
    if (!id || !hostName) return res.status(400).json({ message: "Missing data" });
    
    const existingIndex = publicRooms.findIndex(r => r.id === id);
    if (existingIndex !== -1) {
      publicRooms[existingIndex] = { id, hostName, playerCount, lastSeen: Date.now() };
    } else {
      publicRooms.push({ id, hostName, playerCount, lastSeen: Date.now() });
    }
    res.json({ success: true });
  });

  app.delete("/api/rooms/:id", (req, res) => {
    publicRooms = publicRooms.filter(r => r.id !== req.params.id);
    res.json({ success: true });
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
