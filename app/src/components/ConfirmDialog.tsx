import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ConfirmOptions = {
  /** Dialog heading. */
  title: string;
  /** Body content — accepts dynamic values (amounts, addresses). */
  message: ReactNode;
  /** Primary button label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Secondary button label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Red styling for the primary button (destructive, irreversible). */
  danger?: boolean;
};

type ConfirmRequest = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false)
);

/** Promise-based confirmation. `await confirm({...})` — true = confirmed. */
export function useConfirm() {
  return useContext(ConfirmContext);
}

function ConfirmModal({
  request,
  onClose,
}: {
  request: ConfirmRequest;
  onClose: (ok: boolean) => void;
}) {
  const titleId = useId();
  const descId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const [busy, setBusy] = useState(false);

  // Focus management: remember trigger, move focus in, lock scroll.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the safe option (cancel) so Enter can't accidentally confirm.
    cancelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      (triggerRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  // Escape closes as cancellation. Never confirms.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Focus trap: keep Tab cycling inside the dialog.
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const card = cardRef.current;
    if (!card) return;
    const focusables = Array.from(
      card.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const decide = (ok: boolean) => {
    if (busy) return; // prevent duplicate submissions
    setBusy(true);
    onClose(ok);
  };

  return (
    <div
      className="mohar-modal-overlay"
      onClick={() => decide(false)}
      data-testid="confirm-overlay"
    >
      <div
        ref={cardRef}
        className="mohar-modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <h2 id={titleId} className="mohar-modal-title">
          {request.title}
        </h2>
        <div id={descId} className="mohar-confirm-body">
          {request.message}
        </div>
        <div className="mohar-confirm-actions">
          <button
            ref={cancelRef}
            className="btn btn-ghost"
            onClick={() => decide(false)}
            disabled={busy}
          >
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            className={`btn ${request.danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => decide(true)}
            disabled={busy}
            autoFocus={false}
          >
            {busy ? (
              <>
                <span className="spinner" /> Working…
              </>
            ) : (
              (request.confirmLabel ?? "Confirm")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({ ...opts, resolve });
    });
  }, []);

  const handleClose = useCallback(
    (ok: boolean) => {
      // Capture before clearing state (async-safe).
      setRequest((req) => {
        req?.resolve(ok);
        return null;
      });
    },
    []
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmModal request={request} onClose={handleClose} />}
    </ConfirmContext.Provider>
  );
}
