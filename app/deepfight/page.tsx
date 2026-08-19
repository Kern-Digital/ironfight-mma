"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * „Mein DeepFight" ist im Kampfprofil aufgegangen (2026-08-19): freigegebene
 * Auswertungen und Gegnerprofile sind dort Sektionen. Diese Route bleibt als
 * Redirect erhalten (Bookmarks, alte Links, Middleware-Schutz).
 * /deepfight/opponents/[id] bleibt unverändert bestehen.
 */
export default function MyDeepFightRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/kampfprofil");
  }, [router]);
  return null;
}
