/* routes/auth.js
   POST /api/auth/register  - create an account (role is always "staff")
   POST /api/auth/login     - log in, a cookie is set
   POST /api/auth/logout    - log out, the cookie is removed
   GET  /api/auth/me        - who is logged in? */

const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { authRequired, createToken, cookieOptions } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../utils/validators');
const { logActivity } = require('../utils/activity');

const router = express.Router();

// Stops someone from trying thousands of passwords
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.post('/register', loginLimiter, async (req, res, next) => {
  try {
    const { errors, data } = validateRegister(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered.', fields: { email: 'An account with this email already exists.' } });
    }

    // The password is hashed (10 rounds). The real password is never saved.
    const hash = await bcrypt.hash(data.password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'staff') RETURNING id",
      [data.name, data.email, hash]
    );

    await logActivity(result.rows[0].id, `${data.name} created an account`);
    res.status(201).json({ message: 'Account created. You can log in now.' });
  } catch (error) {
    next(error);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { errors, data } = validateLogin(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [data.email]);
    const user = result.rows[0];

    // The same message for a wrong email and a wrong password, so nobody can find out which emails exist
    const passwordOk = user ? await bcrypt.compare(data.password, user.password_hash) : false;
    if (!passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.cookie('token', createToken(user), cookieOptions);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: cookieOptions.secure });
  res.json({ message: 'Logged out.' });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
