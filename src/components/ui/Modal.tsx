import { type ReactNode, useEffect, useRef } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ open, title, onClose, children, actions }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 p-6">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="px-box w-full max-w-lg bg-navy p-7 outline-none"
      >
        <h2 className="font-vi mb-4 text-[28px] text-gold">{title}</h2>
        <div className="text-2xl leading-tight">{children}</div>
        {actions && <div className="mt-6 flex justify-end gap-4">{actions}</div>}
      </div>
    </div>
  );
}
