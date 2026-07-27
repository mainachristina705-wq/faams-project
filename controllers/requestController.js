// Handles creating fund requests and checking them against the budget.

const pool = require('../config/db');

// MDA Officer submits a new fund request
async function createRequest(req, res) {
  const client = await pool.connect();
  try {
    const { vote_head_id, amount, purpose } = req.body;
    const { user_id, department_id } = req.user; // comes from the login token

    if (!vote_head_id || !amount || !purpose) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    if (!department_id) {
      return res.status(400).json({ message: 'Your account has no department assigned' });
    }

    await client.query('BEGIN');

    // Check the department's budget ceiling for the current fiscal year
    const fiscalYear = '2025/2026'; // for now, fixed — can be made dynamic later
    const ceilingResult = await client.query(
      `SELECT * FROM budget_ceilings WHERE department_id = $1 AND fiscal_year = $2`,
      [department_id, fiscalYear]
    );

    if (ceilingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No budget ceiling set for your department this fiscal year' });
    }

    const ceiling = ceilingResult.rows[0];
    const remaining = parseFloat(ceiling.total_ceiling) - parseFloat(ceiling.amount_used);

    if (parseFloat(amount) > remaining) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Request exceeds remaining budget. Remaining balance: ${remaining.toFixed(2)}`,
      });
    }

    // Simple duplicate/similarity check: same department, same vote head,
    // similar amount (within 5%), submitted in the last 30 days
    const similarResult = await client.query(
      `SELECT request_id FROM fund_requests
       WHERE department_id = $1
         AND vote_head_id = $2
         AND ABS(amount - $3) <= ($3 * 0.05)
         AND created_at >= NOW() - INTERVAL '30 days'`,
      [department_id, vote_head_id, amount]
    );
    const isFlaggedDuplicate = similarResult.rows.length > 0;

    // Insert the new request
    const insertResult = await client.query(
      `INSERT INTO fund_requests
        (department_id, submitted_by, vote_head_id, amount, purpose, status, is_flagged_duplicate)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [department_id, user_id, vote_head_id, amount, purpose, isFlaggedDuplicate]
    );

    const newRequest = insertResult.rows[0];

    // Log it in the audit trail
    await client.query(
      `INSERT INTO audit_trail (user_id, action, request_id) VALUES ($1, $2, $3)`,
      [user_id, 'Submitted fund request', newRequest.request_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ request: newRequest });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Something went wrong submitting the request' });
  } finally {
    client.release();
  }
}

// MDA Officer views their own submitted requests
async function getMyRequests(req, res) {
  try {
    const { user_id } = req.user;
    const result = await pool.query(
      `SELECT fr.*, vh.name AS vote_head_name
       FROM fund_requests fr
       JOIN vote_heads vh ON fr.vote_head_id = vh.vote_head_id
       WHERE fr.submitted_by = $1
       ORDER BY fr.created_at DESC`,
      [user_id]
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong fetching your requests' });
  }
}

module.exports = { createRequest, getMyRequests };
