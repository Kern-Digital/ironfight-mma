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
 * am Knopf. Ohne sie wäre die einzige Antwort auf „teile ich eigentlich was?"
 * ein Klick — und eine Freigabe, an die man sich nicht erinnert, ist genau
 * das, was dieser Bereich verhindern soll.
 *
 * NUR FÜR STAB-KONTEN. Bei einem Athleten bewirkt `profileShares` gar nichts:
 * `istStabKonto()` in den Regeln prüft die drei Häkchen, und ein Athlet ist
 * für alle Trainer seines Gyms ohnehin sichtbar (so war es immer, und so soll
 * es bleiben). Ein Knopf, der nichts ändert, gehört nicht auf die Seite.
 *
 * EINE ABFRAGE FÜR BEIDE RICHTUNGEN: `listAllMembers(gymId)` liefert an jedem
 * Eintrag auch dessen `profileShares` — damit beantwortet dieselbe Liste
 * „wen gebe ich frei" UND „wer gibt mich frei", ohne einen zweiten
 * Lesevorgang. Sie lädt bewusst erst nach dem Rendern: Der Rest der Seite
 * soll darauf nicht warten.
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
import {
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

export default function ProfileShareButton() {
  const { user, profile, refreshProfile } = useAuth();
  const rights = useRights();
  const gymId = resolveGymId(profile);
  const eigeneUid = user?.uid ?? "";

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [offen, setOffen] = useState(false);

  // Das Feld gehört dem Menschen: Der Auth-Context hält den gespeicherten
  // Stand, `refreshProfile()` zieht ihn nach dem Speichern nach.
  const shares: ProfileShares = useMemo(
    () => profile?.profileShares ?? {},
    [profile?.profileShares],
  );

  // Athleten haben hier nichts zu entscheiden (siehe Kopfkommentar). Die
  // Bedingung ist dieselbe wie `istStabKonto()` in den Firestore-Regeln.
  const istStab = rights.trainer || rights.verwaltung || rights.admin;

  useEffect(() => {
    if (!istStab || !eigeneUid) return;
    let lebt = true;
    listAllMembers(gymId)
      .then((liste) => {
        if (lebt) setMembers(liste);
      })
      .catch(() => {
        if (lebt) setMembers([]);
      });
    return () => {
      lebt = false;
    };
  }, [istStab, eigeneUid, gymId]);

  /**
   * Trainer des Gyms außer mir selbst — nur sie können überhaupt lesen.
   *
   * OHNE PLATTFORM-ADMINS (Leon 03.09.2026): Sie sind Ghost-Konten und gehören
   * keinem Gym-Team an (Begründung an `isGhostAccount` in lib/admin.ts). Ein
   * Häkchen bei ihnen wäre ohnehin wirkungslos — `isAdmin()` steht in den
   * Regeln vor jeder Freigabe-Prüfung.
   */
  const kollegen = useMemo(
    () =>
      (members ?? [])
        .filter((m) => m.uid !== eigeneUid && isStaffEntry(m) && !isGhostAccount(m))
        .sort((a, b) =>
          memberName(a).localeCompare(memberName(b), "de", {
            sensitivity: "base",
          }),
        ),
    [members, eigeneUid],
  );

  /**
   * Wer MICH freigegeben hat — die Gegenrichtung (Leons Wunsch 03.09.).
   *
   * NUR FÜR TRAINER, und zwar nicht aus Bequemlichkeit: `canAccessMemberData`
   * verlangt `isTrainerOrAdmin()`. Eine reine Verwaltung ohne Trainer-Häkchen
   * kann die freigegebenen Daten also gar nicht lesen — ihr zu melden, jemand
   * teile etwas mit ihr, wäre ein Versprechen, das die Regeln nicht einlösen.
   * Ihre eigene Freigabe oben bleibt trotzdem: Sie IST ein Stab-Konto und
   * damit selbst privat.
   */
  const teilenMitMir: GeteiltMitMir[] = useMemo(
    () =>
      rights.trainer
        ? kollegen
            .map((k) => ({
              eintrag: k,
              bereiche: bereicheFuer(k.profileShares, eigeneUid),
            }))
            .filter((x) => x.bereiche.length > 0)
        : [],
    [kollegen, eigeneUid, rights.trainer],
  );

  const speichern = useCallback(
    async (naechste: ProfileShares) => {
      if (!eigeneUid) return;
      await setProfileShares(eigeneUid, naechste);
      await refreshProfile();
    },
    [eigeneUid, refreshProfile],
  );

  if (!istStab) return null;

  // Die Zahl kommt aus dem GESPEICHERTEN Stand, nicht aus der Namensliste:
  // Wer das Trainer-Häkchen verloren hat, steht nicht mehr in `kollegen`,
  // seine Freigabe steht aber weiter im Dokument (und wirkt dort auch nicht
  // mehr). Die Zahl darf davon nicht springen, während die Liste lädt.
  const anzahl = empfaenger(shares).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        disabled={members === null}
        aria-label="Profil teilen"
        className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
        style={{
          ...BTN_FONT,
          background: "var(--surface-raised)",
          // AKZENT-RAHMEN (Leon 04.09.2026: „mach den Rahmen blau"). Bewusst
          // `--accent` statt eines blauen Hex: Das Blau IST der Gym-Akzent
          // (DESIGN-BRIEF §1.1) — bei einem Gym mit anderer Marke folgt der
          // Rahmen dessen Farbe, statt als einzige Stelle der App blau zu
          // bleiben. Er hebt den Knopf gegen die neutrale Kante ringsum ab,
          // ohne mit dem gefüllten „Meine Analyse starten" darunter zu
          // konkurrieren.
          border: "1px solid var(--accent)",
          color: "var(--text-body)",
        }}
      >
        <Icon name="share" size={20} strokeWidth={2} />
        Profil teilen
        {anzahl > 0 && (
          <span
            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill px-1.5"
            style={{
              font: "var(--type-meta)",
              letterSpacing: 0,
              background: "var(--accent-subtle)",
              color: "var(--accent-text)",
            }}
          >
            {anzahl}
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
        teilenMitMir={teilenMitMir}
        onSave={speichern}
        onClose={() => setOffen(false)}
      />
    </>
  );
}
