import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

/**
 * SecurityGuard — prevents right-click, DevTools, image saving, and deters screenshots.
 * All restrictions are SKIPPED for admin users.
 */
export default function SecurityGuard() {
  const { profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    // Skip all security for admin
    if (isAdmin) return;

    // 1. Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // 2. Disable DevTools keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') { e.preventDefault(); return; }
      // Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); return; }
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') { e.preventDefault(); return; }
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); return; }
      // Ctrl+S (Save Page)
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); return; }
      // Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); return; }
      // PrintScreen
      if (e.key === 'PrintScreen') { e.preventDefault(); return; }
    };

    // 3. Disable image dragging (prevents drag-to-desktop save)
    const handleDragStart = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement) {
        e.preventDefault();
      }
    };

    // 4. Blur content when tab loses focus (deters screenshot tools that minimize)
    const handleVisibilityChange = () => {
      const root = document.getElementById('root');
      if (!root) return;
      if (document.hidden) {
        root.style.filter = 'blur(20px)';
        root.style.transition = 'filter 0.1s';
      } else {
        root.style.filter = '';
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. Add CSS to disable text/image selection and prevent save
    const style = document.createElement('style');
    style.id = 'security-guard-styles';
    style.textContent = `
      body {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      img {
        -webkit-user-drag: none !important;
        -khtml-user-drag: none !important;
        -moz-user-drag: none !important;
        -o-user-drag: none !important;
        user-drag: none !important;
        pointer-events: none !important;
      }
      /* Allow text selection in input/textarea for usability */
      input, textarea, select, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const existingStyle = document.getElementById('security-guard-styles');
      if (existingStyle) existingStyle.remove();
      const root = document.getElementById('root');
      if (root) root.style.filter = '';
    };
  }, [isAdmin]);

  return null;
}
