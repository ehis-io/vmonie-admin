"use client";

import React, { useId } from "react";
import { createPortal } from "react-dom";

/**
 * A dialog over the page, styled like zemfi's ConfirmDialog. The caller owns
 * the form inside and decides when it may close (not while a request runs).
 */
export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: (titleId: string) => React.ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`card max-h-[90vh] w-full overflow-y-auto p-6 shadow-2xl ${wide ? "max-w-xl" : "max-w-md"}`}
      >
        <h2 id={id} className="mb-4 text-base font-semibold text-foreground">
          {title}
        </h2>
        {children(id)}
      </div>
    </div>,
    document.body,
  );
}
