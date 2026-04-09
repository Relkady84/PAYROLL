const routes = new Map();

export function register(hash, handler) {
  routes.set(hash, handler);
}

export function navigate(hash) {
  window.location.hash = hash;
}

function handleRoute() {
  const hash    = window.location.hash || '#dashboard';
  const handler = routes.get(hash) ?? routes.get('#dashboard');
  if (handler) handler();

  // Sync active state on sidebar nav links and mobile bottom nav
  document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === hash);
  });
}

export function init() {
  window.addEventListener('hashchange', handleRoute);
  // Run on first load
  handleRoute();
}
