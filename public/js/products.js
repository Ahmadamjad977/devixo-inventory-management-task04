/* products.js - product list with search, filters, sorting, pagination,
   and the add / edit / stock / delete windows */

(async function () {
  var esc = App.esc;

  var state = { page: 1, search: '', category: '', status: '', sort: 'newest' };
  var items = {};          // the products on the screen, found by id
  var isAdmin = false;
  var deleteId = null;

  var tableBox = document.getElementById('tableBox');
  var resultInfo = document.getElementById('resultInfo');
  var pagination = document.getElementById('pagination');
  var searchInput = document.getElementById('searchInput');
  var categoryFilter = document.getElementById('categoryFilter');
  var statusFilter = document.getElementById('statusFilter');
  var sortSelect = document.getElementById('sortSelect');

  var productDialog = document.getElementById('productDialog');
  var productForm = document.getElementById('productForm');
  var stockDialog = document.getElementById('stockDialog');
  var stockForm = document.getElementById('stockForm');
  var deleteDialog = document.getElementById('deleteDialog');

  [productDialog, stockDialog, deleteDialog].forEach(App.wireDialog);


  /* ---------- Loading and drawing the table ---------- */

  async function loadProducts() {
    tableBox.innerHTML = App.loadingRow('Loading products...');
    pagination.innerHTML = '';

    var query = new URLSearchParams({
      page: state.page, search: state.search, category: state.category, status: state.status, sort: state.sort, limit: 10,
    });

    try {
      var data = await App.api('/products?' + query.toString());
      state.page = data.page;
      items = {};
      data.items.forEach(function (product) { items[product.id] = product; });
      drawTable(data);
    } catch (error) {
      tableBox.innerHTML = '<p class="empty-text">' + esc(error.message) + '</p>';
    }
  }

  function drawTable(data) {
    if (data.total === 0) {
      resultInfo.textContent = '';
      tableBox.innerHTML = '<p class="empty-text">No products found. Try a different search or filter.</p>';
      pagination.innerHTML = '';
      return;
    }

    var first = (data.page - 1) * data.limit + 1;
    resultInfo.textContent = 'Showing ' + first + ' to ' + (first + data.items.length - 1) + ' of ' + data.total + ' products';

    var rows = data.items.map(function (p) {
      return '<tr>' +
        '<td><span class="product-name">' + esc(p.name) + '</span></td>' +
        '<td><span class="sku">' + esc(p.sku) + '</span></td>' +
        '<td>' + esc(p.category_name || 'None') + '</td>' +
        '<td class="num">' + esc(App.money(p.price)) + '</td>' +
        '<td class="num">' + p.quantity + '</td>' +
        '<td>' + App.statusBadge(p.status) + '</td>' +
        '<td class="actions">' +
          '<button type="button" class="btn btn-small btn-outline" data-action="stock" data-id="' + p.id + '">Stock</button>' +
          '<button type="button" class="btn btn-small btn-light" data-action="edit" data-id="' + p.id + '">Edit</button>' +
          (isAdmin ? '<button type="button" class="btn btn-small btn-danger" data-action="delete" data-id="' + p.id + '">Delete</button>' : '') +
        '</td></tr>';
    }).join('');

    tableBox.innerHTML = '<table class="table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th>' +
      '<th class="num">Price</th><th class="num">In stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';

    App.renderPagination(pagination, data.page, data.pages, function (page) {
      state.page = page;
      loadProducts();
    });
  }

  // One click listener for all buttons inside the table
  tableBox.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var product = items[button.dataset.id];
    if (!product) return;

    if (button.dataset.action === 'edit') openProductForm(product);
    if (button.dataset.action === 'stock') openStock(product);
    if (button.dataset.action === 'delete') openDelete(product);
  });


  /* ---------- Search, filters and sorting ---------- */

  var searchTimer;
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);             // wait until the user stops typing
    searchTimer = setTimeout(function () {
      state.search = searchInput.value.trim();
      state.page = 1;
      loadProducts();
    }, 300);
  });

  function onFilterChange() {
    state.category = categoryFilter.value;
    state.status = statusFilter.value;
    state.sort = sortSelect.value;
    state.page = 1;
    loadProducts();
  }
  categoryFilter.addEventListener('change', onFilterChange);
  statusFilter.addEventListener('change', onFilterChange);
  sortSelect.addEventListener('change', onFilterChange);

  document.getElementById('resetBtn').addEventListener('click', function () {
    searchInput.value = '';
    categoryFilter.value = '';
    statusFilter.value = '';
    sortSelect.value = 'newest';
    state.search = '';
    onFilterChange();   // reloads the list with the cleared filters
  });


  /* ---------- Add and edit a product ---------- */

  function fillCategorySelects(categories) {
    categories.forEach(function (category) {
      categoryFilter.insertAdjacentHTML('beforeend', '<option value="' + category.id + '">' + esc(category.name) + '</option>');
      document.getElementById('pCategory').insertAdjacentHTML('beforeend', '<option value="' + category.id + '">' + esc(category.name) + '</option>');
    });
  }

  function openProductForm(product) {
    App.clearErrors(productForm);
    productForm.reset();
    var editing = !!product;

    document.getElementById('productDialogTitle').textContent = editing ? 'Edit Product' : 'Add Product';
    document.getElementById('quantityGroup').hidden = editing;   // stock of an existing product changes only with "Stock in / out"
    productForm.elements.id.value = editing ? product.id : '';

    if (editing) {
      productForm.elements.name.value = product.name;
      productForm.elements.sku.value = product.sku;
      productForm.elements.category_id.value = product.category_id || '';
      productForm.elements.price.value = product.price;
      productForm.elements.reorder_level.value = product.reorder_level;
      productForm.elements.description.value = product.description || '';
    } else {
      productForm.elements.reorder_level.value = 5;
      productForm.elements.quantity.value = 0;
    }
    productDialog.showModal();
  }

  document.getElementById('addBtn').addEventListener('click', function () { openProductForm(null); });

  productForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var f = productForm.elements;
    var editing = f.id.value !== '';

    var body = {
      name: f.name.value.trim(),
      sku: f.sku.value.trim().toUpperCase(),
      category_id: f.category_id.value === '' ? null : Number(f.category_id.value),
      price: f.price.value === '' ? NaN : Number(f.price.value),
      quantity: f.quantity.value === '' ? 0 : Number(f.quantity.value),
      reorder_level: f.reorder_level.value === '' ? 5 : Number(f.reorder_level.value),
      description: f.description.value.trim(),
    };

    // Check the fields in the browser (the server checks them again)
    var errors = {};
    if (body.name.length < 2 || body.name.length > 120) errors.name = 'Product name must be 2 to 120 characters.';
    if (!/^[A-Z0-9-]{3,30}$/.test(body.sku)) errors.sku = 'SKU must be 3 to 30 letters, numbers or hyphens.';
    if (isNaN(body.price) || body.price < 0) errors.price = 'Enter a price of 0 or more.';
    if (!editing && (!Number.isInteger(body.quantity) || body.quantity < 0)) errors.quantity = 'Enter a whole number of 0 or more.';
    if (!Number.isInteger(body.reorder_level) || body.reorder_level < 0) errors.reorder_level = 'Enter a whole number of 0 or more.';
    if (body.description.length > 500) errors.description = 'Description must be 500 characters or less.';
    if (App.showErrors(productForm, errors)) return;

    var button = document.getElementById('productSave');
    App.setLoading(button, true, 'Saving...');
    try {
      var result = await App.api(editing ? '/products/' + f.id.value : '/products', {
        method: editing ? 'PUT' : 'POST', body: body,
      });
      productDialog.close();
      App.toast(result.message);
      loadProducts();
    } catch (error) {
      if (error.fields) App.showErrors(productForm, error.fields);
      else App.toast(error.message, 'error');
    } finally {
      App.setLoading(button, false);
    }
  });


  /* ---------- Stock in and stock out ---------- */

  async function openStock(product) {
    App.clearErrors(stockForm);
    stockForm.reset();
    stockForm.elements.id.value = product.id;
    document.getElementById('stockProduct').innerHTML =
      '<strong>' + esc(product.name) + '</strong> <span class="sku">' + esc(product.sku) + '</span><br>' +
      'Current stock: <strong>' + product.quantity + '</strong> units ' + App.statusBadge(product.status);
    stockDialog.showModal();

    var history = document.getElementById('stockHistory');
    history.innerHTML = '<li>Loading...</li>';
    try {
      var data = await App.api('/products/' + product.id + '/movements');
      if (data.items.length === 0) {
        history.innerHTML = '<li>No stock history yet.</li>';
        return;
      }
      history.innerHTML = data.items.slice(0, 5).map(function (m) {
        var sign = m.type === 'in' ? '<span class="move-in">+' + m.quantity + '</span>' : '<span class="move-out">-' + m.quantity + '</span>';
        return '<li><span>' + sign + ' ' + esc(m.note || '') + '</span><span class="muted">' +
          esc(m.user_name || 'Unknown') + ', ' + esc(App.timeAgo(m.created_at)) + '</span></li>';
      }).join('');
    } catch (error) {
      history.innerHTML = '<li>Could not load the history.</li>';
    }
  }

  stockForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var f = stockForm.elements;
    var quantity = f.quantity.value === '' ? NaN : Number(f.quantity.value);

    var errors = {};
    if (!Number.isInteger(quantity) || quantity < 1) errors.quantity = 'Enter a whole number of 1 or more.';
    if (App.showErrors(stockForm, errors)) return;

    var button = document.getElementById('stockSave');
    App.setLoading(button, true, 'Updating...');
    try {
      var result = await App.api('/products/' + f.id.value + '/stock', {
        method: 'POST', body: { type: f.type.value, quantity: quantity, note: f.note.value.trim() },
      });
      stockDialog.close();
      App.toast(result.message);
      loadProducts();
    } catch (error) {
      if (error.fields) App.showErrors(stockForm, error.fields);
      else App.toast(error.message, 'error');
    } finally {
      App.setLoading(button, false);
    }
  });


  /* ---------- Delete (admin only) ---------- */

  function openDelete(product) {
    deleteId = product.id;
    document.getElementById('deleteText').textContent =
      'Delete "' + product.name + '" (' + product.sku + ')? Its stock history will be deleted too. This cannot be undone.';
    deleteDialog.showModal();
  }

  document.getElementById('deleteConfirm').addEventListener('click', async function () {
    var button = document.getElementById('deleteConfirm');
    App.setLoading(button, true, 'Deleting...');
    try {
      var result = await App.api('/products/' + deleteId, { method: 'DELETE' });
      deleteDialog.close();
      App.toast(result.message);
      loadProducts();
    } catch (error) {
      deleteDialog.close();
      App.toast(error.message, 'error');
    } finally {
      App.setLoading(button, false);
    }
  });


  /* ---------- Start ---------- */

  try {
    var user = await App.start('products', { title: 'Products' });
    isAdmin = user.role === 'admin';

    // A link from the dashboard can open the page with a search word or a filter
    var params = new URLSearchParams(window.location.search);
    if (params.get('search')) { state.search = params.get('search'); searchInput.value = state.search; }
    if (['in', 'low', 'out'].indexOf(params.get('status')) !== -1) { state.status = params.get('status'); statusFilter.value = state.status; }

    var categories = await App.api('/categories');
    fillCategorySelects(categories.items);
    await loadProducts();
  } catch (error) {
    App.toast(error.message, 'error');
  } finally {
    App.hideLoader();
  }
})();
