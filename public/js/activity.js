/* activity.js - admin page: the full activity log with pagination */

(async function () {
  var esc = App.esc;
  var tableBox = document.getElementById('tableBox');
  var pagination = document.getElementById('pagination');

  async function loadPage(page) {
    tableBox.innerHTML = App.loadingRow('Loading activity...');
    pagination.innerHTML = '';
    try {
      var data = await App.api('/activity?page=' + page);

      if (data.items.length === 0) {
        tableBox.innerHTML = '<p class="empty-text">No activity yet.</p>';
        return;
      }

      var rows = data.items.map(function (item) {
        var date = new Date(item.created_at);
        return '<tr><td>' + esc(date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })) +
          '</td><td>' + esc(item.user_name || 'Unknown') + '</td><td>' + esc(item.action) + '</td></tr>';
      }).join('');

      tableBox.innerHTML = '<table class="table"><thead><tr><th>When</th><th>User</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table>';
      App.renderPagination(pagination, data.page, data.pages, loadPage);
    } catch (error) {
      tableBox.innerHTML = '<p class="empty-text">' + esc(error.message) + '</p>';
    }
  }

  try {
    await App.start('activity', { title: 'Activity Log', adminOnly: true });
    await loadPage(1);
  } catch (error) {
    App.toast(error.message, 'error');
  } finally {
    App.hideLoader();
  }
})();
