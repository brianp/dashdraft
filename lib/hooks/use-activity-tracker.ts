'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActivityState, ActivityConfig } from '@/lib/ai/types';

/**
 * Default configuration for activity tracking
 */
const DEFAULT_CONFIG: ActivityConfig = {
  idleThreshold: 30_000,        // 30 seconds of no activity
  stuckThreshold: 45_000,       // 45 seconds to be considered stuck
  minimalProgressChars: 50,     // Less than 50 chars = minimal progress
  recentChangeWindow: 60_000,   // Look at changes in last 60 seconds
};

/**
 * Hook for tracking user editing activity
 *
 * Monitors user interactions to detect when they might be "stuck"
 * and could benefit from AI assistance.
 *
 * @param content - Current editor content
 * @param containerRef - Optional ref to the editor container for event binding
 * @param config - Optional configuration overrides
 */
export function useActivityTracker(
  content: string,
  containerRef?: React.RefObject<HTMLElement | null>,
  config: Partial<ActivityConfig> = {}
): ActivityState & { resetActivity: () => void } {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // State
  const [state, setState] = useState<ActivityState>({
    isIdle: false,
    isStuck: false,
    recentCharacterDelta: 0,
    timeSinceLastEdit: 0,
    contentLength: content.length,
  });

  // Refs for tracking without triggering re-renders
  const lastActivityRef = useRef<number>(Date.now());
  const lastContentRef = useRef<string>(content);
  const contentHistoryRef = useRef<Array<{ length: number; timestamp: number }>>([]);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Record activity event (user did something)
   */
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setState((prev) => ({
      ...prev,
      isIdle: false,
      isStuck: false,
      timeSinceLastEdit: 0,
    }));
  }, []);

  /**
   * Reset the activity tracker (e.g., when user dismisses AI panel)
   */
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    contentHistoryRef.current = [];
    setState({
      isIdle: false,
      isStuck: false,
      recentCharacterDelta: 0,
      timeSinceLastEdit: 0,
      contentLength: content.length,
    });
  }, [content.length]);

  /**
   * Track content changes
   */
  useEffect(() => {
    const now = Date.now();
    const prevContent = lastContentRef.current;
    const delta = Math.abs(content.length - prevContent.length);

    if (delta > 0) {
      // Content changed - record activity
      recordActivity();

      // Add to history
      contentHistoryRef.current.push({
        length: content.length,
        timestamp: now,
      });

      // Trim old history entries
      contentHistoryRef.current = contentHistoryRef.current.filter(
        (entry) => now - entry.timestamp < cfg.recentChangeWindow
      );
    }

    lastContentRef.current = content;
  }, [content, cfg.recentChangeWindow, recordActivity]);

  /**
   * Calculate recent character delta from history
   */
  const calculateRecentDelta = useCallback((): number => {
    const history = contentHistoryRef.current;
    if (history.length < 2) return 0;

    const oldest = history[0];
    const newest = history[history.length - 1];
    if (!oldest || !newest) return 0;

    return Math.abs(newest.length - oldest.length);
  }, []);

  /**
   * Update state periodically to check idle/stuck status
   */
  useEffect(() => {
    const updateState = () => {
      const now = Date.now();
      const timeSinceLastEdit = now - lastActivityRef.current;
      const recentDelta = calculateRecentDelta();

      const isIdle = timeSinceLastEdit >= cfg.idleThreshold;
      const isStuck =
        timeSinceLastEdit >= cfg.stuckThreshold &&
        recentDelta < cfg.minimalProgressChars;

      setState({
        isIdle,
        isStuck,
        recentCharacterDelta: recentDelta,
        timeSinceLastEdit,
        contentLength: content.length,
      });
    };

    // Update every second
    updateTimerRef.current = setInterval(updateState, 1000);

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
    };
  }, [cfg.idleThreshold, cfg.stuckThreshold, cfg.minimalProgressChars, calculateRecentDelta, content.length]);

  /**
   * Attach event listeners to track user activity
   */
  useEffect(() => {
    const handleActivity = () => {
      recordActivity();
    };

    const target = containerRef?.current || document;

    // Track various user interactions
    const events = ['keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach((event) => {
      target.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        target.removeEventListener(event, handleActivity);
      });
    };
  }, [containerRef, recordActivity]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
    };
  }, []);

  return { ...state, resetActivity };
}

/**
 * Simpler hook that just tracks idle state
 * Use when you only need basic idle detection
 */
export function useIdleDetection(
  idleThreshold: number = DEFAULT_CONFIG.idleThreshold
): { isIdle: boolean; reset: () => void } {
  const [isIdle, setIsIdle] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsIdle(false);
  }, []);

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      setIsIdle(false);
    };

    const checkIdle = () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity >= idleThreshold) {
        setIsIdle(true);
      }
    };

    // Listen for activity
    const events = ['keydown', 'mousedown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Check periodically
    timerRef.current = setInterval(checkIdle, 1000);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [idleThreshold]);

  return { isIdle, reset };
}
