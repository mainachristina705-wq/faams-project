// Public, read-only lookup data used to populate dropdowns
// (department list for registration, vote head list for request forms).
// No sensitive data here, so no login required.

const pool = require('../config/db');

async function listDepartments(req, res) {
  try {
    const result = await pool.query('SELECT department_id, name FROM departments ORDER BY name');
    res.json({ departments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong fetching departments' });
  }
}

async function listVoteHeads(req, res) {
  try {
    const result = await pool.query('SELECT vote_head_id, code, name FROM vote_heads ORDER BY name');
    res.json({ vote_heads: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong fetching vote heads' });
  }
}

module.exports = { listDepartments, listVoteHeads };
