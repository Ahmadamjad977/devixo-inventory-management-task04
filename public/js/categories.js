/* categories.js - list of categories. Admins can add, rename and delete. */

(async function () {
  var esc = App.esc;
  var isAdmin = false;
  var items = {};
  var deleteId = null;

  var tableBox = document.getElementById('tableBox');
  var categoryForm = document.getElementById('categoryForm');
  var renameDialog = document.getElementById('renameDialog');
  var renameForm = document.getElementById('renameForm');
  var deleteDialog = document.getElementById('deleteDialog');

  [renameDialog, deleteDialog].forEach(App.wireDialog);

  async function loadCategories() {
    tableBox.innerHTML = App.loadingRow('Loading categories...');
    try {
      var data = await App.api('/categories');
      items = {};
      data.items.forEach(function (category) { items[category.id] = category; });

      if (data.items.length === 0) {
        tableBox.innerHTML = '<p class="empty-text">No categories yet.</p>';
        return;
      }

      var rows = data.items.map(function (c) {
        return '<tr><td><span class="product-name">' + esc(c.name) + '</span></td>' +
          '<td class="num">' + c.product_count + '</td>' +
          '<td>' + esc(App.formatDate(c.created_at)) + '</td>' +
          '<td class="actions">' + (isAdmin
            ? '<button type="button" class="btn btn-small btn-light" data-action="rename" data-id="' + c.id + '">Rename</button>' +
              '<button type="button" class="btn btn-small btn-danger" data-action="delete" data-id="' + c.id + '">Delete</button>'
            : '<span class="muted">View only</span>') + '</td></tr>';
      }).join('');

      tableBox.innerHTML = '<table class="table"><thead><tr><th>Category</th><th class="num">Products</th>' +
        '<th>Created</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
    } catch (error) {
      tableBox.innerHTML = '<p class="empty-text">' + esc(error.message) + '</p>';
    }
  }

  tableBox.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var category = items[button.dataset.id];

    if (button.dataset.action === 'rename') {
      App.clearErrors(renameForm);
      renameForm.elements.id.value = category.id;
      renameForm.elements.name.value = category.name;
      renameDialog.showModal();
    }
    if (button.dataset.action === 'delete') {
      deleteId = category.id;
      document.getElementById('deleteText').textContent = 'Delete the category "' + category.name + '"?';
      deleteDialog.showModal();
    }
  });

  // Add a category
  categoryForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var name = categoryForm.elements.name.value.trim();

    var errors = {};
    if (name.length < 2 || name.length > 50) errors.name = 'Category name must be 2 to 50 characters.';
    if (App.showErrors(categoryForm, errors)) return;

    var button = document.getElementById('catAdd');
    App.setLoading(button, true, 'Adding...');
    try {
      var result = await App.api('/categories', { method: 'POST', body: { name: name } });
      categoryForm.reset();
      App.toast(result.message);
      loadCategories();
    } catch (error) {
      if (error.fields) App.showErrors(categoryForm, error.fields);
      else App.toast(error.message, 'error');
    } finally {
      App.setLoading(button, false);
    }
  });

  // Rename a category
  renameForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var name = renameForm.elements.name.value.trim();

    var errors = {};
    if (name.length < 2 || name.length > 50) errors.name = 'Category name must be 2 to 50 characters.';
    if (App.showErrors(renameForm, errors)) return;

    var button = document.getElementById('renameSave');
    App.setLoading(button, true, 'Saving...');
    try {
      var result = await App.api('/categories/' + renameForm.elements.id.value, { method: 'PUT', body: { name: name } });
      renameDialog.close();
      App.toast(result.message);
      loadCategories();
    } catch (error) {
      if (error.fields) App.showErrors(renameForm, error.fields);
      else App.toast(error.message, 'error');
    } finally {
      App.setLoading(button, false);
    }
  });

  // Delete a category
  document.getElementById('deleteConfirm').addEventListener('click', async function () {
    var button = document.getElementById('deleteConfirm');
    App.setLoading(button, true, 'Deleting...');
    try {
      var result = await App.api('/categories/' + deleteId, { method: 'DELETE' });
      deleteDialog.close();
      App.toast(result.message);
      loadCategories();
    } catch (error) {
      deleteDialog.close();
      App.toast(error.message, 'error');   // for example: "This category has 5 products..."
    } finally {
      App.setLoading(button, false);
    }
  });

  try {
    var user = await App.start('categories', { title: 'Categories' });
    isAdmin = user.role === 'admin';
    document.getElementById('addPanel').hidden = !isAdmin;   // staff cannot add categories
    await loadCategories();
  } catch (error) {
    App.toast(error.message, 'error');
  } finally {
    App.hideLoader();
  }
})();
