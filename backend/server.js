const express = require('express');
const http = require('http');
const ws = require('ws');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5050;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json());

// Strip Vercel Service route prefix if present
app.use((req, res, next) => {
  if (req.url.startsWith('/_/backend')) {
    req.url = req.url.substring(10);
    if (!req.url.startsWith('/')) {
      req.url = '/' + req.url;
    }
  }
  next();
});

// --- Admin Authentication Middleware ---
const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-password'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

  if (token === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized: Invalid admin password" });
  }
};

// Simple endpoint to verify admin password on login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

// --- REST Endpoints ---

// Get all presentations
app.get('/api/presentations', adminAuth, (req, res) => {
  res.json(db.getAll());
});

// Get a single presentation
app.get('/api/presentations/:id', adminAuth, (req, res) => {
  const presentation = db.getById(req.params.id);
  if (!presentation) {
    return res.status(404).json({ error: "Presentation not found" });
  }
  res.json(presentation);
});

// Create a new presentation
app.post('/api/presentations', adminAuth, (req, res) => {
  const { title } = req.body;
  if (!title || title.trim() === "") {
    return res.status(400).json({ error: "Title is required" });
  }
  const newPres = db.create(title);
  res.status(201).json(newPres);
});

// Update a presentation (e.g. title, slide list, or general settings)
app.put('/api/presentations/:id', adminAuth, (req, res) => {
  const updated = db.update(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: "Presentation not found" });
  }
  
  // If slide list or something changed, we notify connected clients
  broadcastPresentationState(req.params.id);

  res.json(updated);
});

// Delete a presentation
app.delete('/api/presentations/:id', adminAuth, (req, res) => {
  const deleted = db.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Presentation not found" });
  }
  res.json({ message: "Presentation deleted successfully", deleted });
});

// Get presentation by join code (For Students)
app.get('/api/presentations/code/:code', (req, res) => {
  const presentation = db.getByCode(req.params.code);
  if (!presentation) {
    return res.status(404).json({ error: "Active session not found for this code" });
  }
  
  // Return presentation data but strip out submissions to prevent students seeing answers
  const sanitizedSlides = presentation.slides.map(s => ({
    id: s.id,
    type: s.type,
    question: s.question,
    options: s.options
  }));

  res.json({
    id: presentation.id,
    title: presentation.title,
    code: presentation.code,
    activeSlideIndex: presentation.activeSlideIndex,
    slide: sanitizedSlides[presentation.activeSlideIndex]
  });
});

// Clear slide votes
app.post('/api/presentations/:id/slides/:slideId/clear', adminAuth, (req, res) => {
  const updated = db.clearVotes(req.params.id, req.params.slideId);
  if (!updated) {
    return res.status(404).json({ error: "Presentation or slide not found" });
  }
  
  broadcastPresentationState(req.params.id);
  res.json({ message: "Votes cleared", presentation: updated });
});

// Create Server
const server = http.createServer(app);

// Create WebSocket Server
const wss = new ws.Server({ server });

// WebSocket connection routing
wss.on('connection', (socket) => {
  socket.isAlive = true;
  
  // Ping-pong for connection check
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('message', (messageStr) => {
    try {
      const message = JSON.parse(messageStr);
      
      switch (message.type) {
        case 'init':
          handleInit(socket, message);
          break;
        case 'slide_change':
          handleSlideChange(socket, message);
          break;
        case 'vote':
          handleVote(socket, message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  });

  socket.on('close', () => {
    // Clean up or log disconnect if necessary
  });
});

// Ping interval to clean up stale socket connections
const interval = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (socket.isAlive === false) {
      return socket.terminate();
    }
    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// Handle presenter or student initialization
function handleInit(socket, data) {
  socket.role = data.role; // 'presenter' or 'student'
  
  if (data.role === 'presenter') {
    // Validate admin password
    if (data.password !== ADMIN_PASSWORD) {
      socket.send(JSON.stringify({ type: 'error', message: 'Unauthorized: Invalid admin password' }));
      socket.close();
      return;
    }

    socket.presentationId = data.presentationId;
    console.log(`Presenter connected to presentation: ${data.presentationId}`);
    
    // Immediately send the full state (with votes) to the presenter
    const presentation = db.getById(data.presentationId);
    if (presentation) {
      socket.send(JSON.stringify({
        type: 'sync',
        presentation
      }));
    }
  } else if (data.role === 'student') {
    const presentation = db.getByCode(data.code);
    if (presentation) {
      socket.presentationId = presentation.id;
      socket.voterId = data.voterId;
      console.log(`Student (${data.voterId}) connected to session: ${presentation.id}`);
      
      // Immediately send current slide details (without answers from other students)
      const currentSlide = presentation.slides[presentation.activeSlideIndex];
      socket.send(JSON.stringify({
        type: 'slide_update',
        activeSlideIndex: presentation.activeSlideIndex,
        slide: currentSlide ? {
          id: currentSlide.id,
          type: currentSlide.type,
          question: currentSlide.question,
          options: currentSlide.options
        } : null
      }));
    } else {
      socket.send(JSON.stringify({ type: 'error', message: 'Presentation code invalid' }));
      socket.close();
    }
  }
}

// Handle slide index changes (from presenter)
function handleSlideChange(socket, data) {
  if (socket.role !== 'presenter') return;
  
  const presentationId = socket.presentationId;
  const newIndex = data.index;
  
  const presentation = db.getById(presentationId);
  if (!presentation || newIndex < 0 || newIndex >= presentation.slides.length) return;
  
  // Save updated slide index in DB
  db.update(presentationId, { activeSlideIndex: newIndex });
  
  // Broadcast to both presenter and students
  broadcastPresentationState(presentationId);
}

// Handle student voting
function handleVote(socket, data) {
  if (socket.role !== 'student') return;

  const presentationId = socket.presentationId;
  const { slideId, voterId, value } = data;

  const updatedPres = db.addVote(presentationId, slideId, voterId, value);
  if (!updatedPres) return;

  // Let student know vote was registered successfully
  socket.send(JSON.stringify({ type: 'vote_registered', slideId }));

  // Broadcast presentation changes (presenters will receive the updated votes)
  broadcastPresentationState(presentationId);
}

// Broadcasts state changes to all clients in the presentation room
function broadcastPresentationState(presentationId) {
  const presentation = db.getById(presentationId);
  if (!presentation) return;

  const currentSlide = presentation.slides[presentation.activeSlideIndex];
  
  wss.clients.forEach((client) => {
    if (client.readyState === ws.OPEN && client.presentationId === presentationId) {
      if (client.role === 'presenter') {
        // Send complete presentation data (includes all slides & submissions for charts)
        client.send(JSON.stringify({
          type: 'sync',
          presentation
        }));
      } else if (client.role === 'student') {
        // Send only current slide metadata (no other student submissions)
        client.send(JSON.stringify({
          type: 'slide_update',
          activeSlideIndex: presentation.activeSlideIndex,
          slide: currentSlide ? {
            id: currentSlide.id,
            type: currentSlide.type,
            question: currentSlide.question,
            options: currentSlide.options
          } : null
        }));
      }
    }
  });
}

// Start HTTP & WS Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
