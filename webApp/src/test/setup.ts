import '@testing-library/jest-dom';

// Polyfill ResizeObserver для JSDOM (react-window / виртуализация)
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}
