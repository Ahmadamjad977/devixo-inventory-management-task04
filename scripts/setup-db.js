/* scripts/setup-db.js
   Prepares the database. Run it once with:   npm run db:setup

   1. Creates the tables (db/schema.sql)
   2. Creates two demo accounts (admin and staff)
   3. Adds sample categories, products and stock history (only when there are no products yet)

   Use  node scripts/setup-db.js --schema-only  to create just the tables and the demo accounts. */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const schemaOnly = process.argv.includes('--schema-only');

// A small random number generator that always gives the same numbers,
// so every setup creates the same sample data
function makeRandom(seed) {
  let state = seed;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const categories = ['Electronics', 'Accessories', 'Networking', 'Office Supplies', 'Furniture'];

// [name, sku, category, price in Rs., reorder level, description]
const products = [
  ['Wireless Mouse', 'ACC-1001', 'Accessories', 1850, 10, 'Silent 2.4 GHz wireless mouse'],
  ['Mechanical Keyboard', 'ACC-1002', 'Accessories', 7900, 6, 'Blue switch, full size'],
  ['USB-C Charger 65W', 'ELC-2001', 'Electronics', 3650, 8, 'Fast charger for laptops and phones'],
  ['Laptop Stand', 'ACC-1003', 'Accessories', 2450, 6, 'Foldable aluminium stand'],
  ['HD Webcam 1080p', 'ELC-2002', 'Electronics', 5600, 5, 'Webcam with built-in microphone'],
  ['Bluetooth Speaker', 'ELC-2003', 'Electronics', 4200, 6, 'Portable speaker, 10 hours battery'],
  ['Wi-Fi Router AC1200', 'NET-3001', 'Networking', 6800, 5, 'Dual band wireless router'],
  ['Network Switch 8-Port', 'NET-3002', 'Networking', 4950, 4, 'Gigabit unmanaged switch'],
  ['Ethernet Cable 5m', 'NET-3003', 'Networking', 650, 20, 'Cat6 patch cable'],
  ['HDMI Cable 2m', 'ACC-1004', 'Accessories', 800, 15, 'High speed HDMI cable'],
  ['Power Bank 20000mAh', 'ELC-2004', 'Electronics', 6400, 8, 'Two USB ports and one USB-C'],
  ['Noise Cancelling Headphones', 'ELC-2005', 'Electronics', 15900, 4, 'Over-ear Bluetooth headphones'],
  ['A4 Copy Paper (500 sheets)', 'OFF-4001', 'Office Supplies', 1250, 30, '80 gsm white paper ream'],
  ['Ball Pen Box (50 pcs)', 'OFF-4002', 'Office Supplies', 950, 12, 'Blue ink ball pens'],
  ['Stapler Heavy Duty', 'OFF-4003', 'Office Supplies', 1450, 8, 'Staples up to 100 sheets'],
  ['Desk Organizer', 'OFF-4004', 'Office Supplies', 1700, 8, 'Wooden organizer with 5 compartments'],
  ['Whiteboard Markers (12)', 'OFF-4005', 'Office Supplies', 1100, 15, 'Assorted colours'],
  ['Sticky Notes Pack', 'OFF-4006', 'Office Supplies', 450, 25, '12 pads, 3 x 3 inch'],
  ['Ergonomic Office Chair', 'FUR-5001', 'Furniture', 28500, 3, 'Mesh back with lumbar support'],
  ['Standing Desk', 'FUR-5002', 'Furniture', 46000, 2, 'Height adjustable electric desk'],
  ['Bookshelf 4-Tier', 'FUR-5003', 'Furniture', 12500, 3, 'Metal and wood bookshelf'],
  ['Filing Cabinet', 'FUR-5004', 'Furniture', 18900, 3, 'Three drawer steel cabinet'],
  ['LED Desk Lamp', 'ELC-2006', 'Electronics', 2750, 8, 'Dimmable lamp with USB port'],
  ['External SSD 500GB', 'ELC-2007', 'Electronics', 13800, 5, 'USB 3.2 portable drive'],
  ['Flash Drive 64GB', 'ELC-2008', 'Electronics', 1350, 15, 'USB 3.0 flash drive'],
  ['Laptop Backpack', 'ACC-1005', 'Accessories', 4300, 6, 'Water resistant, 15.6 inch'],
  ['Wireless Presenter', 'ACC-1006', 'Accessories', 2300, 5, 'Laser pointer with slide control'],
  ['Cable Management Kit', 'ACC-1007', 'Accessories', 700, 10, 'Clips and sleeves'],
];

async function run() {
  console.log('Creating tables...');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);

  console.log('Creating demo accounts...');
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const staffHash = await bcrypt.hash('Staff@123', 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
       ('Store Admin', 'admin@example.com', $1, 'admin'),
       ('Demo Staff', 'staff@example.com', $2, 'staff')
     ON CONFLICT (email) DO NOTHING`,
    [adminHash, staffHash]
  );

  if (schemaOnly) {
    console.log('Done (schema only).');
    return;
  }

  const existing = await pool.query('SELECT COUNT(*)::int AS total FROM products');
  if (existing.rows[0].total > 0) {
    console.log('Products already exist, sample data skipped.');
    return;
  }

  console.log('Adding sample data...');
  const users = (await pool.query('SELECT id, name FROM users ORDER BY id')).rows;
  const admin = users.find((u) => u.name === 'Store Admin') || users[0];
  const staff = users.find((u) => u.name === 'Demo Staff') || users[0];
  const random = makeRandom(2026);

  for (const name of categories) {
    await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }
  const categoryRows = (await pool.query('SELECT id, name FROM categories')).rows;
  const categoryId = (name) => categoryRows.find((c) => c.name === name).id;

  for (let i = 0; i < products.length; i++) {
    const [name, sku, category, price, reorder, description] = products[i];
    const worker = i % 2 === 0 ? admin : staff;

    // Plan the stock history: opening stock first, then some sales and restocks in the last 7 days
    let quantity = Math.round(reorder * (3 + random() * 6)) + 2;
    const movements = [{ type: 'in', quantity, note: 'Opening stock', daysAgo: 14 - Math.floor(i / 3), hoursAgo: 3 }];
    const events = 2 + Math.floor(random() * 3);

    for (let e = 0; e < events; e++) {
      const daysAgo = Math.floor(random() * 7); // 0 to 6 days ago
      const hoursAgo = Math.floor(random() * 10);
      if (random() < 0.7 && quantity > 1) {
        const out = Math.max(1, Math.min(quantity, Math.round(quantity * (0.1 + random() * 0.3))));
        quantity -= out;
        movements.push({ type: 'out', quantity: out, note: 'Customer order', daysAgo, hoursAgo });
      } else {
        const incoming = Math.max(2, Math.round(reorder * (1 + random() * 2)));
        quantity += incoming;
        movements.push({ type: 'in', quantity: incoming, note: 'Supplier delivery', daysAgo, hoursAgo });
      }
    }

    // Make a few products low on stock or sold out, so the dashboard has something to show
    if (i % 7 === 3 && quantity > 0) {
      movements.push({ type: 'out', quantity, note: 'Bulk order', daysAgo: 0, hoursAgo: 1 });
      quantity = 0;
    } else if (i % 5 === 2 && quantity > reorder) {
      const out = quantity - Math.max(1, reorder - 1);
      movements.push({ type: 'out', quantity: out, note: 'Customer order', daysAgo: 1, hoursAgo: 2 });
      quantity -= out;
    }

    const createdDays = 14 - Math.floor(i / 3);
    const inserted = await pool.query(
      `INSERT INTO products (name, sku, category_id, price, quantity, reorder_level, description, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
               now() - make_interval(days => $9), now() - make_interval(days => $9))
       RETURNING id`,
      [name, sku, categoryId(category), price, quantity, reorder, description, worker.id, createdDays]
    );
    const productId = inserted.rows[0].id;

    for (const move of movements) {
      await pool.query(
        `INSERT INTO stock_movements (product_id, user_id, type, quantity, note, created_at)
         VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6, hours => $7))`,
        [productId, worker.id, move.type, move.quantity, move.note, move.daysAgo, move.hoursAgo]
      );

      // The recent movements also appear in the activity log
      if (move.note !== 'Opening stock') {
        const verb = move.type === 'in' ? `added ${move.quantity} units to` : `removed ${move.quantity} units from`;
        await pool.query(
          `INSERT INTO activity_log (user_id, action, created_at)
           VALUES ($1, $2, now() - make_interval(days => $3, hours => $4))`,
          [worker.id, `${worker.name} ${verb} "${name}"`, move.daysAgo, move.hoursAgo]
        );
      }
    }

    // The newest products also appear as "added product" lines
    if (i >= products.length - 6) {
      await pool.query(
        `INSERT INTO activity_log (user_id, action, created_at)
         VALUES ($1, $2, now() - make_interval(days => $3, hours => 5))`,
        [worker.id, `${worker.name} added product "${name}" (${sku})`, Math.max(0, products.length - 1 - i)]
      );
    }
  }

  console.log(`Done. ${products.length} sample products added.`);
  console.log('Admin: admin@example.com / Admin@123');
  console.log('Staff: staff@example.com / Staff@123');
}

run()
  .catch((error) => {
    console.error('Setup failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
