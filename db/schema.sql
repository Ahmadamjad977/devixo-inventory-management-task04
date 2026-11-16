-- ==========================================================
-- StockPilot - PostgreSQL database structure
-- Run this file once (or use: npm run db:setup).
-- It is safe to run again: it only creates what is missing.
-- ==========================================================

-- People who can log in. role: 'admin' (full access) or 'staff'
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,              -- never the real password
  role          VARCHAR(10)  NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Product groups, for example "Electronics"
CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The products in the warehouse
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120)   NOT NULL,
  sku           VARCHAR(30)    NOT NULL UNIQUE,     -- stock keeping unit, a unique product code
  category_id   INTEGER        REFERENCES categories(id) ON DELETE RESTRICT,
  price         NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  quantity      INTEGER        NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level INTEGER        NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),  -- "low stock" limit
  description   VARCHAR(500),
  created_by    INTEGER        REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Every stock change (stock in or stock out) is saved here
CREATE TABLE IF NOT EXISTS stock_movements (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  type       VARCHAR(3)  NOT NULL CHECK (type IN ('in', 'out')),
  quantity   INTEGER     NOT NULL CHECK (quantity > 0),
  note       VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at);

-- A readable history of what users did ("Recent Activity" on the dashboard)
CREATE TABLE IF NOT EXISTS activity_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
