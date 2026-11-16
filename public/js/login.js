/* login.js - the login form */

(function () {
  var form = document.getElementById('loginForm');
  var formError = document.getElementById('formError');
  var notice = document.getElementById('notice');
  var button = document.getElementById('loginBtn');

  // Messages that come from other pages (for example after registering)
  var params = new URLSearchParams(window.location.search);
  if (params.get('registered')) {
    notice.textContent = 'Account created. You can log in now.';
    notice.hidden = false;
  }
  if (params.get('loggedout')) {
    notice.textContent = 'You have been logged out.';
    notice.hidden = false;
  }

  // A user who is already logged in does not need this page
  App.api('/auth/me', { noRedirect: true })
    .then(function () { window.location.replace('dashboard.html'); })
    .catch(function () { /* not logged in: stay here */ });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    formError.hidden = true;

    var email = form.elements.email.value.trim();
    var password = form.elements.password.value;

    // Check the fields in the browser first
    var errors = {};
    if (!App.emailPattern.test(email)) errors.email = 'Please enter a valid email address.';
    if (password === '') errors.password = 'Password is required.';
    if (App.showErrors(form, errors)) return;

    App.setLoading(button, true, 'Logging in...');
    try {
      await App.api('/auth/login', { method: 'POST', body: { email: email, password: password }, noRedirect: true });
      window.location.href = 'dashboard.html';
    } catch (error) {
      App.setLoading(button, false);
      if (error.fields) App.showErrors(form, error.fields);
      formError.textContent = error.message;
      formError.hidden = false;
    }
  });
})();
