import '@testing-library/jest-dom';

// Polyfill for HTMLDialogElement.showModal/close in jsdom
// jsdom (used by Vitest) doesn't implement the dialog API, so provide
// lightweight fallbacks for tests that use <dialog> elements.
// Extend the global HTMLDialogElement interface with method signatures
// matching the lib.dom definitions to avoid TypeScript duplicate-declaration errors.
declare global {
  interface HTMLDialogElement {
    showModal(): void;
    close(): void;
  }
}

if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
      this.setAttribute('aria-modal', 'true');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
      this.removeAttribute('aria-modal');
    };
  }
}

