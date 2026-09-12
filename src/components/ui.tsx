"use client";
import { useEffect, useRef, useId } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <header className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon" aria-label="关闭弹窗" onClick={close}>
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">拾</div>
      <h3>{title}</h3>
      <p>{description || "每一点积累，都从今天开始。"}</p>
      {children}
    </div>
  );
}
