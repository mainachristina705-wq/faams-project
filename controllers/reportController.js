// Provides summary reports for Treasury Accountants, Directors, and Admins.

const pool = require('../config/db');

async function getSummaryReport(req, res) {
  try {
    const statusCounts = await pool.query(
      `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount),0) AS total_amount
       FROM fund_requests GROUP BY status`
    );

    const byDepartment = await pool.query(
      `SELECT d.name AS department_name,
              bc.total_ceiling,
              bc.amount_used,
              (bc.total_ceiling - bc.amount_used) AS remaining
       FROM budget_ceilings bc
       JOIN departments d ON bc.department_id = d.department_id
       WHERE bc.fiscal_year = '2025/2026'
       ORDER BY d.name`
    );

    const flaggedDuplicates = await pool.query(
      `SELECT COUNT(*)::int AS count FROM fund_requests WHERE is_flagged_duplicate = TRUE`
    );

    res.json({
      status_breakdown: statusCounts.rows,
      budget_by_department: byDepartment.rows,
      flagged_duplicate_count: flaggedDuplicates.rows[0].count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong generating the report' });
  }
}

module.exports = { getSummaryReport };
