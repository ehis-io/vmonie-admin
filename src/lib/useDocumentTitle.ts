"use client";

import { useEffect } from "react";

const SUFFIX = "Vmonie Ops";

/** Set the tab title from a client component (they cannot export metadata). */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${SUFFIX}`;
  }, [title]);
}
