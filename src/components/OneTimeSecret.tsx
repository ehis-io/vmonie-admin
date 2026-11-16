"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Alert, Button } from "./ui";

/**
 * Shows a secret the API returns only once (a business API key or webhook
 * signing secret), with a copy button. The caller keeps the value in state
 * only while this is open and clears it on `onClose`. A click outside or
 * Escape does not close it: losing the value means issuing a new one, so
 * only the explicit button does.
 */
export function OneTimeSecret({
  title,
  label,
  value,
  onClose,
  children,
}: {
  title: string;
  /** What the value is, e.g. "API key". */
  label: string;
  /** Null hides the dialog. */
  value: string | null;
  onClose: () => void;
  /** Extra guidance under the value. */
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  };

  const close = () => {
    setCopied(null);
    onClose();
  };

  return (
    <Modal open={value !== null} title={title} onClose={() => undefined} wide>
      {() => (
        <div className="space-y-4">
          <Alert tone="warning">
            Copy the {label.toLowerCase()} now and send it to the business
            securely. You won&apos;t see it again, here or anywhere else in
            the console. If it is lost, issue a new one.
          </Alert>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
              {label}
            </p>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-surface-border bg-background/60 px-3 py-2 font-mono text-xs text-foreground">
                {value}
              </code>
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied === "yes" ? "Copied" : "Copy"}
              </Button>
            </div>
            {copied === "failed" && (
              <p className="mt-1 text-xs text-danger">
                Could not copy. Select the text and copy it by hand.
              </p>
            )}
          </div>
          {children && <div className="text-sm text-muted">{children}</div>}
          <div className="flex justify-end">
            <Button onClick={close}>I have saved it</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
