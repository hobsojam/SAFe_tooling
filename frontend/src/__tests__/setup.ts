import "@testing-library/jest-dom";

// Stub Vite's build-time define replacement for tests
(globalThis as unknown as Record<string, unknown>).__APP_VERSION__ = "0.0.0-test";

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

if (typeof HTMLDialogElement !== "undefined") {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
      this.setAttribute("aria-modal", "true");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
      this.removeAttribute("aria-modal");
    };
  }
}
