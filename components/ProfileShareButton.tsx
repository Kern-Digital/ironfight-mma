"use client";

/**
 * „Profil teilen" — der Knopf im Kampfprofil-Kopf, direkt ÜBER „Meine Analyse
 * starten" (Leons Festlegung 04.09.2026).
 *
 * VORHER WAR DAS EINE GANZE KARTE weiter unten auf der Seite: Symbol,
 * Zustandssatz, Erklärzeile, Knopf — plus eine zweite Liste „Mit dir geteilt".
 * Das war viel Fläche für eine Einstellung, die man selten anfasst, und sie
 * stand an einer Stelle, an der sie niemand suchte. Jetzt sitzt sie als Knopf
 * dort, wo die anderen Handlungen des Profils stehen; alles Erklärende liegt
 * im Sheet.
 *
 * DER ZUSTAND BLEIBT TROTZDEM SICHTBAR: Wer gerade etwas teilt, sieht die Zahl
 * am Knopf — oder „Alle", wenn ein Bereich für alle Trainer des Gyms offen
 * ist. Ohne das wäre die einzige Antwort auf „teile ich eigentlich was?" ein
 * Klick — und eine Freigabe, an die man sich nicht erinnert, ist genau das,
 * was dieser Bereich verhindern soll.
 *
 * FÜR JEDEN, NICHT NUR FÜR STAB-KONTEN (Leon 16.09.2026): Jeder Athlet
 * entscheidet selbst, welche Trainer sein Kampfprofil und seine DeepFight-
 * Analysen sehen — ohne Freigabe kann ihn niemand analysieren. Ein Athlet
 * vergibt dabei nur den Bereich DeepFight; Athletenprofil und Wettkämpfe sind
 * für die Trainer seines Gyms ohnehin offen (`bereicheFuerKonto`).
 *
 * ZWEI WEGE ZUR NAMENSLISTE (seit 30.09.2026):
 *   • STAB-KONTEN lesen `listAllMembers(gymId)` — die Regeln lassen Trainer
 *     und Verwaltung die Mitgliederliste lesen. Dieselbe Liste trägt an jedem
 *     Eintrag `profileShares` und beantwortet damit auch „wer gibt MICH
 *     frei", ohne zweiten Lesevorgang.
 *   • ATHLETEN dürfen die Mitgliederliste NICHT lesen (so gewollt). Sie holen
 *     die Trainer über `POST /api/gym/trainer-auswahl` — uid, Name,
 *     Profilbild, sonst nichts (lib/trainer-auswahl.ts). Bis zum 30.09. lief
 *     auch der Athlet über `listAllMembers`, die Abfrage scheiterte still,
 *     und das Sheet meldete „In deinem Gym gibt es gerade keinen Trainer".
 *
 * GELADEN, LEER UND GESCHEITERT SIND DREI ZUSTÄNDE (`status`): Ein Fehler
 * darf nie wie eine leere Liste aussehen — genau das war der Fehler. Die
 * Liste lädt erst nach dem Rendern; der Rest der Seite wartet nicht darauf.
 */

