/* config/db.js
   Creates one PostgreSQL connection pool that every route shares.
   The connection string comes from the DATABASE_URL environment variable. */

require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

// Online databases (Neon, Supabase...) need SSL. A local database does not.
const isLocal = !connectionString || /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5, // small pool, because serverless platforms start many short-lived instances
});

module.exports = pool;
