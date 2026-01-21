'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from 'react';

// Debug logging - set to true to enable verbose friction detection logs
const DEBUG_FRICTION = process.env.NODE_ENV === 'development' &&
  (typeof window !== 'undefined' && window.localStorage.getItem('debug-friction') === 'true');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const debugLog = (...args: any[]) => {
  if (DEBUG_FRICTION) {
    console.debug('[Friction]', ...args);
  }
};

/**
 * Configuration for friction detection
 */
export interface FrictionConfig {
  /** Minimum document size in words to be eligible (default: 300) */
  minWords: number;
  /** Observation window before evaluating in ms (default: 5 minutes) */
  observationWindow: number;
  /** Threshold for net content change signal (default: 0.02 = 2%) */
  netChangeThreshold: number;
  /** Threshold for edit churn signal (default: 0.6) */
  churnThreshold: number;
  /** Time for cursor stagnation in ms (default: 90 seconds) */
  cursorStagnationTime: number;
  /** Line range for cursor stagnation (default: 3 lines) */
  cursorStagnationLines: number;
  /** Minimum signals needed to trigger (default: 2) */
  minSignalsToTrigger: number;
}

const DEFAULT_CONFIG: FrictionConfig = {
  minWords: 300,
  observationWindow: 5 * 60 * 1000, // 5 minutes
  netChangeThreshold: 0.02, // 2%
  churnThreshold: 0.6,
  cursorStagnationTime: 90 * 1000, // 90 seconds
  cursorStagnationLines: 3,
  minSignalsToTrigger: 2,
};

// Stable empty config to avoid new object reference each render
const EMPTY_CONFIG: Partial<FrictionConfig> = {};

/**
 * Friction signals being tracked
 */
export interface FrictionSignals {
  lowNetChange: boolean;
  highChurn: boolean;
  cursorStagnation: boolean;
  scrollWithoutProgress: boolean;
}

/**
 * State returned by the hook
 */
export interface FrictionState {
  /** Whether friction has been detected */
  frictionDetected: boolean;
  /** Individual signal states */
  signals: FrictionSignals;
  /** Number of active signals */
  signalCount: number;
  /** Whether still in observation window */
  inObservationWindow: boolean;
  /** Whether document is eligible (300+ words, existing) */
  isEligible: boolean;
  /** Whether the affordance has been shown this session */
  hasShownThisSession: boolean;
  /** Whether user has dismissed globally */
  isDisabledGlobally: boolean;
  /** Dismiss the affordance for this session */
  dismissForSession: () => void;
  /** Disable globally */
  disableGlobally: () => void;
  /** Reset (for when user saves or uses AI manually) */
  resetFriction: () => void;
  /** Mark as shown (call when hint actually renders) */
  markAsShown: () => void;
}

/**
 * Internal tracking state
 */
interface TrackingState {
  charsAdded: number;
  charsDeleted: number;
  initialDocLength: number;
  cursorLine: number;
  cursorLineEnteredAt: number;
  lineVisits: Map<number, number>;
  scrollCount: number;
  lastScrollTime: number;
  contentAtLastScroll: number;
}

/**
 * Hook for detecting writing friction in documents
 *
 * Monitors user behavior to detect when they might be struggling:
 * - Low net content change despite activity
 * - High edit churn (lots of deleting)
 * - Cursor stagnation on same lines
 * - Scrolling without making progress
 */
