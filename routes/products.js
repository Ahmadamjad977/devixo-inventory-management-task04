/* routes/products.js
   GET    /api/products              - list with search, filters, sorting and pagination
   GET    /api/products/:id          - one product
   POST   /api/products              - add a product            (admin, staff)
   PUT    /api/products/:id          - edit a product           (admin, staff)
   DELETE /api/products/:id          - delete a product         (admin only)
   POST   /api/products/:id/stock    - stock in or stock out    (admin, staff)
   GET    /api/products/:id/movements - stock history of a product */

const express = require('express');
const pool = require('../config/db');
const { authRequired, requireRole } = require('../middleware/auth');
const { validateProduct, validateStock, toInt } = require('../utils/validators');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(authRequired); // every route below needs a logged in user

// Columns that the user may sort by (a fixed list, so no SQL can be injected)
const sortOptions = {
  newest: 'p.created_at DESC, p.id DESC',
  name: 'p.name ASC',
  price_low: 'p.price ASC, p.id ASC',
  price_high: 'p.price DESC, p.id ASC',
  stock_low: 'p.quantity ASC, p.id ASC',
  stock_high: 'p.quantity DESC, p.id ASC',
};

const selectColumns = `
  p.id, p.name, p.sku, p.description, p.price::float AS price, p.quantity, p.reorder_level,
  p.category_id, c.name AS category_name, p.created_at, p.updated_at,
  CASE WHEN p.quantity = 0 THEN 'out'
       WHEN p.quantity <= p.reorder_level THEN 'low'
       ELSE 'in' END AS status`;

router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const page = toInt(req.query.page, 1);
    const limit = Math.min(toInt(req.query.limit, 10), 50);
    const orderBy = sortOptions[req.query.sort] || sortOptions.newest;

    // Build the WHERE part step by step. Values go in $1, $2... (never joined into the text)
    const where = [];
    const params = [];

    if (search) {
      params.push('%' + search + '%');
      where.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
    }
    if (req.query.category && /^\d+$/.test(req.query.category)) {
      params.push(Number(req.query.category));
      where.push(`p.category_id = $${params.length}`);
    }
    if (req.query.status === 'out') where.push('p.quantity = 0');
    if (req.query.status === 'low') where.push('p.quantity > 0 AND p.quantity <= p.reorder_level');
    if (req.query.status === 'in') where.push('p.quantity > p.reorder_level');

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const from = 'FROM products p LEFT JOIN categories c ON c.id = p.category_id';

    const countResult = await pool.query(`SELECT COUNT(*) ${from} ${whereSql}`, params);
    const total = Number(countResult.rows[0].count);
    const pages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, pages);

    const listParams = [...params, limit, (currentPage - 1) * limit];
    const list = await pool.query(
      `SELECT ${selectColumns} ${from} ${whereSql} ORDER BY ${orderBy}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    res.json({ items: list.rows, total, page: currentPage, pages, limit });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Product not found.' });
    const result = await pool.query(
      `SELECT ${selectColumns} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// A message for a duplicate SKU (PostgreSQL error code 23505) and an unknown category (23503)
function databaseProblem(error, res) {
  if (error.code === '23505') {
    res.status(409).json({ error: 'This SKU is already used.', fields: { sku: 'Another product already uses this SKU.' } });
    return true;
  }
  if (error.code === '23503') {
    res.status(400).json({ error: 'The chosen category does not exist.', fields: { category_id: 'Please choose a valid category.' } });
    return true;
  }
  return false;
}

router.post('/', requireRole('admin', 'staff'), async (req, res, next) => {
  const { errors, data } = validateProduct(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // product and opening stock are saved together, or not at all
    const result = await client.query(
      `INSERT INTO products (name, sku, category_id, price, quantity, reorder_level, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [data.name, data.sku, data.category_id, data.price, data.quantity, data.reorder_level, data.description || null, req.user.id]
    );
    const productId = result.rows[0].id;

    if (data.quantity > 0) {
      await client.query(
        "INSERT INTO stock_movements (product_id, user_id, type, quantity, note) VALUES ($1, $2, 'in', $3, 'Opening stock')",
        [productId, req.user.id, data.quantity]
      );
    }
    await client.query('COMMIT');

    await logActivity(req.user.id, `${req.user.name} added product "${data.name}" (${data.sku})`);
    res.status(201).json({ id: productId, message: 'Product added.' });
  } catch (error) {
    await client.query('ROLLBACK');
    if (!databaseProblem(error, res)) next(error);
  } finally {
    client.release();
  }
});

router.put('/:id', requireRole('admin', 'staff'), async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Product not found.' });

    // Quantity is not edited here. It only changes through stock in / stock out, so the history stays correct.
    const { errors, data } = validateProduct({ ...req.body, quantity: 0 });
    delete errors.quantity;
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
    }

    const result = await pool.query(
      `UPDATE products SET name = $1, sku = $2, category_id = $3, price = $4, reorder_level = $5,
              description = $6, updated_at = now()
       WHERE id = $7 RETURNING id`,
      [data.name, data.sku, data.category_id, data.price, data.reorder_level, data.description || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });

    await logActivity(req.user.id, `${req.user.name} updated product "${data.name}" (${data.sku})`);
    res.json({ message: 'Product updated.' });
  } catch (error) {
    if (!databaseProblem(error, res)) next(error);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Product not found.' });

    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING name, sku', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });

    const product = result.rows[0];
    await logActivity(req.user.id, `${req.user.name} deleted product "${product.name}" (${product.sku})`);
    res.json({ message: 'Product deleted.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/stock', requireRole('admin', 'staff'), async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Product not found.' });

  const { errors, data } = validateStock(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Please fix the highlighted fields.', fields: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE locks the row, so two people cannot change the same stock at the same moment
    const found = await client.query('SELECT name, quantity FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found.' });
    }

    const product = found.rows[0];
    if (data.type === 'out' && data.quantity > product.quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Only ${product.quantity} units are in stock.`,
        fields: { quantity: `Only ${product.quantity} units are in stock.` },
      });
    }

    const newQuantity = data.type === 'in' ? product.quantity + data.quantity : product.quantity - data.quantity;
    await client.query('UPDATE products SET quantity = $1, updated_at = now() WHERE id = $2', [newQuantity, req.params.id]);
    await client.query(
      'INSERT INTO stock_movements (product_id, user_id, type, quantity, note) VALUES ($1, $2, $3, $4, $5)',
      [req.params.id, req.user.id, data.type, data.quantity, data.note || null]
    );
    await client.query('COMMIT');

    const label = data.type === 'in' ? 'added' : 'removed';
    await logActivity(req.user.id, `${req.user.name} ${label} ${data.quantity} units ${data.type === 'in' ? 'to' : 'from'} "${product.name}"`);
    res.json({ message: data.type === 'in' ? 'Stock added.' : 'Stock removed.', quantity: newQuantity });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.get('/:id/movements', async (req, res, next) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return res.json({ items: [] });
    const result = await pool.query(
      `SELECT m.id, m.type, m.quantity, m.note, m.created_at, u.name AS user_name
       FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.product_id = $1 ORDER BY m.created_at DESC, m.id DESC LIMIT 10`,
      [req.params.id]
    );
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
