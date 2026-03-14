/**
 * useUndoToast — A reusable hook that provides:
 *   - A toast notification with an optional "Undo" button
 *   - An undo history stack (last N actions)
 *
 * Usage:
 *   const { showToast, pushUndo, undoLast, history } = useUndoToast();
 *
 *   // After a destructive/state-changing action:
 *   pushUndo({ label: 'Deleted lead', restore: () => leadsAPI.create(savedData) });
 *   showToast('Lead deleted', 'undo');
 *
 *   // User clicks Undo:
 *   undoLast();   // calls the last restore() fn, removes it from stack
 */

import { useState, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'undo' | 'warning';

export interface UndoEntry {
  id: string;
  label: string;
  restore: () => Promise<void>;
  timestamp: number;
}

interface Toast {
  msg: string;
  type: ToastType;
  hasUndo: boolean;
}

interface UseUndoToastOptions {
  maxHistory?: number;      // default 10
  toastDuration?: number;   // ms, default 4500
}

export function useUndoToast(options: UseUndoToastOptions = {}) {
  const { maxHistory = 10, toastDuration = 4500 } = options;

  const [toast, setToast] = useState<Toast | null>(null);
  const [history, setHistory] = useState<UndoEntry[]>([]);
  const [undoing, setUndoing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearToast = useCallback(() => setToast(null), []);

  const showToast = useCallback(
    (msg: string, type: ToastType = 'success', hasUndo = false, duration?: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ msg, type, hasUndo });
      timerRef.current = setTimeout(clearToast, duration ?? toastDuration);
    },
    [toastDuration, clearToast]
  );

  /**
   * Push an undo-able action onto the history stack.
   * Call this BEFORE showing the toast so that the undo button works immediately.
   */
  const pushUndo = useCallback((entry: Omit<UndoEntry, 'id' | 'timestamp'>) => {
    const full: UndoEntry = { ...entry, id: `${Date.now()}-${Math.random()}`, timestamp: Date.now() };
    setHistory(prev => [full, ...prev].slice(0, maxHistory));
    return full.id;
  }, [maxHistory]);

  /**
   * Undo the most recent action and remove it from history.
   */
  const undoLast = useCallback(async () => {
    if (history.length === 0) return;
    const [entry, ...rest] = history;
    setUndoing(true);
    setHistory(rest);
    setToast(null);
    try {
      await entry.restore();
      showToast(`Undone: ${entry.label}`, 'success');
    } catch {
      showToast('Undo failed', 'error');
    } finally {
      setUndoing(false);
    }
  }, [history, showToast]);

  /**
   * Remove a specific history entry by id (e.g., after a save that makes undo meaningless).
   */
  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);

  return {
    toast,
    clearToast,
    showToast,
    pushUndo,
    undoLast,
    removeFromHistory,
    history,
    undoing,
    hasUndo: history.length > 0,
  };
}
