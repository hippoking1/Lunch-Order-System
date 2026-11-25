import { useEffect, useId, useRef, type ReactNode } from 'react';
import classNames from 'classnames';

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: number;
  className?: string;
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
  subtitle,
  children,
  actions,
  maxWidth,
  className,
  onConfirm,
  confirmLabel = '確認',
  cancelLabel = '取消',
  variant = 'default',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Safari fallback for closedby="any": require both pointerdown & pointerup outside dialog rect
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onPointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [open]);

  const defaultActions = onConfirm ? (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={onClose}
        autoFocus={variant === 'danger'}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
        onClick={onConfirm}
        autoFocus={variant !== 'danger'}
      >
        {confirmLabel}
      </button>
    </>
  ) : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={classNames('native-modal', className)}
      style={maxWidth ? { maxWidth } : undefined}
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = '';
        onClose();
      }}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <div>
            <h2 id={titleId} className="modal-title">
              {title}
            </h2>
            {subtitle && <p className="caption modal-subtitle">{subtitle}</p>}
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {(actions || defaultActions) && (
          <div className="modal-actions">{actions || defaultActions}</div>
        )}
      </div>
    </dialog>
  );
}
