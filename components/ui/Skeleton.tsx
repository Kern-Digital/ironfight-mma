/**
 * Skeleton-Loader: Platzhalter-Element mit Pulse-Animation.
 * Wird genutzt, wenn Daten noch geladen werden — verhindert das
 * leere „Lade…"-Hängen.
 */
export default function Skeleton({
  className = "",
  width,
  height,
}: {
  className?: string;
  width?: string | number;
  height?: string | number;
}) {
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = width;
  if (height !== undefined) style.height = height;
  return (
    <div
      style={style}
      className={`animate-pulse rounded-sm bg-carbon-600/60 ${className}`}
    />
  );
}
