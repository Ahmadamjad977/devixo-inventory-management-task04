# StockPilot: Inventory Management System

**Devixo Solutions | Web Development Internship Program | Task 04**
**Student:** Muhammad Ahmad Mukhtar

StockPilot is a full-stack Inventory Management System. Staff can log in, manage products and categories, record stock in and stock out, search and filter the product list, and follow the stock situation on a dashboard. Admins can also manage users and read the activity log.

It is built with **HTML, CSS and vanilla JavaScript** (frontend), **Node.js and Express** (backend API) and **PostgreSQL** (database). No frontend framework is used.

**Live demo:** https://devixo-inventory-management-task04.vercel.app (after you deploy, see "Deployment")

## Features

### Authentication
- Register, login and logout
- Password validation (at least 8 characters, one uppercase letter, one lowercase letter, one number) with a live checklist
- Passwords are hashed with bcrypt, login uses a JWT stored in an httpOnly cookie
- Protected pages and protected API routes

### Database (CRUD)
- **Products:** create, read, update, delete
- **Categories:** create, read, rename, delete
- **Stock movements:** every stock in and stock out is saved with the user, the time and a note
- **Users:** list, change role, delete (admin)

### Dashboard
- Statistics cards: total products, units in stock, inventory value, low stock, out of stock
- Stock movement chart for the last 7 days
- Units by category
- Low stock alerts
- Recent activity
- Search bar

### Search, filters and data tables
- Search by product name, SKU or category
- Filter by category and by stock level (in stock, low stock, out of stock)
- Sort by newest, name, price or stock
- Pagination (10 products per page)

### UI / UX
- Responsive and mobile-friendly (sidebar becomes a slide-in menu, tables scroll inside their box)
- Loading indicators (page spinner, table loading text, spinner inside buttons)
- Messages for every success and error, validation messages under every field

### Security
- Input validation in the browser and on the server
- Parameterised SQL queries (no SQL injection)
- Content Security Policy and other security headers (Helmet)
- Output escaping against XSS
- Login rate limiting
- Error handling: the user sees clear messages, never technical details

### Bonus
- Role-based access (Admin and Staff)
- Admin pages: Users and Activity Log
- Search and pagination

| Action | Admin | Staff |
| --- | --- | --- |
| View dashboard, products, categories | Yes | Yes |
| Add and edit products, stock in and out | Yes | Yes |
| Delete products | Yes | No |
| Add, rename and delete categories | Yes | No |
| Users page and Activity Log | Yes | No |

Not included: email notifications, image upload and payment integration.

## Project Structure

```
devixo-inventory-management-task04/
├── api/index.js           # entry point for Vercel
├── app.js                 # Express app (security, routes, static files)
├── server.js              # starts the app on your computer
├── vercel.json
├── package.json
├── .env.example
├── config/db.js           # PostgreSQL connection
├── middleware/            # auth (login and roles) and error handler
├── utils/                 # validators and activity log helper
├── routes/                # auth, products, categories, dashboard, users, activity
├── db/schema.sql          # database tables
├── scripts/setup-db.js    # creates tables, demo accounts and sample data
├── public/                # the frontend
│   ├── *.html
│   ├── css/style.css
│   └── js/                # common.js and one script for each page
├── screenshots/
├── report/
└── README.md
```

## Run on Your Computer

You need **Node.js 18 or newer** and a **PostgreSQL** database.

1. Install the packages:
   ```bash
   npm install
   ```
2. Create a database (for example `stockpilot`) in PostgreSQL.
3. Copy `.env.example` to `.env` and write your values:
   ```
   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/stockpilot
   JWT_SECRET=any-long-random-text
   ```
4. Create the tables, the demo accounts and the sample products:
   ```bash
   npm run db:setup
   ```
5. Start the app:
   ```bash
   npm start
   ```
6. Open http://localhost:3000

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@example.com | Admin@123 |
| Staff | staff@example.com | Staff@123 |

New accounts created on the Register page always get the **Staff** role. An admin can promote a user on the Users page. The sample products, names and prices are fictional.

## Deployment (Vercel and Neon)

Vercel hosts the app and Neon (free PostgreSQL) hosts the database.

1. **Database:** create a free project at [neon.tech](https://neon.tech) and copy the connection string.
2. **Create the tables:** put the connection string in your local `.env` as `DATABASE_URL` and run `npm run db:setup` once. The tables, the demo accounts and the sample data are created in Neon.
3. **GitHub:** push the project (the `.env` file is ignored by `.gitignore`, so your secrets stay private).
4. **Vercel:** on [vercel.com](https://vercel.com) choose **Add New > Project**, import the GitHub repository and leave the framework as **Other**.
5. **Environment variables:** add `DATABASE_URL` (the Neon string) and `JWT_SECRET` (a long random text, create one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
6. Click **Deploy**. Open the Vercel link and log in with a demo account.

After deployment, change the demo passwords: log in as the admin, register your own account, promote it to admin on the Users page, log in with it and delete the two demo accounts.

## Screenshots

### Dashboard

![Dashboard](screenshots/dashboard.png)

### Products with search, filters and pagination

![Products](screenshots/products_list.png)

### Mobile

| Dashboard | Products | Menu |
| --- | --- | --- |
| ![Mobile dashboard](screenshots/mobile_dashboard.png) | ![Mobile products](screenshots/mobile_products.png) | ![Mobile menu](screenshots/mobile_menu_open.png) |

More screenshots (login, register, forms, stock window, categories, users, activity log, staff view) are in the `screenshots/` folder.

## API Overview

| Method and path | Who | Purpose |
| --- | --- | --- |
| POST /api/auth/register, /login, /logout | everyone | Authentication |
| GET /api/auth/me | logged in | Current user |
| GET /api/dashboard | logged in | Dashboard numbers |
| GET, POST /api/products | logged in (POST: admin, staff) | List with search, filters, sort and pagination, create |
| GET, PUT, DELETE /api/products/:id | logged in (DELETE: admin) | One product |
| POST /api/products/:id/stock | admin, staff | Stock in and stock out |
| GET /api/products/:id/movements | logged in | Stock history |
| GET, POST, PUT, DELETE /api/categories | logged in (changes: admin) | Categories |
| GET, PATCH, DELETE /api/users | admin | Manage users |
| GET /api/activity | admin | Activity log |

## Author

Muhammad Ahmad Mukhtar, BS Computer Science, The Superior University, Lahore.

- GitHub: https://github.com/Ahmadamjad977
- LinkedIn: https://www.linkedin.com/in/muhammad-ahmad-0543b0406
