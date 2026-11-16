/* routes/activity.js  (admin only)
   GET /api/activity?page=1 - the full activity log, 15 lines per page */

const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { toInt } = require('../utils/validators');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const limit = 15;
    const page = toInt(req.query.page, 1);

    const total = Number((await pool.query('SELECT COUNT(*) FROM activity_log')).rows[0].count);
    const pages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, pages);

    const result = await pool.query(
      `SELECT a.id, a.action, a.created_at, u.name AS user_name
       FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC, a.id DESC LIMIT $1 OFFSET $2`,
      [limit, (currentPage - 1) * limit]
    );

    res.json({ items: result.rows, total, page: currentPage, pages });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
