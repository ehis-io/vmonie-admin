"use client";

import { Button } from "./ui";

/**
 * Previous/next over a cursor-paged list. `stack` holds the cursors of the
 * pages visited so far (the first page has none), so "Previous" pops back.
 */
export function CursorPager({
  stack,
  nextCursor,
  onChange,
  busy,
}: {
  stack: string[];
  nextCursor: string | null | undefined;
  onChange: (stack: string[]) => void;
  busy?: boolean;
}) {
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>Page {stack.length + 1}</span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={stack.length === 0 || busy}
          onClick={() => onChange(stack.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!nextCursor || busy}
          onClick={() => nextCursor && onChange([...stack, nextCursor])}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
