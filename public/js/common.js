/* ==========================================================
   StockPilot - common.js
   Helpers used by every page:
   - api()          talks to the server
   - App.start()    checks the login and builds the sidebar and top bar
   - toast()        short success or error messages
   - form helpers   show or clear error messages under fields
   ========================================================== */

var App = (function () {

  /* ---------- Small helpers ---------- */

  // Makes text safe before it is placed inside HTML (stops XSS)
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(value) {
    return 'Rs. ' + Number(value).toLocaleString('en-PK', { maximumFractionDigits: 2 });
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // "5 minutes ago", "3 hours ago", "2 days ago"
  function timeAgo(iso) {
    var seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(hours / 24);
    if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago');
    return formatDate(iso);
  }

  function statusBadge(status) {
    var labels = { in: 'In stock', low: 'Low stock', out: 'Out of stock' };
    return '<span class="badge badge-' + status + '">' + labels[status] + '</span>';
  }

  function roleBadge(role) {
    return '<span class="role-badge role-' + esc(role) + '">' + esc(role) + '</span>';
  }

  function loadingRow(text) {
    return '<div class="loading-row"><div class="spinner"></div><span>' + esc(text || 'Loading...') + '</span></div>';
  }


  /* ---------- Talking to the server ---------- */

  // Sends a request to /api/... and returns the answer.
  // If the server says "not logged in" (401) the user is sent to the login page.
  async function api(path, options) {
    options = options || {};
    var settings = {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (options.body !== undefined) {
      settings.body = JSON.stringify(options.body);
    }

    var response;
    try {
      response = await fetch('/api' + path, settings);
    } catch (networkError) {
      throw new Error('Cannot reach the server. Check your internet connection.');
    }

    var data = null;
    try {
      data = await response.json();
    } catch (parseError) {
      data = null;
    }

    if (response.status === 401 && !options.noRedirect) {
      window.location.href = '/login.html';
      throw new Error('Please log in to continue.');
    }

    if (!response.ok) {
      var error = new Error((data && data.error) || 'Something went wrong. Please try again.');
      error.fields = data && data.fields;
      error.status = response.status;
      throw error;
    }

    return data;
  }


  /* ---------- Messages ---------- */

  function toast(message, type) {
    var box = document.getElementById('toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      box.className = 'toast-box';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }

    var item = document.createElement('div');
    item.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    item.textContent = message;
    box.appendChild(item);

    setTimeout(function () {
      item.remove();
    }, 4000);
  }


  /* ---------- Forms ---------- */

  // Shows a message under each field. errors looks like { email: 'Not valid', name: '...' }
  function showErrors(form, errors) {
    clearErrors(form);
    var first = null;

    Object.keys(errors || {}).forEach(function (name) {
      var field = form.elements[name];
      if (!field) return;
      field.classList.add('invalid');
      var box = field.closest('.form-group').querySelector('.error-text');
      if (box) box.textContent = errors[name];
      if (!first) first = field;
    });

    if (first) first.focus();
    return first !== null;
  }

  function clearErrors(form) {
    form.querySelectorAll('.invalid').forEach(function (field) {
      field.classList.remove('invalid');
    });
    form.querySelectorAll('.error-text').forEach(function (box) {
      box.textContent = '';
    });
  }

  // Disables a button and shows a spinner while the server is working
  function setLoading(button, isLoading, loadingText) {
    if (isLoading) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="btn-spinner"></span>' + esc(loadingText || 'Please wait...');
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.label || button.innerHTML;
    }
  }

  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Returns an error message for a weak password, or '' when it is fine
  function passwordProblem(password) {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain a number.';
    return '';
  }

  // Closes a <dialog> when its X or Cancel button is clicked
  function wireDialog(dialog) {
    dialog.querySelectorAll('[data-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        dialog.close();
      });
    });
  }


  /* ---------- Pagination buttons ----------
     Draws Previous, page numbers and Next inside "container".
     onChange(pageNumber) is called when a button is clicked. */

  function renderPagination(container, page, pages, onChange) {
    container.innerHTML = '';
    if (pages <= 1) return;

    function addButton(label, target, disabled, current) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = disabled;
      if (current) button.className = 'current';
      button.addEventListener('click', function () { onChange(target); });
      container.appendChild(button);
    }

    addButton('Previous', page - 1, page === 1, false);
    for (var i = 1; i <= pages; i++) {
      // with many pages show only the first, the last and the pages around the current one
      if (pages > 7 && i !== 1 && i !== pages && Math.abs(i - page) > 1) {
        if (Math.abs(i - page) === 2) {
          var dots = document.createElement('span');
          dots.textContent = '...';
          container.appendChild(dots);
        }
        continue;
      }
      addButton(String(i), i, false, i === page);
    }
    addButton('Next', page + 1, page === pages, false);
  }


  /* ---------- Page layout (sidebar and top bar) ---------- */

  var navItems = [
    { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
    { key: 'products', label: 'Products', href: 'products.html' },
    { key: 'categories', label: 'Categories', href: 'categories.html' },
  ];
  var adminItems = [
    { key: 'activity', label: 'Activity Log', href: 'activity.html' },
    { key: 'users', label: 'Users', href: 'users.html' },
  ];

  function linkHtml(item, active) {
    return '<a href="' + item.href + '" class="side-link' + (item.key === active ? ' active' : '') + '">' + item.label + '</a>';
  }

  // Every protected page calls App.start('pageName').
  // It checks the login, builds the layout and removes the loading spinner.
  async function start(active, options) {
    options = options || {};
    var result = await api('/auth/me');
    var user = result.user;

    // Pages for admins only
    if (options.adminOnly && user.role !== 'admin') {
      window.location.href = '/dashboard.html';
      throw new Error('Admin only');
    }

    var menu = navItems.map(function (item) { return linkHtml(item, active); }).join('');
    if (user.role === 'admin') {
      menu += '<p class="side-title">Admin</p>' + adminItems.map(function (item) { return linkHtml(item, active); }).join('');
    }
    menu += '<p class="side-title">Account</p><a href="#" class="side-link" id="logoutLink">Logout</a>';

    var sidebar = document.getElementById('sidebar');
    sidebar.innerHTML =
      '<button class="sidebar-close" id="sidebarClose" aria-label="Close menu">&#10005;</button>' +
      '<a href="dashboard.html" class="brand"><span class="brand-mark">SP</span>' +
      '<span class="brand-text">StockPilot<small>Inventory Management</small></span></a>' +
      '<nav aria-label="Main menu">' + menu + '</nav>';

    document.getElementById('topbar').innerHTML =
      '<button class="menu-toggle" id="menuToggle" aria-label="Open menu">&#9776;</button>' +
      '<h1 class="page-title">' + esc(options.title || '') + '</h1>' +
      '<div class="user-box"><span class="user-name">' + esc(user.name) + '</span>' + roleBadge(user.role) + '</div>';

    // Logout
    document.getElementById('logoutLink').addEventListener('click', async function (event) {
      event.preventDefault();
      try {
        await api('/auth/logout', { method: 'POST' });
      } finally {
        window.location.href = '/login.html?loggedout=1';
      }
    });

    // Mobile menu
    var toggle = document.getElementById('menuToggle');
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    document.getElementById('sidebarClose').addEventListener('click', function () {
      sidebar.classList.remove('open');
    });
    document.querySelector('.main').addEventListener('click', function (event) {
      if (sidebar.classList.contains('open') && !toggle.contains(event.target)) {
        sidebar.classList.remove('open');
      }
    });

    return user;
  }

  function hideLoader() {
    var loader = document.getElementById('pageLoader');
    if (loader) loader.classList.add('hide');
  }

  return {
    esc: esc, money: money, formatDate: formatDate, timeAgo: timeAgo,
    statusBadge: statusBadge, roleBadge: roleBadge, loadingRow: loadingRow,
    api: api, toast: toast, showErrors: showErrors, clearErrors: clearErrors,
    setLoading: setLoading, emailPattern: emailPattern, passwordProblem: passwordProblem,
    wireDialog: wireDialog, renderPagination: renderPagination, start: start, hideLoader: hideLoader,
  };
})();
