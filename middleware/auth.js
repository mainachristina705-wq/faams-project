// This file checks that a request has a valid "pass" (token) before
// letting it through to protected parts of the system.

const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: 'No login token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired login token' });
    }
    req.user = user; // attaches the logged-in user's info to this request
    next();
  });
}

// Restricts a route to only specific roles, e.g. verifyRole('admin')
function verifyRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this' });
    }
    next();
  };
}

module.exports = { verifyToken, verifyRole };
