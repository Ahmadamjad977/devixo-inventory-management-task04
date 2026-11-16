/* dashboard.js - statistics, charts, low stock and recent activity */

(async function () {
  var esc = App.esc;

  function renderStats(stats) {
    var cards = [
      { label: 'Total Products', value: stats.total_products, type: '' },
      { label: 'Units in Stock', value: stats.total_units.toLocaleString('en-PK'), type: '' },
      { label: 'Inventory Value', value: App.money(stats.inventory_value), type: '' },
      { label: 'Low Stock', value: stats.low_stock, type: 'warn' },
      { label: 'Out of Stock', value: stats.out_of_stock, type: 'danger' },
    ];
    document.getElementById('stats').innerHTML = cards.map(function (card) {
      return '<div class="stat-card ' + card.type + '"><span class="stat-label">' + esc(card.label) +
        '</span><span class="stat-number">' + esc(card.value) + '</span></div>';
    }).join('');
  }

  // Bar chart: two bars (in and out) for each of the last 7 days
  function renderChart(days) {
    var box = document.getElementById('movementChart');
    var max = 0;
    days.forEach(function (day) { max = Math.max(max, day.stock_in, day.stock_out); });

    if (max === 0) {
      box.innerHTML = '<p class="empty-text">No stock movement in the last 7 days.</p>';
      return;
    }

    box.innerHTML = '<div class="chart">' + days.map(function (day) {
      return '<div class="chart-col" title="' + esc(day.label) + ': in ' + day.stock_in + ', out ' + day.stock_out + '">' +
        '<div class="chart-bars"><div class="chart-bar in" data-value="' + day.stock_in + '"></div>' +
        '<div class="chart-bar out" data-value="' + day.stock_out + '"></div></div>' +
        '<span class="chart-label">' + esc(day.label) + '</span></div>';
    }).join('') + '</div>';

    // Heights are set here (as a percentage of the biggest value)
    box.querySelectorAll('.chart-bar').forEach(function (bar) {
      bar.style.height = (Number(bar.dataset.value) / max * 100) + '%';
    });
  }

  function renderCategories(categories) {
    var box = document.getElementById('categoryBars');
    if (categories.length === 0) {
      box.innerHTML = '<p class="empty-text">No categories yet.</p>';
      return;
    }
    var max = Math.max.apply(null, categories.map(function (c) { return c.units; })) || 1;

    box.innerHTML = categories.map(function (category) {
      return '<div class="bar-row"><div class="bar-label"><span>' + esc(category.name) + '</span>' +
        '<span>' + category.units + ' units, ' + category.products + ' products</span></div>' +
        '<div class="bar"><span class="bar-fill" data-percent="' + (category.units / max * 100) + '"></span></div></div>';
    }).join('');

    box.querySelectorAll('.bar-fill').forEach(function (fill) {
      fill.style.width = fill.dataset.percent + '%';
    });
  }

  function renderLowStock(items) {
    var box = document.getElementById('lowStock');
    if (items.length === 0) {
      box.innerHTML = '<p class="empty-text">All products are well stocked.</p>';
      return;
    }
    box.innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Product</th><th class="num">Stock</th><th>Status</th></tr></thead><tbody>' +
      items.map(function (item) {
        var status = item.quantity === 0 ? 'out' : 'low';
        return '<tr><td><span class="product-name">' + esc(item.name) + '</span><br><span class="sku">' + esc(item.sku) + '</span></td>' +
          '<td class="num">' + item.quantity + ' / ' + item.reorder_level + '</td><td>' + App.statusBadge(status) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function renderActivity(items) {
    var list = document.getElementById('activityList');
    if (items.length === 0) {
      list.innerHTML = '<li class="empty-text">No activity yet.</li>';
      return;
    }
    list.innerHTML = items.map(function (item) {
      return '<li>' + esc(item.action) + '<span class="activity-time">' + esc(App.timeAgo(item.created_at)) + '</span></li>';
    }).join('');
  }

  try {
    var user = await App.start('dashboard', { title: 'Dashboard' });
    document.getElementById('welcome').textContent = 'Welcome back, ' + user.name + '!';

    var data = await App.api('/dashboard');
    renderStats(data.stats);
    renderChart(data.movements);
    renderCategories(data.byCategory);
    renderLowStock(data.lowStock);
    renderActivity(data.recentActivity);
  } catch (error) {
    App.toast(error.message, 'error');
  } finally {
    App.hideLoader();
  }
})();
