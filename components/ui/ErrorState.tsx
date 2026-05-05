"use client";

export default function ErrorState({
  title,
  message,
  hint,
  onRetry,
}: {
  title?: string;
  message: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-sm border border-blood/40 bg-blood/10 px-4 py-4 text-sm">
      <div className="font-bold text-blood">{title ?? "Fehler"}</div>
      <p className="mt-1 text-foreground/80">{message}</p>
      {hint && (
        <p className="mt-1 text-xs text-foreground/60">{hint}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-sm border border-blood/60 bg-blood/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blood hover:bg-blood/25"
        >
          Erneut versuchen
        </button>
      )}
    </div>
  );
}
