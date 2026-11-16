/* utils/activity.js
   Saves a line in the activity log ("Ali added product ...").
   The dashboard shows the latest lines as "Recent Activity". */

const pool = require('../config/db');

async function logActivity(userId, action, db = pool) {
  try {
    await db.query('INSERT INTO activity_log (user_id, action) VALUES ($1, $2)', [userId, action]);
  } catch (error) {
    // A logging problem must never break the real request
    console.error('Could not write activity log:', error.message);
  }
}

module.exports = { logActivity };
