/* users.js - admin page: change roles and delete users */

(async function () {
  var esc = App.esc;
  var me = null;
  var items = {};
  var deleteId = null;

  var tableBox = document.getElementById('tableBox');
  var deleteDialog = document.getElementById('deleteDialog');
  App.wireDialog(deleteDialog);

  async function loadUsers() {
    tableBox.innerHTML = App.loadingRow('Loading users...');
    try {
      var data = await App.api('/users');
      items = {};
      data.items.forEach(function (user) { items[user.id] = user; });

      var rows = data.items.map(function (u) {
        var actions;
        if (u.id === me.id) {
          actions = '<span class="muted">This is you</span>';
        } else {
          actions =
            '<select data-role-for="' + u.id + '" aria-label="Role of ' + esc(u.name) + '">' +
            '<option value="staff"' + (u.role === 'staff' ? ' selected' : '') + '>Staff</option>' +
            '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>Admin</option></select>' +
            '<button type="button" class="btn btn-small btn-outline" data-action="role" data-id="' + u.id + '">Save role</button>' +
            '<button type="button" class="btn btn-small btn-danger" data-action="delete" data-id="' + u.id + '">Delete</button>';
        }
        return '<tr><td><span class="product-name">' + esc(u.name) + '</span></td><td>' + esc(u.email) + '</td>' +
          '<td>' + App.roleBadge(u.role) + '</td><td>' + esc(App.formatDate(u.created_at)) + '</td>' +
          '<td class="actions">' + actions + '</td></tr>';
      }).join('');

      tableBox.innerHTML = '<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th>' +
        '<th>Registered</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table>';
    } catch (error) {
      tableBox.innerHTML = '<p class="empty-text">' + esc(error.message) + '</p>';
    }
  }

  tableBox.addEventListener('click', async function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var user = items[button.dataset.id];

    if (button.dataset.action === 'role') {
      var role = tableBox.querySelector('select[data-role-for="' + user.id + '"]').value;
      App.setLoading(button, true, 'Saving...');
      try {
        var result = await App.api('/users/' + user.id + '/role', { method: 'PATCH', body: { role: role } });
        App.toast(result.message);
        loadUsers();
      } catch (error) {
        App.setLoading(button, false);
        App.toast(error.message, 'error');
      }
    }

    if (button.dataset.action === 'delete') {
      deleteId = user.id;
      document.getElementById('deleteText').textContent = 'Delete the user "' + user.name + '"? They will not be able to log in again.';
      deleteDialog.showModal();
    }
  });

  document.getElementById('deleteConfirm').addEventListener('click', async function () {
    var button = document.getElementById('deleteConfirm');
    App.setLoading(button, true, 'Deleting...');
    try {
      var result = await App.api('/users/' + deleteId, { method: 'DELETE' });
      deleteDialog.close();
      App.toast(result.message);
      loadUsers();
    } catch (error) {
      deleteDialog.close();
      App.toast(error.message, 'error');
    } finally {
      App.setLoading(button, false);
    }
  });

  try {
    me = await App.start('users', { title: 'Users', adminOnly: true });
    await loadUsers();
  } catch (error) {
    App.toast(error.message, 'error');
  } finally {
    App.hideLoader();
  }
})();
