let _onConfirm = null;

export function openModal(title, bodyHTML, options = {}) {
  const {
    confirmLabel = 'Confirm',
    cancelLabel  = 'Cancel',
    onConfirm    = null,
    hideFooter   = false,
    danger       = false
  } = options;

  _onConfirm = onConfirm;

  const overlay     = document.getElementById('modal-overlay');
  const titleEl     = document.getElementById('modal-title');
  const bodyEl      = document.getElementById('modal-body');
  const footerEl    = document.getElementById('modal-footer');
  const confirmBtn  = document.getElementById('modal-confirm');
  const cancelBtn   = document.getElementById('modal-cancel');

  titleEl.textContent  = title;
  bodyEl.innerHTML     = bodyHTML;

  if (hideFooter) {
    footerEl.style.display = 'none';
  } else {
    footerEl.style.display = '';
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className   = danger ? 'btn btn-danger' : 'btn btn-primary';
    cancelBtn.textContent  = cancelLabel;
  }

  overlay.classList.add('active');

  // Auto-focus first interactive element
  requestAnimationFrame(() => {
    const first = bodyEl.querySelector('input, select, textarea, button');
    if (first) first.focus();
  });
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  _onConfirm = null;
}

export function initModal() {
  const overlay    = document.getElementById('modal-overlay');
  const confirmBtn = document.getElementById('modal-confirm');
  const cancelBtn  = document.getElementById('modal-cancel');
  const closeBtn   = document.getElementById('modal-close');

  // Close on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  // Close on ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal();
  });

  cancelBtn.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);

  confirmBtn.addEventListener('click', () => {
    if (_onConfirm) _onConfirm();
  });
}
