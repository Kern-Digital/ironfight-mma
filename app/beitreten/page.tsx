"use client";

/**
 * Code von Hand eintragen — /beitreten (Multi-Gym Phase 2, Checkpoint 1C).
 *
 * Der Weg für alle, die den Code nicht als Link bekommen haben: vorgelesen im
 * Training, abgeschrieben vom Aushang, aus einer Nachricht ohne Verlinkung.
 *
 * Die Seite prüft NICHTS am Server. Die Kästchen filtern die Eingabe auf das
 * Code-Alphabet, geprüft wird die Form lokal (isPlausibleInviteCode), dann
 * geht es weiter auf /beitreten/{code} — dort liegt der komplette Ablauf
 * inklusive Ausgeloggt-Fall. Das hält die Zustände an EINER Stelle und spart
 * bei jedem Tippfehler eine Abfrage.
 */

import JoinCodeSlots from "@/components/JoinCodeSlots";
import JoinLayout, { JoinPrimary } from "@/components/JoinLayout";
import {
  INVITE_CODE_LENGTH,
  inviteJoinPath,
  isPlausibleInviteCode,
} from "@/lib/invites";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const ready = isPlausibleInviteCode(code);

  function go(value = code) {
    if (!isPlausibleInviteCode(value)) return;
    router.push(inviteJoinPath(value));
  }

  return (
    <JoinLayout
      /* Gleicher Kopf wie auf der Einladungsseite (Leon 31.08.): wer von
         dort herkommt, soll nicht in einem anders klingenden Fenster landen.
         Nur der erklärende Satz beschreibt die Code-Eingabe. */
      eyebrow="Dein Team wartet"
      title="Komm dazu"
      sub="Acht Zeichen von deinem Gym — trag sie ein und du bist gleich dabei."
      legal
    >
      <JoinCodeSlots
        value={code}
        onChange={setCode}
        // Volle Länge = losfahren. Ein „Weiter" bleibt trotzdem stehen, für
        // alle, die den Code eingefügt und dann noch einmal geprüft haben.
        onComplete={(full) => go(full)}
        autoFocus
      />
      <JoinPrimary onClick={() => go()} disabled={!ready} icon="arrow-right">
        Weiter
      </JoinPrimary>
      <p
        className="text-center"
        style={{ font: "var(--type-sub)", color: "var(--panel-fg-3)" }}
      >
        {code.length > 0 && code.length < INVITE_CODE_LENGTH
          ? `Noch ${INVITE_CODE_LENGTH - code.length} Zeichen.`
          : "Noch kein Konto? Das legst du im nächsten Schritt an."}
      </p>
    </JoinLayout>
  );
}
