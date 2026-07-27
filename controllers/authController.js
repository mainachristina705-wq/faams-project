// Handles account creation (register) and logging in.

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Create a new user account
async function register(req, res) {
  try {
    const { full_name, email, password, role, department_id } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Scramble the password before storing it — we never save plain text passwords
    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, department_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, full_name, email, role, department_id`,
      [full_name, email, password_hash, role, department_id || null]
    );

    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') { // duplicate email
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Something went wrong creating the account' });
  }
}

// Log in an existing user
async function login(req, res) {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Incorrect email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Incorrect email or password' });
    }

    // Create a signed "pass" containing the user's id and role
    const token = jwt.sign(
      { user_id: user.user_id, role: user.role, department_id: user.department_id },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong logging in' });
  }
}

module.exports = { register, login };
