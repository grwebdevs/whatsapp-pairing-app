import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import Boom from '@hapi/boom';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/generate-pair-code', limiter);

// Sessions directory
const SESSIONS_DIR = path.join(process.cwd(), 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Active connections storage
const activeConnections = {};

// Generate pair code endpoint
app.post('/api/generate-pair-code', async (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  try {
    const sessionId = uuidv4();
    const sessionDir = path.join(SESSIONS_DIR, sessionId);
    
    // Create session directory
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // Create WhatsApp connection with Baileys
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['Knight Bot', 'Chrome', '10.0']
    });
    
    // Store connection for later use
    activeConnections[sessionId] = { 
      sock, 
      phoneNumber, 
      status: 'connecting',
      createdAt: new Date()
    };
    
    // Listen for connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        // If QR code is available, store it
        activeConnections[sessionId].qr = qr;
        console.log(`QR generated for session ${sessionId}`);
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
        console.log(`Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
        
        if (!shouldReconnect) {
          activeConnections[sessionId].status = 'failed';
        }
      } else if (connection === 'open') {
        console.log(`Connection opened for session ${sessionId}`);
        activeConnections[sessionId].status = 'connected';
      }
    });
    
    // Listen for credential updates
    sock.ev.on('creds.update', saveCreds);
    
    // Request pairing code
    const code = await sock.requestPairingCode(phoneNumber.replace(/[^\d]/g, ''));
    
    // Return pairing code and session ID
    res.json({
      success: true,
      code,
      sessionId
    });
    
  } catch (error) {
    console.error('Error generating pair code:', error);
    res.status(500).json({ error: 'Failed to generate pair code' });
  }
});

// Check connection status endpoint
app.get('/api/check-status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const connection = activeConnections[sessionId];
  
  if (!connection) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    status: connection.status,
    qr: connection.qr || null
  });
});

// Get QR code endpoint
app.get('/api/get-qr/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const connection = activeConnections[sessionId];
  
  if (!connection) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (!connection.qr) {
    return res.status(404).json({ error: 'QR code not available yet' });
  }
  
  res.json({
    qr: connection.qr
  });
});

// Download credentials file endpoint
app.get('/api/download-creds/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const connection = activeConnections[sessionId];
  
  if (!connection) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (connection.status !== 'connected') {
    return res.status(400).json({ error: 'WhatsApp not connected yet' });
  }
  
  const credsPath = path.join(SESSIONS_DIR, sessionId, 'creds.json');
  
  if (!fs.existsSync(credsPath)) {
    return res.status(404).json({ error: 'Credentials file not found' });
  }
  
  // Read and send file
  const credsFile = fs.readFileSync(credsPath);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="creds.json"`);
  res.send(credsFile);
  
  // Schedule cleanup after download
  setTimeout(() => {
    cleanupSession(sessionId);
  }, 5000); // Clean up after 5 seconds
});

// Clean up session function
function cleanupSession(sessionId) {
  try {
    const connection = activeConnections[sessionId];
    
    // Close connection
    if (connection && connection.sock) {
      connection.sock.end();
    }
    
    // Delete session directory
    const sessionDir = path.join(SESSIONS_DIR, sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    
    // Remove from active connections
    delete activeConnections[sessionId];
    
    console.log(`Session ${sessionId} cleaned up`);
  } catch (error) {
    console.error('Error cleaning up session:', error);
  }
}

// Clean up old sessions (run every hour)
setInterval(() => {
  const now = new Date();
  Object.keys(activeConnections).forEach(sessionId => {
    const connection = activeConnections[sessionId];
    const ageInMinutes = (now - connection.createdAt) / 60000;
    
    // Clean up sessions older than 2 hours
    if (ageInMinutes > 120) {
      cleanupSession(sessionId);
    }
  });
}, 3600000); // Run every hour

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});