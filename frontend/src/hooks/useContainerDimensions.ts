import { useState, useCallback, useEffect, useRef } from 'react';

interface Dimensions {
  width: number;
  height: number;
}

/**
 * A robust hook for measuring container dimensions using the callback ref pattern.
 *
 * Unlike useRef + useEffect, this guarantees notification when the element is attached
 * to the DOM, avoiding race conditions where the effect runs before the ref is set.
 *
 * @returns containerRef - Callback ref to attach to the container element
 * @returns width - Current measured width
 * @returns height - Current measured height
 * @returns ready - True when element is attached AND has positive dimensions
 */
export function useContainerDimensions() {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
  const [element, setElement] = useState<HTMLElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Callback ref pattern - guaranteed to fire when element mounts/unmounts
  const containerRef = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) return;

    const updateDimensions = () => {
      setDimensions({
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    };

    // Initial measurement
    updateDimensions();

    // Watch for resize changes
    observerRef.current = new ResizeObserver(updateDimensions);
    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [element]);

  // Ready when we have element AND positive dimensions
  const ready = element !== null && dimensions.width > 0;

  return {
    containerRef,
    width: dimensions.width,
    height: dimensions.height,
    ready,
  };
}
