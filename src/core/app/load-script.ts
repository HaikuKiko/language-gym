/**
 * Loads a library from a web address (for example cdnjs) once, in the browser,
 * and gives back the global it creates. Used for the PDF reader and the map.
 * A failed load can be tried again.
 */
const loading = new Map<string, Promise<unknown>>();

export function loadScript<T>(src: string, globalName: string, failMessage: string): Promise<T> {
  const existing = (globalThis as Record<string, unknown>)[globalName];
  if (existing) return Promise.resolve(existing as T);

  let promise = loading.get(src) as Promise<T> | undefined;
  if (!promise) {
    promise = new Promise<T>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        const lib = (globalThis as Record<string, unknown>)[globalName];
        if (lib) resolve(lib as T);
        else {
          loading.delete(src);
          reject(new Error(failMessage));
        }
      };
      script.onerror = () => {
        loading.delete(src);
        script.remove();
        reject(new Error(`${failMessage} Check the internet connection and try again.`));
      };
      document.head.appendChild(script);
    });
    loading.set(src, promise);
  }
  return promise;
}

/** Adds a stylesheet from a web address once (for example the map's styles). */
export function loadStylesheet(href: string): void {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
