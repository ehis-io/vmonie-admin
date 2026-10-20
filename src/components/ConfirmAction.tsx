"use client";

import React, { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { describeError } from "../lib/api";
import { can, requiredHint, useAdmin, type Permission } from "../lib/access";
import { Button, type ButtonProps, Select, TextArea } from "./ui";

export interface ConfirmValues {
  /** The reason / note text, trimmed. Empty when the dialog has no text field. */
  text: string;
  /** The chosen option, when the dialog offers a choice. */
  choice: string;
}

export interface ConfirmActionProps {
  /** Button label. */
  label: string;
  /** Who may do this; the button is disabled (with a hint) for everyone else. */
  permission?: Permission;
  /** Extra reason to disable, shown as the hover hint. */
  disabledReason?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  title: string;
  description?: React.ReactNode;
  /** A reason/note field. Omit for actions the API takes no text for. */
  textField?: {
    label: string;
    /** Minimum length the backend enforces; 0 means optional. */
    minLength: number;
    maxLength?: number;
    placeholder?: string;
  };
  /** A required choice, e.g. the outcome of a manual resolution. */
  choice?: { label: string; options: { value: string; label: string }[] };
  confirmLabel?: string;
  danger?: boolean;
  /** Do the thing. Throwing keeps the dialog open and shows the error. */
  onConfirm: (values: ConfirmValues) => Promise<unknown>;
  /** After success, e.g. reload the screen. */
  onDone?: (result: unknown) => void;
}

/**
 * A button that opens a confirm dialog before a state-changing call. While
 * the call is in flight both the dialog and the trigger are disabled, so a
 * double click cannot submit twice; a ref guards against the gap before
 * React re-renders.
 */
export function ConfirmAction(props: ConfirmActionProps) {
  const session = useAdmin();
  const permitted =
    !props.permission ||
    (session.status === "ready" && can(session.me.roles, props.permission));
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const id = useId();

  const hint = !permitted
    ? requiredHint(props.permission!)
    : props.disabledReason;

  const min = props.textField?.minLength ?? 0;
  const trimmed = text.trim();
  const textOk = !props.textField || trimmed.length >= min;
  const choiceOk = !props.choice || choice !== "";

  const close = () => {
    if (inFlight.current) return;
    setOpen(false);
    setText("");
    setChoice("");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // React bubbles portal events through the component tree: keep this
    // submit from reaching a form the trigger button happens to sit in.
    e.stopPropagation();
    if (inFlight.current || !textOk || !choiceOk) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await props.onConfirm({ text: trimmed, choice });
      inFlight.current = false;
      setBusy(false);
      setOpen(false);
      setText("");
      setChoice("");
      props.onDone?.(result);
    } catch (err) {
      inFlight.current = false;
      setBusy(false);
      setError(describeError(err));
    }
  };

  return (
    <>
      <Button
        variant={props.variant ?? (props.danger ? "danger" : "secondary")}
        size={props.size ?? "sm"}
        disabled={!permitted || !!props.disabledReason || busy}
        title={hint}
        onClick={() => setOpen(true)}
      >
        {props.label}
      </Button>
      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            onSubmit={submit}
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="w-full max-w-md space-y-4 rounded-lg border border-border bg-surface p-5 shadow-xl"
          >
            <h2 id={`${id}-title`} className="text-base font-semibold">
              {props.title}
            </h2>
            {props.description && (
              <div className="text-sm text-muted-foreground">
                {props.description}
              </div>
            )}
            {props.choice && (
              <Select
                label={props.choice.label}
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                disabled={busy}
                options={[
                  { value: "", label: "Choose…" },
                  ...props.choice.options,
                ]}
              />
            )}
            {props.textField && (
              <div>
                <TextArea
                  label={props.textField.label}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={props.textField.maxLength ?? 500}
                  placeholder={props.textField.placeholder}
                  disabled={busy}
                  autoFocus
                />
                {min > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {trimmed.length < min
                      ? `At least ${min} characters (${trimmed.length} so far). This is recorded in the audit log.`
                      : "Recorded in the audit log."}
                  </p>
                )}
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={props.danger ? "danger" : "primary"}
                busy={busy}
                disabled={!textOk || !choiceOk}
              >
                {props.confirmLabel ?? props.label}
              </Button>
            </div>
          </form>
        </div>,
          document.body,
        )}
    </>
  );
}
