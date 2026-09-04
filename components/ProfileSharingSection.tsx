"use client";

/**
 * „Sichtbarkeit" auf `/kampfprofil` — der Freigabe-Knopf und seine Gegenseite.
 *
 * WARUM SIE HIER STEHT: Wer gerade seine Körperdaten und sein Kampfprofil
 * pflegt, stellt sich von selbst die Frage, wer das eigentlich sieht. Deshalb
 * sitzt der Block direkt über „Athleten-Daten" und nicht in den
 * Account-Einstellungen — dort suchte ihn niemand.
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
  SHARE_AREAS,
  bereicheFuer,
  empfaenger,
  type ProfileShares,
} from "@/lib/profile-sharing";
import { setProfileShares } from "@/lib/user-profile";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** „Coach Roman", „Coach Roman und Alec Coach", „Coach Roman und 2 weitere" */
function namensListe(namen: string[]): string {
  if (namen.length === 1) return namen[0];
  if (namen.length === 2) return `${namen[0]} und ${namen[1]}`;
  return `${namen[0]} und ${namen.length - 1} weitere`;
}

export default function ProfileSharingSection() {
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

  /** Wen ICH freigegeben habe — Namen für die Karte. */
  const freigegebene = useMemo(() => {
    const uids = empfaenger(shares);
    return uids
      .map((uid) => kollegen.find((k) => k.uid === uid))
      .filter((k): k is StudentEntry => Boolean(k));
  }, [shares, kollegen]);

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
  const teilenMitMir = useMemo(
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

  const anzahl = freigegebene.length;
  // Ein Eintrag, dessen Name (noch) nicht in der Liste steht — etwa weil
  // jemand das Trainer-Häkchen verloren hat oder die Liste noch lädt. Die
  // Zahl stimmt trotzdem.
  const unbekannte = empfaenger(shares).length - anzahl;
  // ALLES HÄNGT AN DIESER EINEN ZAHL. Ein Zwischenstand ließ Symbol und
  // Fläche an `anzahl` hängen und den Text an der Summe — im Bild stand dann
  // „1 Person sieht etwas von dir" neben einem geschlossenen Schloss
  // (gefunden 03.09.2026 im Prüflauf).
  const gesamt = anzahl + unbekannte;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col">
        <h2
          style={{
            font: "var(--type-h2)",
            letterSpacing: "var(--ls-display)",
            textTransform: "uppercase",
          }}
        >
          Sichtbarkeit
        </h2>
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Du entscheidest, wer aus deinem Team dich wie einen Athleten betreut
        </p>
      </div>

      <div className="t-card flex flex-col">
        {/* ─── Was ich hergebe ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-field"
            style={{
              background: gesamt > 0 ? "var(--accent-subtle)" : "var(--surface-raised)",
              border:
                gesamt > 0
                  ? "1px solid color-mix(in oklab, var(--accent) 35%, transparent)"
                  : "1px solid var(--line)",
              color: gesamt > 0 ? "var(--accent-text)" : "var(--text-3)",
            }}
          >
            <Icon name={gesamt > 0 ? "users" : "lock"} size={20} strokeWidth={2} />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span style={{ font: "var(--type-body-strong)" }}>
              {gesamt === 0
                ? "Dein Profil bleibt bei dir."
                : anzahl === 0
                  ? `${unbekannte} ${unbekannte === 1 ? "Person sieht" : "Personen sehen"} etwas von dir.`
                  : `${namensListe(freigegebene.map(memberName))} ${
                      gesamt === 1 ? "sieht" : "sehen"
                    } etwas von dir.`}
            </span>
            <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {gesamt === 0
                ? "Deine Kollegen sehen deinen Namen in der Mitgliederliste. Alles Weitere gibst du hier frei."
                : "Ändere jederzeit, wer welchen Bereich von dir sieht."}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOffen(true)}
            disabled={members === null}
            className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
            style={{
              ...BTN_FONT,
              background: gesamt === 0 ? "var(--accent)" : "var(--surface-raised)",
              border: gesamt === 0 ? "1px solid transparent" : "1px solid var(--line)",
              color: gesamt === 0 ? "var(--on-accent)" : "var(--text-body)",
              boxShadow: gesamt === 0 ? "var(--accent-glow)" : undefined,
            }}
          >
            <Icon name="edit" size={13} strokeWidth={2.4} />
            {gesamt === 0 ? "Trainer freigeben" : "Freigabe ändern"}
          </button>
        </div>

        {/* ─── Und was umgekehrt bei mir ankommt ───────────────────────── */}
        {teilenMitMir.length > 0 && (
          <>
            <div
              aria-hidden
              style={{ height: "1px", background: "var(--line)" }}
            />
            <div className="flex flex-col gap-2 p-4">
              <span className="t-label">Mit dir geteilt</span>
              {teilenMitMir.map(({ eintrag, bereiche }) => {
                // NAME OBEN, BEREICHE DARUNTER — dasselbe Zeilenbild wie in
                // der Mitgliederliste. Nebeneinander gestellt drängte die
                // Bereichszeile den Namen auf 390 px vollständig aus der Zeile
                // und lief 23 px über den Rand (gemessen 03.09.2026): Sie war
                // `shrink-0`, der Name `flex-1` — also gab der Name nach.
                const zeile = (
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className="truncate"
                      style={{ font: "var(--type-body-strong)" }}
                    >
                      {memberName(eintrag)}
                    </span>
                    <span
                      className="truncate"
                      style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                    >
                      {bereiche
                        .map(
                          (b) =>
                            SHARE_AREAS.find((a) => a.key === b)?.label ?? b,
                        )
                        .join(" · ")}
                    </span>
                  </span>
                );
                // Der Weg zur Detailseite: Diese Liste steht ohnehin nur
                // Trainern (siehe teilenMitMir) — eine reine Verwaltung käme
                // unter /trainer gar nicht an (Middleware).
                return (
                  <Link
                    key={eintrag.uid}
                    href={`/trainer/athleten/${eintrag.uid}`}
                    className="t-interactive flex min-h-hit items-center gap-3 rounded-field px-2 py-1.5"
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    {zeile}
                    <span aria-hidden style={{ color: "var(--text-3)" }}>
                      <Icon name="arrow-right" size={16} strokeWidth={2.2} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {offen && (
        <ProfileShareSheet
          shares={shares}
          kollegen={kollegen}
          onSave={speichern}
          onClose={() => setOffen(false)}
        />
      )}
    </section>
  );
}
