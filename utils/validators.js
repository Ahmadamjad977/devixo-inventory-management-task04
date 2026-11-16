/* utils/validators.js
   Input validation. Every function returns { errors, data }.
   - errors: an object like { email: 'Please enter a valid email.' } (empty when everything is fine)
   - data:   the cleaned values that are safe to use */

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Returns an error message when the password is weak, or '' when it is fine
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be 72 characters or less.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain a number.';
  return '';
}

function validateRegister(body) {
  const errors = {};
  const data = { name: text(body.name), email: text(body.email).toLowerCase(), password: body.password };

  if (data.name.length < 3 || data.name.length > 80) errors.name = 'Name must be 3 to 80 characters.';
  if (!emailPattern.test(data.email) || data.email.length > 150) errors.email = 'Please enter a valid email address.';

  const problem = passwordProblem(body.password);
  if (problem) errors.password = problem;

  if (body.confirmPassword !== body.password) errors.confirmPassword = 'Passwords do not match.';

  return { errors, data };
}

function validateLogin(body) {
  const errors = {};
  const data = { email: text(body.email).toLowerCase(), password: body.password };

  if (!emailPattern.test(data.email)) errors.email = 'Please enter a valid email address.';
  if (typeof data.password !== 'string' || data.password === '') errors.password = 'Password is required.';

  return { errors, data };
}

function validateProduct(body) {
  const errors = {};
  const data = {
    name: text(body.name),
    sku: text(body.sku).toUpperCase(),
    category_id: body.category_id === '' || body.category_id == null ? null : Number(body.category_id),
    price: Number(body.price),
    quantity: body.quantity === undefined || body.quantity === '' ? 0 : Number(body.quantity),
    reorder_level: body.reorder_level === undefined || body.reorder_level === '' ? 5 : Number(body.reorder_level),
    description: text(body.description),
  };

  if (data.name.length < 2 || data.name.length > 120) errors.name = 'Product name must be 2 to 120 characters.';
  if (!/^[A-Z0-9-]{3,30}$/.test(data.sku)) errors.sku = 'SKU must be 3 to 30 letters, numbers or hyphens.';
  if (data.category_id !== null && !Number.isInteger(data.category_id)) errors.category_id = 'Please choose a valid category.';
  if (!Number.isFinite(data.price) || data.price < 0 || data.price > 100000000) errors.price = 'Price must be a number from 0 to 100,000,000.';
  if (!Number.isInteger(data.quantity) || data.quantity < 0 || data.quantity > 1000000) errors.quantity = 'Quantity must be a whole number from 0 to 1,000,000.';
  if (!Number.isInteger(data.reorder_level) || data.reorder_level < 0 || data.reorder_level > 1000000) errors.reorder_level = 'Reorder level must be a whole number of 0 or more.';
  if (data.description.length > 500) errors.description = 'Description must be 500 characters or less.';

  data.price = Math.round(data.price * 100) / 100; // two decimals
  return { errors, data };
}

function validateCategory(body) {
  const errors = {};
  const data = { name: text(body.name) };
  if (data.name.length < 2 || data.name.length > 50) errors.name = 'Category name must be 2 to 50 characters.';
  return { errors, data };
}

function validateStock(body) {
  const errors = {};
  const data = { type: body.type, quantity: Number(body.quantity), note: text(body.note) };

  if (data.type !== 'in' && data.type !== 'out') errors.type = 'Choose Stock In or Stock Out.';
  if (!Number.isInteger(data.quantity) || data.quantity < 1 || data.quantity > 1000000) errors.quantity = 'Quantity must be a whole number of 1 or more.';
  if (data.note.length > 200) errors.note = 'Note must be 200 characters or less.';

  return { errors, data };
}

// Turns "5" or 5 into a safe positive integer, or returns the fallback
function toInt(value, fallback) {
  const number = parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

module.exports = {
  validateRegister, validateLogin, validateProduct, validateCategory, validateStock, toInt,
};
