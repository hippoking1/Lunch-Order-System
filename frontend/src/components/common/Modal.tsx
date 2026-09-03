import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  // Convenience props for confirm/cancel pattern
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

export default function Modal({
  open = true,
  onClose,
  title,
  children,
  actions,
  onConfirm,
  confirmLabel = '確認',
  cancelLabel = '取消',
  variant = 'default',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const defaultActions = onConfirm ? (
    <>
      <button className="btn btn-ghost" onClick={onClose}>
        {cancelLabel}
      </button>
      <button
        className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
        onClick={onConfirm}
      >
        {confirmLabel}
      </button>
    </>
  ) : null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">{title}</div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions || defaultActions}</div>
      </div>
    </div>,
    document.body,
  );
}
