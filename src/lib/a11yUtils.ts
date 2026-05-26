// ──────────────────────────────────────────────
// Accessibility Utilities (non-component exports)
// Separated from accessibility.tsx to avoid Vite HMR
// "incompatible export" errors that cause blank page
// ──────────────────────────────────────────────

// Screen Reader Announcements (aria-live)
let liveRegionEl: HTMLElement | null = null;

function getLiveRegion(): HTMLElement {
  if (liveRegionEl) return liveRegionEl;
  let el = document.getElementById('a11y-live-region');
  if (!el) {
    el = document.createElement('div');
    el.id = 'a11y-live-region';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    document.body.appendChild(el);
  }
  liveRegionEl = el;
  return el;
}

let assertiveRegionEl: HTMLElement | null = null;

function getAssertiveRegion(): HTMLElement {
  if (assertiveRegionEl) return assertiveRegionEl;
  let el = document.getElementById('a11y-assertive-region');
  if (!el) {
    el = document.createElement('div');
    el.id = 'a11y-assertive-region';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    document.body.appendChild(el);
  }
  assertiveRegionEl = el;
  return el;
}

export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const region = priority === 'assertive' ? getAssertiveRegion() : getLiveRegion();
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

// Accessible Label Helpers
export function generateId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}
