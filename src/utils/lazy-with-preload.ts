import { type ComponentType, lazy } from 'react';

type Module<T> = { default: T };

/**
 * React.lazy that renders in the same pass once preload() has finished. A plain lazy suspends
 * on its first render even when its chunk is already downloaded.
 */
export function lazyWithPreload<T extends ComponentType>(load: () => Promise<Module<T>>) {
  let loaded: Module<T> | null = null;

  const preload = () =>
    load().then((module) => {
      loaded = module;
      return module;
    });

  const Component = lazy(() => {
    const module = loaded;
    if (!module) {
      return preload();
    }

    // React reads a thenable that resolves synchronously without suspending.
    const resolved = { then: (resolve: (value: Module<T>) => void) => resolve(module) };
    return resolved as unknown as Promise<Module<T>>;
  });

  return Object.assign(Component, { preload, isLoaded: () => loaded !== null });
}
