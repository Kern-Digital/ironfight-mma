import { ALL_TECHNIQUES, getTechniqueById } from "@/lib/techniques";
import { notFound } from "next/navigation";
import TechniqueDetailView from "./TechniqueDetailView";

// Server-Shell (Muster plans/[slug]): statisch vorgerendert + Metadaten,
// die Darstellung übernimmt die Client-Ansicht im neuen Token-Look
// (Athleten-Shell braucht Auth-/Theme-Kontext).
export function generateStaticParams() {
  return ALL_TECHNIQUES.map((t) => ({ id: t.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const t = getTechniqueById(params.id);
  if (!t) return { title: "Technik nicht gefunden — Tidal Athletics" };
  return {
    title: `${t.name} — Tidal Athletics Techniken`,
    description: t.description,
  };
}

export default function TechniqueDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const t = getTechniqueById(params.id);
  if (!t) notFound();

  return <TechniqueDetailView id={params.id} />;
}