import ProfileShareSheet from "@/components/ProfileShareSheet";
import Icon from "@/components/ui/Icon";
import {
  isGhostAccount,
  isStaffEntry,
  listAllMembers,
  type StudentEntry,
} from "@/lib/admin";
import { useAuth, useRights } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { memberName } from "@/lib/members";
import { ladeTrainerAuswahl } from "@/lib/trainer-auswahl";
import type { ProfilbildId } from "@/lib/profilbilder";
import {
  alleTrainerBereiche,
  bereicheFuer,
  empfaenger,
  type ProfileShares,
  type ShareArea,
} from "@/lib/profile-sharing";
import { setProfileShares } from "@/lib/user-profile";
import { useCallback, useEffect, useMemo, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export type GeteiltMitMir = { eintrag: StudentEntry; bereiche: ShareArea[] };

/** Eine Zeile im Sheet — dieselbe Form für beide Wege zur Namensliste. */
export type FreigabePerson = { uid: string; name: string; avatar: ProfilbildId | null };

/** `ohne-gym`: Das Konto hat nie eine Einladung eingelöst — keine Trainer. */
export type AuswahlStatus = "laedt" | "ok" | "ohne-gym" | "fehler";

export default function ProfileShareButton() {
  const { user, profile, refreshProfile } = useAuth();
  const rights = useRights();
  const gymId = resolveGymId(profile);
  const eigeneUid = user?.uid ?? "";

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  /** Nur Athleten-Weg: die Trainer aus der Route. */
  const [auswahl, setAuswahl] = useState<FreigabePerson[] | null>(null);
  const [status, setStatus] = useState<AuswahlStatus>("laedt");
  const [offen, setOffen] = useState(false);

  // Das Feld gehört dem Menschen: Der Auth-Context hält den gespeicherten
  // Stand, `refreshProfile()` zieht ihn nach dem Speichern nach.
  const shares: ProfileShares = useMemo(
    () => profile?.profileShares ?? {},
    [profile?.profileShares],
  );

  // Dieselbe Bedingung wie `istStabKonto()` in den Firestore-Regeln — sie
  // entscheidet nur noch, WELCHE Bereiche das Sheet zeigt.
  const istStab = rights.trainer || rights.verwaltung || rights.admin;

  useEffect(() => {
    if (!user) return;
    let lebt = true;
    setStatus("laedt");
    if (istStab) {
      listAllMembers(gymId)
        .then((liste) => {
          if (!lebt) return;
          setMembers(liste);
          setStatus("ok");
        })
        .catch(() => {
          if (lebt) setStatus("fehler");
        });
    } else {
      ladeTrainerAuswahl(user)
        .then((gyms) => {
          if (!lebt) return;
          // Heute genau ein Gym. Kommen mehrere, stehen alle Trainer in
          // einer Liste — die Freigabe gilt je Person, nicht je Gym
          // (Gedächtnis athlet-mehrere-gyms).
          const personen = gyms.flatMap((g) => g.trainer);
          setAuswahl(personen.filter((p, i) => personen.findIndex((x) => x.uid === p.uid) === i));
          setStatus(gyms.length === 0 ? "ohne-gym" : "ok");
        })
        .catch(() => {
          if (lebt) setStatus("fehler");
        });
    }
    return () => {
      lebt = false;
    };
  }, [user, gymId, istStab]);

  /**
   * Trainer des Gyms außer mir selbst — nur sie können überhaupt lesen.
   *
   * OHNE PLATTFORM-ADMINS (Leon 03.09.2026): Sie sind Ghost-Konten und gehören
   * keinem Gym-Team an (Begründung an `isGhostAccount` in lib/admin.ts). Ein
   * Häkchen bei ihnen wäre ohnehin wirkungslos — `isAdmin()` steht in den
   * Regeln vor jeder Freigabe-Prüfung.
   */
  const kollegen: FreigabePerson[] = useMemo(() => {
    if (!istStab) return auswahl ?? [];
    return (members ?? [])
      .filter((m) => m.uid !== eigeneUid && isStaffEntry(m) && !isGhostAccount(m))
      .map((m) => ({ uid: m.uid, name: memberName(m), avatar: m.avatar }))
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  }, [istStab, auswahl, members, eigeneUid]);

  /**
   * Wer MICH freigegeben hat — die Gegenrichtung (Leons Wunsch 03.09.).
   *
   * NUR FÜR TRAINER, und zwar nicht aus Bequemlichkeit: `canAccessMemberData`
   * verlangt `isTrainerOrAdmin()`. Ein Athlet kann fremde Daten gar nicht
   * lesen — ihm zu melden, jemand teile etwas mit ihm, wäre ein Versprechen,
   * das die Regeln nicht einlösen. Seit dem 16.09. zählen hier auch Athleten
   * des Gyms, die mich namentlich oder über „alle Trainer" freigegeben haben.
   */
  const teilenMitMir: GeteiltMitMir[] = useMemo(
    () =>
      rights.trainer
        ? (members ?? [])
            .filter((m) => m.uid !== eigeneUid && !isGhostAccount(m))
            .map((m) => ({
              eintrag: m,
              bereiche: bereicheFuer(m.profileShares, eigeneUid, gymId),
            }))
            .filter((x) => x.bereiche.length > 0)
            .sort((a, b) =>
              memberName(a.eintrag).localeCompare(memberName(b.eintrag), "de", {
                sensitivity: "base",
              }),
            )
        : [],
    [members, eigeneUid, gymId, rights.trainer],
  );

  const speichern = useCallback(
    async (naechste: ProfileShares) => {
      if (!eigeneUid) return;
      await setProfileShares(eigeneUid, naechste);
      await refreshProfile();
    },
    [eigeneUid, refreshProfile],
  );

  // Die Zahl kommt aus dem GESPEICHERTEN Stand, nicht aus der Namensliste:
  // Wer das Trainer-Häkchen verloren hat, steht nicht mehr in `kollegen`,
  // seine Freigabe steht aber weiter im Dokument (und wirkt dort auch nicht
  // mehr). Die Zahl darf davon nicht springen, während die Liste lädt.
  const anzahl = empfaenger(shares).length;
  const alle = alleTrainerBereiche(shares, gymId).length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        disabled={status === "laedt"}
        aria-label="Profil teilen"
        className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
        style={{
          ...BTN_FONT,
          background: "var(--surface-raised)",
          // AKZENT-RAHMEN (Leon 04.09.2026: „mach den Rahmen blau"). Bewusst
          // `--accent` statt eines blauen Hex: Das Blau IST der Gym-Akzent
          // (DESIGN-BRIEF §1.1) — bei einem Gym mit anderer Marke folgt der
          // Rahmen dessen Farbe, statt als einzige Stelle der App blau zu
          // bleiben.
          border: "1px solid var(--accent)",
          color: "var(--text-body)",
        }}
      >
        <Icon name="share" size={20} strokeWidth={2} />
        Profil teilen
        {(alle || anzahl > 0) && (
          <span
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill px-1.5"
            style={{
              font: "var(--type-meta)",
              letterSpacing: 0,
              background: "var(--accent-subtle)",
              color: "var(--accent-text)",
            }}
          >
            {alle ? "Alle" : anzahl}
          </span>
        )}
      </button>

      {/* `open` statt `{offen && …}`: nur wer gerendert bleibt, kann sich
          beim Schliessen zurueckverwandeln. Die Bedingung liegt jetzt in
          der SheetShell, die den Inhalt nach der Austritts-Feder entfernt. */}
      <ProfileShareSheet
        open={offen}
        shares={shares}
        kollegen={kollegen}
        status={status}
        teilenMitMir={teilenMitMir}
        gymId={gymId}
        istStab={istStab}
        onSave={speichern}
        onClose={() => setOffen(false)}
      />
    </>
  );
}
