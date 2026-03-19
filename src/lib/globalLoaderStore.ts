type Listener = (activeRequests: number) => void;

let activeRequests = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener(activeRequests);
  }
}

export const globalLoaderStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(activeRequests);
    return () => {
      listeners.delete(listener);
    };
  },
  begin() {
    activeRequests += 1;
    notify();
  },
  end() {
    activeRequests = Math.max(0, activeRequests - 1);
    notify();
  },
  getCount() {
    return activeRequests;
  },
};

