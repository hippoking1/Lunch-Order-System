import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import cn from 'classnames';
import { useToast } from '../../hooks/useToast';
import type { ToastItem } from '../../types';

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
} as const;

const colorMap = {
  success: 'var(--success)',
  error: 'var(--error)',
  info: 'var(--accent)',
} as const;

function ToastEntry({ toast }: { toast: ToastItem }) {
  const removeToast = useToast((s) => s.removeToast);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    clearTimeout(timerRef.current);
    setTimeout(() => removeToast(toast.id), 300);
  }, [exiting, removeToast, toast.id]);

  useEffect(() => {
    const remaining = (toast.duration ?? 3000) - 300;
    if (remaining > 0) {
      timerRef.current = setTimeout(() => setExiting(true), remaining);
    }
    return () => clearTimeout(timerRef.current);
  }, [toast.duration]);

  useEffect(() => {
    if (exiting) {
      const t = setTimeout(() => removeToast(toast.id), 300);
      return () => clearTimeout(t);
    }
  }, [exiting, removeToast, toast.id]);

  const Icon = iconMap[toast.type];

  return (
    <div
      className={cn('toast', `toast-${toast.type}`, { 'toast-exit': exiting })}
      onClick={dismiss}
      role="alert"
    >
      <Icon
        className="toast-icon"
        size={20}
        color={colorMap[toast.type]}
      />
      <span>{toast.message}</span>
    </div>
  );
}

export default function Toast() {
  const toasts = useToast((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastEntry key={t.id} toast={t} />
      ))}
    </div>
  );
}
