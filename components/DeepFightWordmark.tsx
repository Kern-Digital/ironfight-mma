/**
 * DeepFight-Wortmarke: Funkeln-Symbol + Schriftzug als untrennbare Einheit.
 * Das Symbol skaliert em-basiert mit der Schriftgröße des Elternelements und
 * funktioniert dadurch überall — von der Subnav (10px) bis zum Seitentitel (42px).
 */
export default function DeepFightWordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/deepfight-icon.png"
        alt=""
        aria-hidden="true"
        className="h-[1em] w-auto shrink-0"
        style={{ transform: "translateY(-0.04em)" }}
      />
      <span>DeepFight</span>
    </span>
  );
}
