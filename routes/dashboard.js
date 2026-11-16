/* routes/dashboard.js
   GET /api/dashboard - all numbers for the dashboard in one request */

const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    // Run the independent queries at the same time
    const [stats, lowStock, byCategory, movements, activity] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total_products,
               COALESCE(SUM(quantity), 0)::int AS total_units,
               COALESCE(SUM(price * quantity), 0)::float AS inventory_value,
               (COUNT(*) FILTER (WHERE quantity > 0 AND quantity <= reorder_level))::int AS low_stock,
               (COUNT(*) FILTER (WHERE quantity = 0))::int AS out_of_stock
        FROM products`),

      pool.query(`
        SELECT id, name, sku, quantity, reorder_level
        FROM products WHERE quantity <= reorder_level
        ORDER BY quantity ASC, name ASC LIMIT 6`),

      pool.query(`
        SELECT c.name, COUNT(p.id)::int AS products, COALESCE(SUM(p.quantity), 0)::int AS units
        FROM categories c LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id ORDER BY units DESC, c.name`),

      // One row for each of the last 7 days, even when nothing happened that day
      pool.query(`
        SELECT to_char(d, 'Dy DD') AS label,
               COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'in'), 0)::int AS stock_in,
               COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'out'), 0)::int AS stock_out
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d
        LEFT JOIN stock_movements m ON m.created_at::date = d::date
        GROUP BY d ORDER BY d`),

      pool.query(`
        SELECT a.id, a.action, a.created_at, u.name AS user_name
        FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC, a.id DESC LIMIT 8`),
    ]);

    res.json({
      stats: stats.rows[0],
      lowStock: lowStock.rows,
      byCategory: byCategory.rows,
      movements: movements.rows,
      recentActivity: activity.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
