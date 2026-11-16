/* index.js - the home address "/" sends you to the dashboard or to the login page */

(async function () {
  try {
    await App.api('/auth/me', { noRedirect: true });
    window.location.replace('/dashboard.html');
  } catch (error) {
    window.location.replace('/login.html');
  }
})();
