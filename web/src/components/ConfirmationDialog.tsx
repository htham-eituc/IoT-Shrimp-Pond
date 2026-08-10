import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConfirmationDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  icon?: ReactNode;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  busy = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const { t } = useTranslation("common");
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel]);

  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])');
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="confirmation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <section
        ref={dialogRef}
        className="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={trapFocus}
      >
        <span className="confirmation-dialog__icon" aria-hidden="true">{icon ?? <AlertTriangle />}</span>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
        </div>
        <div className="confirmation-dialog__actions">
          <button ref={cancelRef} className="button" type="button" disabled={busy} onClick={onCancel}>{t("cancel")}</button>
          <button className="button button--primary" type="button" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
