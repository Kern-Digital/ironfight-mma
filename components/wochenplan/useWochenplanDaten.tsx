"use client";

/**
 * DATEN UND AKTIONEN DES WOCHENPLANS (Verwaltung) — Pläne, gewählter Plan,
 * Trainer, Räume, offene Kurse, Aktivieren, die Sätze zum Stand eines Plans
 * und die drei Sheets. Die Seite (app/verwaltung/wochenplan/page.tsx) ist nur
 * noch Aussehen; die Logik stammt 1:1 aus der Seite vor dem Umbau
 * (28.09.2026, Entwurf B).
 */

import KursSheet, {
  type KursSheetPlan,
  type KursSheetZiel,
} from "@/components/KursSheet";
import PlanSheet, { type PlanSheetZiel } from "@/components/PlanSheet";
import RaeumeSheet from "@/components/RaeumeSheet";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth, useRights } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { tagSchluessel } from "@/lib/guthaben";
import {
  KURSPLAN_STANDARD_NAME,
  kurseGruppieren,
  kurseOhneTrainer,
  planStandRechnen,
  tagPlus,
  tagText,
  type Wochenplan,
} from "@/lib/kursplan";
import { useWochenplaene } from "@/lib/wochenplaene";
import { memberName } from "@/lib/members";
import { getCurrentWeekday } from "@/lib/schedule";
import type { TrainingBlock } from "@/lib/types";
import { Fragment, useEffect, useMemo, useState } from "react";

/**
 * Kurstitel mit erlaubten Umbruchstellen nach „/", „-" und „)" — wie im
 * Kursplan (WochenRaster, titleParts): „(Fitness-)Kickboxen" bricht nach dem
 * Bindestrich, nicht mitten in „Kickbox|en".
 */
export function titelMitUmbruch(titel: string) {
  const teile: string[] = [];
  let jetzt = "";
  for (const z of titel) {
    jetzt += z;
    if (z === "/" || z === "-" || z === ")") {
      teile.push(jetzt);
      jetzt = "";
    }
  }
  if (jetzt) teile.push(jetzt);
  return teile.map((t, i) => (
    <Fragment key={i}>
      {t}
      {i < teile.length - 1 && <wbr />}
    </Fragment>
  ));
}

/** Filterwert für Kurse ohne (gültigen) Raum. */
export const OHNE_RAUM = "__ohne-raum__";

