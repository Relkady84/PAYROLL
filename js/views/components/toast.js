const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'i',
  warning: '!'
};

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');

  toast.className   = `toast toast-${type}`;
  toast.innerHTML   = `
    <span class="toast-icon">${ICONS[type] ?? ICONS.info}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger CSS transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  });

  // Auto-remove
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3200);
}
