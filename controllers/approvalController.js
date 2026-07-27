// Handles the two-stage approval workflow:
// 1. Treasury Accountant reviews first (validates, forwards or sends back)
// 2. Director of Budget gives the final decision (approve, reject, or send back)

const pool = require('../config/db');

// Treasury Accountant sees requests waiting for their review
async function getAccountantQueue(req, res) {
  try {
    const result = await pool.query(
      `SELECT fr.*, d.name AS department_name, vh.name AS vote_head_name, u.full_name AS submitted_by_name
       FROM fund_requests fr
       JOIN departments d ON fr.department_id = d.department_id
       JOIN vote_heads vh ON fr.vote_head_id = vh.vote_head_id
       JOIN users u ON fr.submitted_by = u.user_id
       WHERE fr.status = 'pending'
       ORDER BY fr.created_at ASC`
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong fetching the queue' });
  }
}

// Director of Budget sees requests waiting for final decision
async function getDirectorQueue(req, res) {
  try {
    const result = await pool.query(
      `SELECT fr.*, d.name AS department_name, vh.name AS vote_head_name, u.full_name AS submitted_by_name
       FROM fund_requests fr
       JOIN departments d ON fr.department_id = d.department_id
       JOIN vote_heads vh ON fr.vote_head_id = vh.vote_head_id
       JOIN users u ON fr.submitted_by = u.user_id
       WHERE fr.status = 'director_review'
       ORDER BY fr.created_at ASC`
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong fetching the queue' });
  }
}

// Treasury Accountant's decision: forward to Director, reject, or send back for revision
async function accountantReview(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { decision, comment } = req.body; // decision: 'forward' | 'rejected' | 'sent_back'
    const { user_id } = req.user;

    const requestResult = await client.query(
      `SELECT * FROM fund_requests WHERE request_id = $1`,
      [id]
    );
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const fundRequest = requestResult.rows[0];
    if (fundRequest.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been reviewed' });
    }

    let newStatus;
    if (decision === 'forward') newStatus = 'director_review';
    else if (decision === 'rejected') newStatus = 'rejected';
    else if (decision === 'sent_back') newStatus = 'revision_requested';
    else return res.status(400).json({ message: 'Invalid decision' });

    await client.query('BEGIN');

    await client.query(
      `UPDATE fund_requests SET status = $1, updated_at = NOW() WHERE request_id = $2`,
      [newStatus, id]
    );

    await client.query(
      `INSERT INTO approvals (request_id, reviewed_by, decision, comment) VALUES ($1, $2, $3, $4)`,
      [id, user_id, decision === 'forward' ? 'approved' : decision, comment || null]
    );

    await client.query(
      `INSERT INTO audit_trail (user_id, action, request_id) VALUES ($1, $2, $3)`,
      [user_id, `Treasury Accountant: ${decision}`, id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Review recorded', new_status: newStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Something went wrong recording the review' });
  } finally {
    client.release();
  }
}

// Director of Budget's final decision: approve, reject, or send back for revision
async function directorReview(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { decision, comment } = req.body; // decision: 'approved' | 'rejected' | 'sent_back'
    const { user_id } = req.user;

    const requestResult = await client.query(
      `SELECT * FROM fund_requests WHERE request_id = $1`,
      [id]
    );
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }
    const fundRequest = requestResult.rows[0];
    if (fundRequest.status !== 'director_review') {
      return res.status(400).json({ message: 'This request is not awaiting director review' });
    }

    if (!['approved', 'rejected', 'sent_back'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid decision' });
    }

    const newStatus = decision === 'sent_back' ? 'revision_requested' : decision;

    await client.query('BEGIN');

    await client.query(
      `UPDATE fund_requests SET status = $1, updated_at = NOW() WHERE request_id = $2`,
      [newStatus, id]
    );

    // If finally approved, deduct the amount from the department's budget ceiling
    if (decision === 'approved') {
      await client.query(
        `UPDATE budget_ceilings SET amount_used = amount_used + $1
         WHERE department_id = $2 AND fiscal_year = '2025/2026'`,
        [fundRequest.amount, fundRequest.department_id]
      );
    }

    await client.query(
      `INSERT INTO approvals (request_id, reviewed_by, decision, comment) VALUES ($1, $2, $3, $4)`,
      [id, user_id, decision, comment || null]
    );

    await client.query(
      `INSERT INTO audit_trail (user_id, action, request_id) VALUES ($1, $2, $3)`,
      [user_id, `Director of Budget: ${decision}`, id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Decision recorded', new_status: newStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ message: 'Something went wrong recording the decision' });
  } finally {
    client.release();
  }
}

module.exports = { getAccountantQueue, getDirectorQueue, accountantReview, directorReview };
