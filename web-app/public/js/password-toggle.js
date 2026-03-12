(function () {
  function togglePassword(input, button) {
    if (!input) return;
    const isHidden = input.getAttribute('type') === 'password';
    input.setAttribute('type', isHidden ? 'text' : 'password');
    if (button) {
      button.textContent = isHidden ? '🙈' : '👁';
    }
  }

  document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
    const targetId = button.getAttribute('data-password-toggle');
    const input = document.getElementById(targetId);
    button.addEventListener('click', function () {
      togglePassword(input, button);
    });
  });
})();
