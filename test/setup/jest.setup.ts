import '@testing-library/jest-dom';

// Polyfill requestAnimationFrame for jsdom (only if missing)
if (typeof global.requestAnimationFrame === 'undefined') {
  (global as unknown as { requestAnimationFrame: (cb: FrameRequestCallback) => number }).requestAnimationFrame = (cb: FrameRequestCallback) => {
    const handle = setTimeout(() => cb(Date.now()), 16);
    return (handle as unknown as { [k: string]: unknown })['ref'] ? (handle as unknown as number) : (handle as unknown as number); // force number casting
  };
}
if (typeof global.cancelAnimationFrame === 'undefined') {
  (global as unknown as { cancelAnimationFrame: (id: number) => void }).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Minimal ResizeObserver mock
type ResizeObserverType = { observe: () => void; unobserve: () => void; disconnect: () => void };
if (typeof (global as unknown as { ResizeObserver?: ResizeObserverType }).ResizeObserver === 'undefined') {
  (global as unknown as { ResizeObserver: ResizeObserverType }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as ResizeObserverType;
}

// scrollTo polyfill for jsdom (Element & Window)
if (typeof window.scrollTo !== 'function') {
  window.scrollTo = () => {};
}
if (typeof (HTMLElement.prototype as unknown as { scrollTo?: unknown }).scrollTo !== 'function') {
  (HTMLElement.prototype as unknown as { scrollTo: (options?: ScrollToOptions | number, y?: number) => void }).scrollTo = function(options?: ScrollToOptions | number, y?: number) {
  interface Scrollable extends HTMLElement { scrollTop: number; scrollLeft: number }
  const self = this as unknown as Scrollable;
    if (typeof options === 'object' && options) {
  if (typeof options.top === 'number') self.scrollTop = options.top;
  if (typeof options.left === 'number') self.scrollLeft = options.left;
    } else if (typeof options === 'number') {
  self.scrollTop = options;
  if (typeof y === 'number') self.scrollLeft = y;
    }
  };
}
