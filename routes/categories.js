/* routes/categories.js
   GET    /api/categories       - all categories with the number of products (everyone)
   POST   /api/categories       - add     (admin only)
   PUT    /api/categories/:id   - rename  (admin only)
   DELETE /api/categories/:id   - delete  (admin only, only when it has no products) */

const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { validateCategory } = require('../utils/validators');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.created_at, COUNT(p.id)::int AS product_count
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id ORDER BY c.name`
    );
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { errors, data } = validateCategory(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
    }
    await pool.query('INSERT INTO categories (name) VALUES ($1)', [data.name]);
    await logActivity(req.user.id, `${req.user.name} added category "${data.name}"`);
    res.status(201).json({ message: 'Category added.' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This category already exists.', fields: { name: 'This category already exists.' } });
    }
    next(error);
  }
});

router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Category not found.' });
    const { errors, data } = validateCategory(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
    }
    const result = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING id', [data.name, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found.' });
    await logActivity(req.user.id, `${req.user.name} renamed a category to "${data.name}"`);
    res.json({ message: 'Category updated.' });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This category already exists.', fields: { name: 'This category already exists.' } });
    }
    next(error);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Category not found.' });

    const used = await pool.query('SELECT COUNT(*)::int AS total FROM products WHERE category_id = $1', [req.params.id]);
    if (used.rows[0].total > 0) {
      return res.status(409).json({ error: `This category has ${used.rows[0].total} products. Move or delete them first.` });
    }

    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING name', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found.' });

    await logActivity(req.user.id, `${req.user.name} deleted category "${result.rows[0].name}"`);
    res.json({ message: 'Category deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
