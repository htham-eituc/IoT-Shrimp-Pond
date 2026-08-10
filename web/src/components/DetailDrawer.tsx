import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DetailDrawerProps {
  title: string;
  size?: "medium" | "wide";
  children: ReactNode;
  onClose(): void;
}

export function DetailDrawer({ title, size = "medium", children, onClose }: DetailDrawerProps) {
  const { t } = useTranslation("common");
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !drawerRef.current?.querySelector('[role="alertdialog"]')) onClose();
    }

    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    );
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
    <div
      className="detail-drawer-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={drawerRef}
        className={`detail-drawer detail-drawer--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
      >
        <header className="detail-drawer__header">
          <h1 id={titleId}>{title}</h1>
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label={t("close")}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="detail-drawer__body">{children}</div>
      </section>
    </div>
  );
}
