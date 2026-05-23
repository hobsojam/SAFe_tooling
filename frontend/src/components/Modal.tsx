import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface Props {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function Modal({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
    return () => {
      if (el.open) el.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      className="m-0 h-dvh w-screen max-h-none max-w-none bg-transparent p-0 [&::backdrop]:bg-black/40"
      onCancel={onClose}
    >
      {open && (
        <div className="relative flex h-full items-center justify-center">
          <button
            type="button"
            aria-label="Close modal backdrop"
            className="absolute inset-0 cursor-default"
            tabIndex={-1}
            onClick={onClose}
          />
          <div
            className="relative z-10 mx-3 sm:mx-0 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 id="modal-title" className="text-base font-semibold text-slate-800">{title}</h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-6">{children}</div>
          </div>
        </div>
      )}
    </dialog>
  );
}
