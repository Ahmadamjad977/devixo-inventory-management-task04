/* register.js - the register form with a live password checklist */

(function () {
  var form = document.getElementById('registerForm');
  var formError = document.getElementById('formError');
  var button = document.getElementById('registerBtn');
  var rules = document.querySelectorAll('#passwordRules li');

  // Ticks each password rule while the user types
  form.elements.password.addEventListener('input', function () {
    var value = form.elements.password.value;
    var checks = {
      length: value.length >= 8,
      lower: /[a-z]/.test(value),
      upper: /[A-Z]/.test(value),
      number: /[0-9]/.test(value),
    };
    rules.forEach(function (item) {
      item.classList.toggle('ok', checks[item.dataset.rule]);
    });
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    formError.hidden = true;

    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    var password = form.elements.password.value;
    var confirmPassword = form.elements.confirmPassword.value;

    var errors = {};
    if (name.length < 3 || name.length > 80) errors.name = 'Name must be 3 to 80 characters.';
    if (!App.emailPattern.test(email)) errors.email = 'Please enter a valid email address.';
    var problem = App.passwordProblem(password);
    if (problem) errors.password = problem;
    if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
    if (App.showErrors(form, errors)) return;

    App.setLoading(button, true, 'Creating account...');
    try {
      await App.api('/auth/register', {
        method: 'POST',
        body: { name: name, email: email, password: password, confirmPassword: confirmPassword },
        noRedirect: true,
      });
      window.location.href = 'login.html?registered=1';
    } catch (error) {
      App.setLoading(button, false);
      if (error.fields) App.showErrors(form, error.fields);
      formError.textContent = error.message;
      formError.hidden = false;
    }
  });
})();