export function useWochenplanDaten() {
  const { user, profile, profileLoading } = useAuth();
  const istVerwaltung = useRights().verwaltung;
  const gymId = resolveGymId(profile);
  const { plaene, geladen } = useWochenplaene(
    gymId,
    !!user && !profileLoading && istVerwaltung,
  );
  const [gewaehltId, setGewaehltId] = useState<string | null>(null);
  const aktiverPlan = plaene.find((p) => p.aktiv) ?? null;
  const plan =
    plaene.find((p) => p.id === gewaehltId) ?? aktiverPlan ?? plaene[0] ?? null;
  const kurse = useMemo(() => plan?.kurse ?? [], [plan]);
  const raeume = useMemo(() => plan?.raeume ?? [], [plan]);
  const sheetPlan: KursSheetPlan = useMemo(
    () => ({
      id: plan?.id ?? null,
      name: plan?.name ?? KURSPLAN_STANDARD_NAME,
      kurse,
      raeume,
    }),
    [plan, kurse, raeume],
  );
  const [planZiel, setPlanZiel] = useState<PlanSheetZiel | null>(null);
  const [aktiviert, setAktiviert] = useState<string | null>(null);
  const [aktivFehler, setAktivFehler] = useState<string | null>(null);
  const heuteTag = tagSchluessel();
  const mitRaeumen = raeume.length >= 2;
  const [raumFilter, setRaumFilter] = useState("");
  const [raeumeOffen, setRaeumeOffen] = useState(false);
  const heute = getCurrentWeekday();

  const [trainer, setTrainer] = useState<StudentEntry[] | null>(null);
  const [ziel, setZiel] = useState<KursSheetZiel | null>(null);

  useEffect(() => {
    if (!user || profileLoading || !istVerwaltung) return;
    let lebt = true;
    listAllMembers(gymId)
      .then((liste) => {
        if (!lebt) return;
        setTrainer(
          liste
            .filter((m) => m.rights.trainer)
            .sort((a, b) =>
              memberName(a).localeCompare(memberName(b), "de", {
                sensitivity: "base",
              }),
            ),
        );
      })
      .catch(() => {
        if (lebt) setTrainer([]);
      });
    return () => {
      lebt = false;
    };
  }, [user, profileLoading, istVerwaltung, gymId]);

  const trainerName = useMemo(() => {
    const m = new Map((trainer ?? []).map((t) => [t.uid, memberName(t)]));
    return (uid: string) => m.get(uid);
  }, [trainer]);

  const offen = useMemo(
    () =>
      trainer === null
        ? []
        : kurseOhneTrainer(kurse, (uid) => trainerName(uid) !== undefined),
    [kurse, trainer, trainerName],
  );
  const offenIds = useMemo(() => new Set(offen.map((k) => k.id)), [offen]);
  const offeneKurse = useMemo(
    () => new Set(offen.map((k) => k.title)).size,
    [offen],
  );
  const kursZahl = useMemo(() => kurseGruppieren(kurse).length, [kurse]);

  const raumName = useMemo(
    () => new Map(raeume.map((r) => [r.id, r.name])),
    [raeume],
  );
  const filter =
    mitRaeumen && (raumFilter === OHNE_RAUM || raumName.has(raumFilter))
      ? raumFilter
      : "";
  const sichtbar = useMemo(
    () =>
      filter === ""
        ? kurse
        : kurse.filter((k) =>
            filter === OHNE_RAUM
              ? !k.raumId || !raumName.has(k.raumId)
              : k.raumId === filter,
          ),
    [kurse, filter, raumName],
  );
  const ohneRaum =
    mitRaeumen && kurse.some((k) => !k.raumId || !raumName.has(k.raumId));
  const raumOptionen = [
    { id: "", name: "Alle Räume" },
    ...raeume,
    ...(ohneRaum ? [{ id: OHNE_RAUM, name: "Ohne Raum" }] : []),
  ];

  async function aktivieren(p: Wochenplan) {
    if (!user || p.aktiv || aktiviert) return;
    setAktiviert(p.id);
    setAktivFehler(null);
    try {
      const res = await fetch("/api/gym/kurse", {
        method: "POST",
        headers: {
          authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ aktion: "plan-aktivieren", planId: p.id }),
      });
      const daten = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        setAktivFehler(daten.error ?? "Das ließ sich gerade nicht aktivieren.");
    } catch {
      setAktivFehler("Keine Verbindung. Versuch es gleich noch einmal.");
    } finally {
      setAktiviert(null);
    }
  }

  const rechnung = useMemo(
    () => planStandRechnen(plaene, heuteTag),
    [plaene, heuteTag],
  );
  const grundplan = plaene.find((p) => p.id === rechnung.grundplanId) ?? null;
  const standVon = (p: Wochenplan) => rechnung.stand.get(p.id) ?? p;
  const laufend =
    aktiverPlan && !standVon(aktiverPlan).grundplan
      ? standVon(aktiverPlan)
      : null;
  const tag = (t: string) => tagText(t, heuteTag);
  const nameVon = (id: string | null) =>
    id ? plaene.find((x) => x.id === id)?.name : undefined;
  const danachName = (st: { nachfolgerId: string | null }) =>
    nameVon(st.nachfolgerId) ?? grundplan?.name ?? "";
  const vorgaengerVon = (p: Wochenplan) =>
    plaene.find(
      (x) =>
        x.id !== p.id &&
        standVon(x).nachfolgerId === p.id &&
        standVon(x).zeitraumBis,
    );

  /** Wann der Plan gilt, kurz — ohne die Kurszahl. null = kein Zeitraum. */
  function wannText(p: Wochenplan): string | null {
    const st = standVon(p);
    const danach = st.nachfolgerId ? `, danach „${danachName(st)}“` : "";
    const vorg = vorgaengerVon(p);
    if (st.grundplan) {
      return !p.aktiv && laufend?.zeitraumBis && !laufend.nachfolgerId
        ? `Grundplan, wieder ab ${tag(tagPlus(laufend.zeitraumBis, 1))}`
        : "Grundplan";
    }
    if (st.zeitraumVon && st.zeitraumBis) {
      return `${p.aktiv ? `bis ${tag(st.zeitraumBis)}` : `${tag(st.zeitraumVon)} – ${tag(st.zeitraumBis)}`}${danach}`;
    }
    if (st.zeitraumVon) return `ab ${tag(st.zeitraumVon)}`;
    if (vorg)
      return `ab ${tag(tagPlus(standVon(vorg).zeitraumBis!, 1))} nach „${vorg.name}“`;
    return null;
  }

  function kursZahlText(p: Wochenplan): string {
    const n = kurseGruppieren(p.kurse).length;
    return n === 0 ? "Noch kein Kurs" : `${n} ${n === 1 ? "Kurs" : "Kurse"}`;
  }

  /** Der Satz zum gewählten Plan: was Trainer und Athleten wann sehen. */
  function hinweis(p: Wochenplan): string {
    const st = standVon(p);
    if (p.aktiv) {
      if (st.grundplan || !st.zeitraumBis)
        return "Deine Trainer und Athleten sehen diesen Plan im Kursplan.";
      return `Dieser Plan gilt bis zum ${tag(st.zeitraumBis)}. Ab dem ${tag(tagPlus(st.zeitraumBis, 1))} sehen deine Trainer und Athleten ${st.nachfolgerId ? "" : "wieder "}„${danachName(st)}“.`;
    }
    if (!aktiverPlan)
      return "Was du hier änderst, sehen deine Trainer und Athleten, sobald du den Plan aktivierst.";
    const jetzt = `Deine Trainer und Athleten sehen gerade „${aktiverPlan.name}“.`;
    if (st.grundplan && laufend?.zeitraumBis && !laufend.nachfolgerId) {
      return `${jetzt} Ab dem ${tag(tagPlus(laufend.zeitraumBis, 1))} gilt wieder dieser Plan, dein Grundplan. Tippst du auf „Aktivieren“, gilt er sofort.`;
    }
    if (st.zeitraumVon && st.zeitraumBis) {
      return `${jetzt} Vom ${tag(st.zeitraumVon)} bis ${tag(st.zeitraumBis)} sehen sie diesen Plan, danach ${st.nachfolgerId ? "" : "wieder "}„${danachName(st)}“.`;
    }
    if (st.zeitraumVon)
      return `${jetzt} Ab dem ${tag(st.zeitraumVon)} sehen sie diesen Plan, dann wird er dein Grundplan.`;
    const vorg = vorgaengerVon(p);
    if (vorg) {
      return `${jetzt} Ab dem ${tag(tagPlus(standVon(vorg).zeitraumBis!, 1))} gilt dieser Plan dauerhaft, im Anschluss an „${vorg.name}“.`;
    }
    return `${jetzt} Was du hier änderst, sehen sie, sobald du diesen Plan aktivierst.`;
  }

  /** Namen der Trainer eines Kurses; leer, solange die Liste lädt. */
  function trainerVon(k: TrainingBlock): string[] {
    return (k.trainerUids ?? [])
      .map(trainerName)
      .filter((n): n is string => !!n);
  }

  const raumVon = (k: TrainingBlock) =>
    mitRaeumen && k.raumId ? raumName.get(k.raumId) : undefined;

  return {
    gymId,
    heuteTag,
    grundplanId: rechnung.grundplanId,
    standVon,
    vorgaengerVon,
    user,
    profileLoading,
    istVerwaltung,
    geladen,
    plaene,
    plan,
    aktiverPlan,
    setGewaehltId,
    kurse,
    raeume,
    sichtbar,
    kursZahl,
    heute,
    trainer,
    trainerVon,
    raumVon,
    offenIds,
    offeneKurse,
    mitRaeumen,
    filter,
    setRaumFilter,
    raumOptionen,
    aktiviert,
    aktivFehler,
    aktivieren,
    wannText,
    kursZahlText,
    hinweis,
    setZiel,
    setPlanZiel,
    setRaeumeOffen,
    sheets: (
      <>
        <KursSheet
          ziel={ziel}
          plan={sheetPlan}
          trainer={trainer}
          onClose={() => setZiel(null)}
        />
        <RaeumeSheet
          offen={raeumeOffen}
          onClose={() => setRaeumeOffen(false)}
          raeume={raeume}
          kurse={kurse}
        />
        <PlanSheet
          ziel={planZiel}
          plaene={plaene}
          onClose={() => setPlanZiel(null)}
          onAngelegt={(id) => setGewaehltId(id)}
        />
      </>
    ),
  };
}

export type WochenplanDaten = ReturnType<typeof useWochenplanDaten>;
