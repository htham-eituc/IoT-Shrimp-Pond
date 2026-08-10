import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getInitials } from "./userMenuModel";

interface UserMenuProps {
  displayName: string;
  pondId: string;
  onSignOutRequest(): void;
}

export function UserMenu({ displayName, pondId, onSignOutRequest }: UserMenuProps) {
  const { t } = useTranslation("dashboard");
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const signOutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => signOutRef.current?.focus());

    function closeAndRestoreFocus() {
      setOpen(false);
      triggerRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function requestSignOut() {
    triggerRef.current?.focus();
    setOpen(false);
    onSignOutRequest();
  }

  return (
    <div ref={rootRef} className="user-menu">
      <button
        ref={triggerRef}
        className="user-menu__trigger"
        type="button"
        aria-label={t("userMenu")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="user-menu__avatar" aria-hidden="true">{getInitials(displayName)}</span>
        <span className="user-menu__identity">
          <strong>{displayName}</strong>
          <small>{pondId}</small>
        </span>
        <ChevronDown className={open ? "user-menu__chevron user-menu__chevron--open" : "user-menu__chevron"} aria-hidden="true" />
      </button>

      {open && (
        <div id={menuId} className="user-menu__popover" role="menu" aria-label={t("account")}>
          <div className="user-menu__summary">
            <span className="user-menu__avatar" aria-hidden="true">{getInitials(displayName)}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{t("farmerRole")} · {pondId}</small>
            </span>
          </div>
          <button
            ref={signOutRef}
            className="user-menu__signout"
            type="button"
            role="menuitem"
            onClick={requestSignOut}
          >
            <LogOut aria-hidden="true" />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
