/* middleware/auth.js
   Protects the API.
   authRequired  - the request must carry a valid login cookie
   requireRole   - the logged in user must have one of the given roles */

const jwt = require('jsonwebtoken');
const pool = require('../config/db');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not set');
    }
    return 'development-only-secret'; // only for local testing
  }
  return secret;
}

// Creates the login token that is stored in an httpOnly cookie
function createToken(user) {
  return jwt.sign({ id: user.id }, getSecret(), { expiresIn: '8h' });
}

const cookieOptions = {
  httpOnly: true,                                    // JavaScript in the browser cannot read it
  sameSite: 'lax',                                   // not sent with requests from other websites
  secure: process.env.NODE_ENV === 'production',     // https only when online
  maxAge: 8 * 60 * 60 * 1000,
};

async function authRequired(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }

  try {
    const payload = jwt.verify(token, getSecret());

    // Read the user again from the database, so a changed role or a deleted user is noticed at once
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [payload.id]);
    if (result.rows.length === 0) {
      res.clearCookie('token');
      return res.status(401).json({ error: 'Your account no longer exists.' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}

function requireRole(...roles) {
  return function (req, res, next) {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    next();
  };
}

module.exports = { authRequired, requireRole, createToken, cookieOptions };
