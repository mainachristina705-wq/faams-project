// This is the file that starts the whole backend "engine".
// Run it with: node server.js

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Allow the frontend (browser) to talk to this backend
app.use(cors());

// Allow the backend to understand data sent as JSON (the format forms will send)
app.use(express.json());

// A simple test route — visiting this in a browser confirms the server is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FAAMS backend is running' });
});

// Login and registration routes
app.use('/api/auth', require('./routes/authRoutes'));

// Public lookup lists (departments, vote heads) — no login required
app.use('/api/public', require('./routes/publicRoutes'));

// Fund request routes
app.use('/api/requests', require('./routes/requestRoutes'));

// Approval workflow routes
app.use('/api/approvals', require('./routes/approvalRoutes'));

// Reports
app.use('/api/reports', require('./routes/reportRoutes'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`FAAMS backend listening on port ${PORT}`);
});