export function useWritingFriction(
  content: string,
  cursorLine: number,
  isNewFile: boolean,
  editorContainerRef: RefObject<HTMLElement | null>,
  config: Partial<FrictionConfig> = EMPTY_CONFIG
): FrictionState {
  // Memoize config by serializing to avoid object reference issues
  const configKey = JSON.stringify(config);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- using configKey instead of config object
  const cfg = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [configKey]);

  // Session state
  const [hasShownThisSession, setHasShownThisSession] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [globallyDisabled, setGloballyDisabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ai-assist-disabled') === 'true';
    }
    return false;
  });

  // Observation window state
  const [observationStarted, setObservationStarted] = useState<number | null>(null);
  const [inObservationWindow, setInObservationWindow] = useState(true);

  // Tracking refs (don't trigger re-renders)
  const trackingRef = useRef<TrackingState>({
    charsAdded: 0,
    charsDeleted: 0,
    initialDocLength: content.length,
    cursorLine: cursorLine,
    cursorLineEnteredAt: Date.now(),
    lineVisits: new Map(),
    scrollCount: 0,
    lastScrollTime: 0,
    contentAtLastScroll: content.length,
  });
  const lastContentRef = useRef(content);
  const recentActivityRef = useRef<number>(0);
  // Track if we've initialized (to skip counting initial content load)
  const isInitializedRef = useRef(false);
  const initialContentRef = useRef<string | null>(null);

  // Signal states
  const [signals, setSignals] = useState<FrictionSignals>({
    lowNetChange: false,
    highChurn: false,
    cursorStagnation: false,
    scrollWithoutProgress: false,
  });

  // Calculate word count
  const wordCount = useMemo(() => {
    return content.trim().split(/\s+/).filter(Boolean).length;
  }, [content]);

  // Check eligibility
  const isEligible = !isNewFile && wordCount >= cfg.minWords;

  // Debug: Log eligibility on changes
  useEffect(() => {
    debugLog('Eligibility check:', {
      isNewFile,
      wordCount,
      minWords: cfg.minWords,
      isEligible,
      globallyDisabled,
      sessionDismissed,
      hasShownThisSession,
    });
  }, [isNewFile, wordCount, cfg.minWords, isEligible, globallyDisabled, sessionDismissed, hasShownThisSession]);

  // Reset when file context changes (isNewFile toggles indicate different file)
  const prevIsNewFileRef = useRef(isNewFile);
  useEffect(() => {
    if (prevIsNewFileRef.current !== isNewFile) {
      debugLog('File context changed, resetting tracking');
      prevIsNewFileRef.current = isNewFile;
      isInitializedRef.current = false;
      initialContentRef.current = null;
      trackingRef.current = {
        charsAdded: 0,
        charsDeleted: 0,
        initialDocLength: 0,
        cursorLine: cursorLine,
        cursorLineEnteredAt: Date.now(),
        lineVisits: new Map(),
        scrollCount: 0,
        lastScrollTime: 0,
        contentAtLastScroll: 0,
      };
    }
  }, [isNewFile, cursorLine]);

  // Start observation window
  useEffect(() => {
    if (isEligible && !observationStarted) {
      debugLog('Starting observation window');
      setObservationStarted(Date.now());
    }
  }, [isEligible, observationStarted]);

  // Check if observation window has passed
  useEffect(() => {
    if (!observationStarted) return;

    const checkWindow = () => {
      const elapsed = Date.now() - observationStarted;
      const remaining = cfg.observationWindow - elapsed;
      debugLog('Observation window:', {
        elapsed: Math.round(elapsed / 1000) + 's',
        remaining: Math.round(remaining / 1000) + 's',
        windowDuration: Math.round(cfg.observationWindow / 1000) + 's',
      });
      if (elapsed >= cfg.observationWindow) {
        debugLog('Observation window COMPLETE - now evaluating signals');
        setInObservationWindow(false);
      }
    };

    const interval = setInterval(checkWindow, 10000); // Check every 10 seconds
    checkWindow();

    return () => clearInterval(interval);
  }, [observationStarted, cfg.observationWindow]);

  // Track content changes (skip initial load)
  useEffect(() => {
    const prevContent = lastContentRef.current;
    const tracking = trackingRef.current;

    // First time we see content, just record it as baseline (don't count as added)
    if (!isInitializedRef.current) {
      if (content.length > 0) {
        debugLog('Initializing with baseline content:', content.length, 'chars');
        isInitializedRef.current = true;
        initialContentRef.current = content;
        lastContentRef.current = content;
        tracking.initialDocLength = content.length;
        tracking.contentAtLastScroll = content.length;
      }
      return;
    }

    if (prevContent !== content) {
      const lengthDiff = content.length - prevContent.length;

      if (lengthDiff > 0) {
        tracking.charsAdded += lengthDiff;
        debugLog('Content added:', lengthDiff, 'chars. Total added:', tracking.charsAdded);
      } else {
        tracking.charsDeleted += Math.abs(lengthDiff);
        debugLog('Content deleted:', Math.abs(lengthDiff), 'chars. Total deleted:', tracking.charsDeleted);
      }

      // Mark recent activity
      recentActivityRef.current = Date.now();
    }

    lastContentRef.current = content;
  }, [content]);

  // Track cursor position
  useEffect(() => {
    const tracking = trackingRef.current;

    if (cursorLine !== tracking.cursorLine) {
      // Record visit to new line
      const visits = tracking.lineVisits.get(cursorLine) || 0;
      tracking.lineVisits.set(cursorLine, visits + 1);

      tracking.cursorLine = cursorLine;
      tracking.cursorLineEnteredAt = Date.now();
    }
  }, [cursorLine]);

  // Track scroll events on editor container
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) {
      debugLog('No editor container ref available for scroll tracking');
      return;
    }

    const handleScroll = (e: Event) => {
      const tracking = trackingRef.current;
      const now = Date.now();

      // Only count scrolls that are at least 500ms apart
      if (now - tracking.lastScrollTime > 500) {
        tracking.scrollCount++;
        tracking.lastScrollTime = now;
        tracking.contentAtLastScroll = content.length;
        debugLog('Scroll detected on', (e.target as Element)?.className, '- Count:', tracking.scrollCount);
      }
    };

    // Track which elements have listeners attached
    const attachedElements = new Set<Element>();

    const attachScrollListeners = () => {
      // Find CodeMirror scroll containers (most specific)
      const cmScrollers = container.querySelectorAll('.cm-scroller');

      // Find ProseMirror/TipTap editor containers
      const proseMirrorEditors = container.querySelectorAll('.ProseMirror');

      // Find any overflow-auto or overflow-y-auto elements
      const allElements = container.querySelectorAll('*');

      let newAttachments = 0;

      // Check each element for scrollability
      const checkAndAttach = (el: Element) => {
        if (attachedElements.has(el)) return;

        const style = window.getComputedStyle(el);
        const isScrollable =
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll' ||
          style.overflow === 'auto' ||
          style.overflow === 'scroll' ||
          el.classList.contains('cm-scroller') ||
          el.classList.contains('ProseMirror');

        if (isScrollable && el.scrollHeight > el.clientHeight) {
          el.addEventListener('scroll', handleScroll, { passive: true });
          attachedElements.add(el);
          newAttachments++;
          debugLog('Attached scroll listener to:', el.className || el.tagName);
        }
      };

      cmScrollers.forEach(checkAndAttach);
      proseMirrorEditors.forEach(checkAndAttach);
      allElements.forEach(checkAndAttach);

      if (newAttachments > 0) {
        debugLog('Total scroll listeners attached:', attachedElements.size);
      }
    };

    // Initial attachment
    attachScrollListeners();

    // Use MutationObserver to detect when editor elements are added
    const observer = new MutationObserver(() => {
      attachScrollListeners();
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    // Also retry after a delay in case editors initialize slowly
    const retryTimeout = setTimeout(attachScrollListeners, 1000);

    return () => {
      observer.disconnect();
      clearTimeout(retryTimeout);
      attachedElements.forEach(el => {
        el.removeEventListener('scroll', handleScroll);
      });
    };
  }, [editorContainerRef, content.length]);

  // Evaluate friction signals periodically
  useEffect(() => {
    if (!isEligible || inObservationWindow || sessionDismissed || globallyDisabled || hasShownThisSession) {
      debugLog('Signal evaluation SKIPPED:', {
        reason: !isEligible ? 'not eligible' :
                inObservationWindow ? 'in observation window' :
                sessionDismissed ? 'session dismissed' :
                globallyDisabled ? 'globally disabled' :
                hasShownThisSession ? 'already shown this session' : 'unknown',
        isEligible,
        inObservationWindow,
        sessionDismissed,
        globallyDisabled,
        hasShownThisSession,
      });
      return;
    }

    debugLog('Signal evaluation ACTIVE - will evaluate every 5s');

    const evaluateSignals = () => {
      const tracking = trackingRef.current;
      const now = Date.now();

      // Signal 1: Low net content change
      const netChange = tracking.charsAdded - tracking.charsDeleted;
      const netChangeRatio = Math.abs(netChange) / Math.max(tracking.initialDocLength, 1);
      const lowNetChange = tracking.charsAdded > 50 && netChangeRatio < cfg.netChangeThreshold;

      // Signal 2: High edit churn
      const churnRatio = tracking.charsDeleted / Math.max(tracking.charsAdded, 1);
      const highChurn = tracking.charsAdded > 30 && churnRatio > cfg.churnThreshold;

      // Signal 3: Cursor stagnation
      const timeOnCurrentLine = now - tracking.cursorLineEnteredAt;
      const cursorStagnation = timeOnCurrentLine > cfg.cursorStagnationTime;

      // Also check for repeated line visits
      let repeatedVisits = false;
      for (const [, visits] of tracking.lineVisits) {
        if (visits >= 5) {
          repeatedVisits = true;
          break;
        }
      }

      // Signal 4: Scroll without progress
      const scrollWithoutProgress =
        tracking.scrollCount >= 5 &&
        Math.abs(content.length - tracking.contentAtLastScroll) < 20;

      debugLog('Signal evaluation:', {
        tracking: {
          charsAdded: tracking.charsAdded,
          charsDeleted: tracking.charsDeleted,
          netChange,
          netChangeRatio: netChangeRatio.toFixed(4),
          churnRatio: churnRatio.toFixed(2),
          timeOnLine: Math.round(timeOnCurrentLine / 1000) + 's',
          scrollCount: tracking.scrollCount,
        },
        signals: {
          lowNetChange,
          highChurn,
          cursorStagnation: cursorStagnation || repeatedVisits,
          scrollWithoutProgress,
        },
        thresholds: {
          netChangeThreshold: cfg.netChangeThreshold,
          churnThreshold: cfg.churnThreshold,
          stagnationTime: cfg.cursorStagnationTime / 1000 + 's',
        },
      });

      setSignals({
        lowNetChange,
        highChurn,
        cursorStagnation: cursorStagnation || repeatedVisits,
        scrollWithoutProgress,
      });
    };

    const interval = setInterval(evaluateSignals, 5000); // Evaluate every 5 seconds
    evaluateSignals();

    return () => clearInterval(interval);
  }, [isEligible, inObservationWindow, sessionDismissed, globallyDisabled, hasShownThisSession, content.length, cfg.netChangeThreshold, cfg.churnThreshold, cfg.cursorStagnationTime]);

  // Calculate signal count
  const signalCount = useMemo(() => {
    return (
      (signals.lowNetChange ? 1 : 0) +
      (signals.highChurn ? 1 : 0) +
      (signals.cursorStagnation ? 1 : 0) +
      (signals.scrollWithoutProgress ? 1 : 0)
    );
  }, [signals]);

  // Friction detection state (set by effect, not computed during render)
  const [frictionDetected, setFrictionDetected] = useState(false);

  // Evaluate friction detection periodically (handles time-based checks)
  useEffect(() => {
    // If dismissed or disabled, hide and stop evaluating
    if (sessionDismissed || globallyDisabled) {
      setFrictionDetected(false);
      return;
    }

    // If already shown this session, don't evaluate anymore but DON'T hide
    // (the hint stays visible until user dismisses it)
    if (hasShownThisSession) {
      debugLog('Already shown this session, keeping current state');
      return;
    }

    // Check basic eligibility
    if (!isEligible || inObservationWindow) {
      setFrictionDetected(false);
      return;
    }

    const checkFriction = () => {
      // Check for recent activity (don't interrupt active editing)
      const timeSinceActivity = Date.now() - recentActivityRef.current;

      debugLog('Detection check:', {
        timeSinceActivity: Math.round(timeSinceActivity / 1000) + 's',
        waitingForInactivity: timeSinceActivity < 10000,
        signalCount,
        minSignalsToTrigger: cfg.minSignalsToTrigger,
        wouldTrigger: signalCount >= cfg.minSignalsToTrigger,
      });

      if (timeSinceActivity < 10000) {
        debugLog('Too recent activity, waiting...');
        setFrictionDetected(false);
        return;
      }

      // Check if enough signals are active
      const shouldShow = signalCount >= cfg.minSignalsToTrigger;

      if (shouldShow) {
        debugLog('>>> TRIGGERING FRICTION HINT <<<');
      }

      setFrictionDetected(shouldShow);
      // NOTE: We don't set hasShownThisSession here - the component must call markAsShown()
      // when it actually renders, to avoid marking as "shown" when it wasn't visible
    };

    // Check immediately and then periodically
    checkFriction();
    const interval = setInterval(checkFriction, 2000);

    return () => clearInterval(interval);
  }, [isEligible, inObservationWindow, sessionDismissed, globallyDisabled, hasShownThisSession, signalCount, cfg.minSignalsToTrigger]);

  // Callbacks
  const dismissForSession = useCallback(() => {
    setSessionDismissed(true);
  }, []);

  const markAsShown = useCallback(() => {
    debugLog('Hint actually shown to user, marking as shown');
    setHasShownThisSession(true);
  }, []);

  const disableGlobally = useCallback(() => {
    setGloballyDisabled(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-assist-disabled', 'true');
    }
  }, []);

  const resetFriction = useCallback(() => {
    debugLog('Resetting friction tracking');
    // Reset tracking state (called after save or manual AI use)
    trackingRef.current = {
      charsAdded: 0,
      charsDeleted: 0,
      initialDocLength: content.length,
      cursorLine: cursorLine,
      cursorLineEnteredAt: Date.now(),
      lineVisits: new Map(),
      scrollCount: 0,
      lastScrollTime: 0,
      contentAtLastScroll: content.length,
    };
    recentActivityRef.current = Date.now();
    // Reset initialization so next content change sets new baseline
    isInitializedRef.current = false;
    initialContentRef.current = null;
    lastContentRef.current = content;
  }, [content.length, cursorLine, content]);

  return {
    frictionDetected,
    signals,
    signalCount,
    inObservationWindow,
    isEligible,
    hasShownThisSession,
    isDisabledGlobally: globallyDisabled,
    dismissForSession,
    disableGlobally,
    resetFriction,
    markAsShown,
  };
}
