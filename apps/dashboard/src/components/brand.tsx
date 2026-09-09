import { Link } from "react-router";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="VideoGPT home">
      <img src="/mark.svg" alt="" className="size-9 shrink-0 rounded-lg shadow-sm" />
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold tracking-tight">VideoGPT</span>
          <span className="block text-[0.6875rem] text-muted-foreground">Community Edition</span>
        </span>
      )}
    </Link>
  );
}
