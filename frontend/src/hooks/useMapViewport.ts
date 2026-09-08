import { useState, useRef, useCallback, useEffect } from 'react';

export interface ViewportTransform {
  scale: number;
  x: number;
  y: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface FitToBoundsOptions {
  paddingRatio?: number; // default 0.10 (10% of container dimension on each side)
  minPadding?: number;   // default 55px
  minZoom?: number;      // default 0.10
  maxZoom?: number;      // default 2.2
}

export interface UseMapViewportOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  initialX?: number;
  initialY?: number;
}

export function useMapViewport(options?: UseMapViewportOptions) {
  const minScale = options?.minScale ?? 0.10;
  const maxScale = options?.maxScale ?? 5.0;

  const [viewport, setViewport] = useState<ViewportTransform>({
    scale: options?.initialScale ?? 1.0,
    x: options?.initialX ?? 0,
    y: options?.initialY ?? 0,
  });

  const viewportRef = useRef<ViewportTransform>({
    scale: options?.initialScale ?? 1.0,
    x: options?.initialX ?? 0,
    y: options?.initialY ?? 0,
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef<{ lastDist: number } | null>(null);

  /**
   * EXACT ZOOM-TO-POINT FORMULA:
   * Given cursorX, cursorY in container coordinates and a new target scale:
   * 1. Convert cursor to content coordinate space:
   *    contentX = (cursorX - offsetX) / scale
   *    contentY = (cursorY - offsetY) / scale
   * 2. Apply new scale (clamped).
   * 3. Recompute offset so the SAME content point lands under the cursor:
   *    newOffsetX = cursorX - contentX * newScale
   *    newOffsetY = cursorY - contentY * newScale
   * 4. Update scale and offset together in the exact same render tick.
   */
  const applyZoomAtPoint = useCallback(
    (cursorX: number, cursorY: number, targetScale: number) => {
      const current = viewportRef.current;
      const clampedScale = Math.max(minScale, Math.min(maxScale, targetScale));
      if (Math.abs(clampedScale - current.scale) < 0.0001) return;

      const contentX = (cursorX - current.x) / current.scale;
      const contentY = (cursorY - current.y) / current.scale;

      const newOffsetX = cursorX - contentX * clampedScale;
      const newOffsetY = cursorY - contentY * clampedScale;

      const next = { scale: clampedScale, x: newOffsetX, y: newOffsetY };
      viewportRef.current = next;
      setViewport(next);
    },
    [minScale, maxScale]
  );

  /**
   * FIT-TO-BOUNDS WITH SOURCE & DESTINATION SANITY CHECK:
   * Fits all points into the viewport with padding (8-10% of container).
   * Then performs a strict sanity check verifying critical points (source, destination, route stops)
   * fall strictly inside the visible viewport boundaries (with safe margin from all edges).
   */
  const fitToBounds = useCallback(
    (
      allPoints: Point2D[],
      criticalPoints: Point2D[] = [],
      opts?: FitToBoundsOptions
    ) => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth || 800;
      const ch = containerRef.current.clientHeight || 500;

      const ptsToFit = allPoints.length > 0 ? allPoints : criticalPoints;
      if (ptsToFit.length === 0) return;

      const paddingRatio = opts?.paddingRatio ?? 0.10;
      const minPadding = opts?.minPadding ?? 55;
      const fitMinZoom = opts?.minZoom ?? minScale;
      const fitMaxZoom = opts?.maxZoom ?? 2.2;

      // 1. Calculate bounding box of all points
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      ptsToFit.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      const bboxW = Math.max(maxX - minX, 120);
      const bboxH = Math.max(maxY - minY, 100);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // 2. Fixed padding margin (8-10% of container or minPadding)
      const padX = Math.max(minPadding, cw * paddingRatio);
      const padY = Math.max(minPadding, ch * paddingRatio);

      const availW = Math.max(cw - padX * 2, 80);
      const availH = Math.max(ch - padY * 2, 80);

      const scaleX = availW / bboxW;
      const scaleY = availH / bboxH;
      let finalScale = Math.max(fitMinZoom, Math.min(fitMaxZoom, Math.min(scaleX, scaleY)));

      let finalPanX = cw / 2 - centerX * finalScale;
      let finalPanY = ch / 2 - centerY * finalScale;

      // 3. SANITY CHECK: Verify all critical points (source, destination, route stops)
      // fall STRICTLY inside the visible viewport bounds.
      const critical = criticalPoints.length > 0 ? criticalPoints : ptsToFit;
      if (critical.length > 0) {
        let critMinX = Infinity;
        let critMaxX = -Infinity;
        let critMinY = Infinity;
        let critMaxY = -Infinity;

        critical.forEach((p) => {
          if (p.x < critMinX) critMinX = p.x;
          if (p.x > critMaxX) critMaxX = p.x;
          if (p.y < critMinY) critMinY = p.y;
          if (p.y > critMaxY) critMaxY = p.y;
        });

        const critW = Math.max(critMaxX - critMinX, 80);
        const critH = Math.max(critMaxY - critMinY, 80);

        // Safe margins for critical endpoints (at least 40px from edge or 8% of container)
        const safeMarginX = Math.max(40, cw * 0.08);
        const safeMarginY = Math.max(40, ch * 0.08);
        const safeW = Math.max(cw - safeMarginX * 2, 60);
        const safeH = Math.max(ch - safeMarginY * 2, 60);

        // If critical span exceeds safe viewport at finalScale, scale down to fit critical points
        if (critW * finalScale > safeW || critH * finalScale > safeH) {
          const maxCritScaleX = safeW / critW;
          const maxCritScaleY = safeH / critH;
          finalScale = Math.max(fitMinZoom, Math.min(finalScale, maxCritScaleX, maxCritScaleY));
          finalPanX = cw / 2 - centerX * finalScale;
          finalPanY = ch / 2 - centerY * finalScale;
        }

        // Check if endpoints fall within screen bounds, adjust pan if needed
        const screenCritMinX = finalPanX + critMinX * finalScale;
        const screenCritMaxX = finalPanX + critMaxX * finalScale;
        const screenCritMinY = finalPanY + critMinY * finalScale;
        const screenCritMaxY = finalPanY + critMaxY * finalScale;

        if (screenCritMinX < safeMarginX) {
          finalPanX += safeMarginX - screenCritMinX;
        } else if (screenCritMaxX > cw - safeMarginX) {
          finalPanX -= screenCritMaxX - (cw - safeMarginX);
        }

        if (screenCritMinY < safeMarginY) {
          finalPanY += safeMarginY - screenCritMinY;
        } else if (screenCritMaxY > ch - safeMarginY) {
          finalPanY -= screenCritMaxY - (ch - safeMarginY);
        }
      }

      const next = { scale: finalScale, x: finalPanX, y: finalPanY };
      viewportRef.current = next;
      setViewport(next);
    },
    [minScale]
  );

  // Scroll to Zoom Wheel Event with passive: false to prevent parent modal/page scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const targetScale = viewportRef.current.scale * zoomFactor;
      applyZoomAtPoint(cursorX, cursorY, targetScale);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [applyZoomAtPoint]);

  // Mouse Drag Handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, .tooltip-card, [data-no-pan]')) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - viewportRef.current.x,
      y: e.clientY - viewportRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setIsDragging((dragging) => {
      if (!dragging) return false;
      const next = {
        ...viewportRef.current,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      };
      viewportRef.current = next;
      setViewport(next);
      return true;
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch Handlers — single-finger pan + two-finger pinch-zoom anchored to midpoint
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      pinchRef.current = null;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - viewportRef.current.x,
        y: e.touches[0].clientY - viewportRef.current.y,
      };
    } else if (e.touches.length === 2 && containerRef.current) {
      setIsDragging(false);
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      pinchRef.current = { lastDist: dist };
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1 && !pinchRef.current) {
        const next = {
          ...viewportRef.current,
          x: e.touches[0].clientX - dragStartRef.current.x,
          y: e.touches[0].clientY - dragStartRef.current.y,
        };
        viewportRef.current = next;
        setViewport(next);
      } else if (e.touches.length === 2 && containerRef.current && pinchRef.current) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const rect = containerRef.current.getBoundingClientRect();

        const cursorX = (t0.clientX + t1.clientX) / 2 - rect.left;
        const cursorY = (t0.clientY + t1.clientY) / 2 - rect.top;

        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);

        if (pinchRef.current.lastDist > 0 && newDist > 0) {
          const zoomDelta = newDist / pinchRef.current.lastDist;
          const targetScale = viewportRef.current.scale * zoomDelta;
          applyZoomAtPoint(cursorX, cursorY, targetScale);
          pinchRef.current.lastDist = newDist;
        }
      }
    },
    [applyZoomAtPoint]
  );

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsDragging(false);
      pinchRef.current = null;
    } else if (e.touches.length === 1) {
      pinchRef.current = null;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX - viewportRef.current.x,
        y: e.touches[0].clientY - viewportRef.current.y,
      };
    }
  }, []);

  // Zoom Button Controls — anchor to viewport center
  const zoomIn = useCallback(
    (factor = 1.25) => {
      if (!containerRef.current) return;
      const centerX = containerRef.current.clientWidth / 2;
      const centerY = containerRef.current.clientHeight / 2;
      applyZoomAtPoint(centerX, centerY, viewportRef.current.scale * factor);
    },
    [applyZoomAtPoint]
  );

  const zoomOut = useCallback(
    (factor = 1.25) => {
      if (!containerRef.current) return;
      const centerX = containerRef.current.clientWidth / 2;
      const centerY = containerRef.current.clientHeight / 2;
      applyZoomAtPoint(centerX, centerY, viewportRef.current.scale / factor);
    },
    [applyZoomAtPoint]
  );

  const setManualTransform = useCallback((next: ViewportTransform) => {
    viewportRef.current = next;
    setViewport(next);
  }, []);

  return {
    viewport,
    viewportRef,
    containerRef,
    isDragging,
    applyZoomAtPoint,
    fitToBounds,
    zoomIn,
    zoomOut,
    setManualTransform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
