/* routes/users.js  (admin only)
   GET    /api/users            - list all users
   PATCH  /api/users/:id/role   - make a user admin or staff
   DELETE /api/users/:id        - delete a user */

const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authRequired, requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY id');
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/role', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'User not found.' });
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }
    if (req.body.role !== 'admin' && req.body.role !== 'staff') {
      return res.status(400).json({ error: 'Role must be admin or staff.' });
    }

    const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING name', [req.body.role, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    await logActivity(req.user.id, `${req.user.name} changed the role of ${result.rows[0].name} to ${req.body.role}`);
    res.json({ message: 'Role updated.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'User not found.' });
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING name', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    await logActivity(req.user.id, `${req.user.name} deleted the user ${result.rows[0].name}`);
    res.json({ message: 'User deleted.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
