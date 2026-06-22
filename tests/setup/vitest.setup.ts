import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: query.includes("min-width: 720px"),
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    value: class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  });
}

if (typeof window !== "undefined" && !window.requestAnimationFrame) {
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => window.setTimeout(callback, 0),
  });
}

if (typeof window !== "undefined" && !window.cancelAnimationFrame) {
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value: (handle: number) => window.clearTimeout(handle),
  });
}
