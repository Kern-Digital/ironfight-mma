/**
 * Der Inhalt der Stab-Hülle — EINE Liste, zwei Leser.
 *
 * Gelesen wird sie von der Sidebar am Desktop (`components/shell/StaffSidebar`)
 * und von der Schublade auf dem Handy. Beide zeigen dieselben Punkte; die
 * Schublade IST die Sidebar in einem anderen Behälter. Deshalb liegen die
 * Punkte hier und nicht in einer der beiden Komponenten — sonst driften die
 * zwei Ansichten auseinander, sobald jemand einen Punkt ergänzt.
 *
 * WARUM DIE LISTE VOLLSTÄNDIG SEIN MUSS: Mit der Sidebar fallen Navbar UND
 * Footer für die Stab-Rollen ersatzlos weg (Leons Vorgabe 01.09.2026). Alles,
 * was heute nur dort erreichbar ist, wäre danach unerreichbar. Die Gruppen
 * „Mein Training" und „Lernen" stehen deshalb ausdrücklich mit drin: Trainer
 * sind auch Athleten (CLAUDE.md), und ihr eigenes Training hing bisher am
 * Kopf-Menü.
 *
 * RECHTE ENTSCHEIDEN ÜBER SICHTBARKEIT, NICHT ÜBER ZUGRIFF. Was hier fehlt,
 * ist nur nicht verlinkt — durchgesetzt wird die Trennung in `middleware.ts`
 * und in den Firestore-Regeln. Die Rechte kommen als fertiges Set herein
 * (`effectiveRights`, der Plattform-Rang ist eingerechnet).
 */

import type { IconName } from "@/components/ui/Icon";
import type { RoleSet } from "@/lib/roles";

export interface ShellNavChild {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
}

export interface ShellNavItem {
  href: string;
  label: string;
  /** Fehlt NUR bei DeepFight — die Wortmarke bringt ihr eigenes Symbol mit. */
  icon?: IconName;
  /** Statt `label`: die untrennbare DeepFight-Wortmarke (DESIGN-BRIEF §1.6). */
  wordmark?: boolean;
  isActive: (pathname: string) => boolean;
  children?: ShellNavChild[];
}

export interface ShellNavGroup {
  id: string;
  /** Zwischenüberschrift. `null` = Gruppe ohne Überschrift (Fußgruppe). */
  label: string | null;
  /**
   * Übersichtsseite des Bereichs — macht die Gruppen-ÜBERSCHRIFT zum Link
   * (Leons Vorgabe 01.09.2026 abends): „Übersicht" verschwindet als
   * Menüpunkt, stattdessen führt der Klick auf den Gruppentitel selbst auf
   * das Bereichs-Dashboard. Fehlt der Eintrag, ist die Überschrift reiner
   * Text — die persönlichen Gruppen („Mein Training", „Lernen") haben keine
   * eigene Übersicht, ihr Dashboard IST der Menüpunkt „Dashboard".
   *
   * Seit dem 02.09.2026 haben alle drei Rechte-Bereiche ihre Übersicht; die
   * persönlichen Gruppen behalten bewusst keine. Die Regel bleibt: Der
   * Eintrag kommt erst, wenn die Seite existiert — ein Titel, der auf eine
   * 404 führt, wäre schlimmer als einer, der nichts tut.
   */
  href?: string;
  /**
   * Bereichsfarbe der Gruppe (Leons Vorgabe 01.09.2026): Verwaltung bernstein,
   * Plattform karminrot — damit auf einen Blick sichtbar ist, mit welchen
   * Rechten man gerade arbeitet.
   *
   * `"trainer"` IST GESETZT, ABER OHNE EIGENE FARBE. In `globals.css` gibt es
   * kein `[data-area="coach"]`, das den Farbton überschreibt — die Gruppe erbt
   * den GYM-Akzent. Ein festes Blau bräche DESIGN-BRIEF §1.1: Ein Gym mit
   * roter Marke hätte blaue Trainerwerkzeuge. Der Eintrag steht trotzdem da,
   * weil er noch etwas anderes auslöst: die getönte Fläche hinter der Gruppe.
   *
   * DIE PERSÖNLICHEN GRUPPEN („Mein Training", „Lernen") bleiben OHNE Eintrag
   * und damit ungetönt. Die Tönung bedeutet „das ist ein Rechte-Bereich" —
   * läge sie auch hinter den persönlichen Gruppen, wäre sie kein Signal mehr,
   * sondern Dekoration. Die Farben selbst stehen in globals.css, nicht hier.
   */
  area?: "trainer" | "verwaltung" | "admin";
  items: ShellNavItem[];
}

const exact = (href: string) => (p: string) => p === href;
const under = (href: string) => (p: string) =>
  p === href || p.startsWith(href + "/");

/**
 * Die Menü-Gruppen für ein Rechte-Set.
 *
 * Reihenfolge: erst das, wofür der Mensch dieses Konto hat (Trainerbereich →
 * Gym führen → Plattform), dann sein eigenes Training. Ein Konto mit mehreren
 * Häkchen sieht die Gruppen untereinander.
 */
export function shellNavGroups(rights: RoleSet): ShellNavGroup[] {
  const groups: ShellNavGroup[] = [];

  if (rights.trainer) {
    groups.push({
      id: "trainer",
      label: "Trainer",
      area: "trainer",
      // Die Übersicht hängt am TITEL, nicht an einem Menüpunkt (siehe href
      // im Interface) — deshalb beginnt die Liste direkt mit den Werkzeugen.
      href: "/trainer",
      items: [
        {
          href: "/trainer/students",
          label: "Athleten",
          icon: "users",
          isActive: under("/trainer/students"),
        },
        {
          href: "/trainer/opponents",
          label: "DeepFight",
          wordmark: true,
          isActive: (p) =>
            under("/trainer/opponents")(p) || under("/trainer/deepfight")(p),
          children: [
            {
              href: "/trainer/opponents",
              label: "Gegner-Scouting",
              isActive: under("/trainer/opponents"),
            },
            {
              href: "/trainer/deepfight/athletes",
              label: "Athleten-Analysen",
              isActive: under("/trainer/deepfight/athletes"),
            },
            {
              href: "/trainer/deepfight/me",
              label: "Meine Analyse",
              isActive: under("/trainer/deepfight/me"),
            },
          ],
        },
        {
          href: "/trainer/competitions",
          label: "Wettkampf",
          icon: "trophy",
          isActive: under("/trainer/competitions"),
        },
        {
          href: "/trainer/plans",
          label: "Workout-Pläne",
          icon: "clipboard",
          isActive: under("/trainer/plans"),
        },
        // Der Kursplan lebt unter /schedule (URL-Stabilität) und ist für
        // Trainer ein WERKZEUG — er steht deshalb hier und NICHT zusätzlich
        // unter „Mein Training". Zweimal dieselbe Adresse hieße: zwei Punkte
        // leuchten gleichzeitig aktiv, und der Mensch fragt sich, was ihn
        // unterscheidet.
        //
        // EINE SEITE, EIN NAME (Leons Entscheidung 02.09.2026): Der Punkt hieß
        // hier „Stundenplan", in der Verwaltung „Wochenplan" und die Seite
        // selbst „Kursplan" — drei Wörter für eine Sache, von denen ein
        // Cheftrainer zwei gleichzeitig im Menü stehen hatte. Jetzt heißt
        // überall „Kursplan". Der Begriff „Wochenplan" ist damit für das
        // reserviert, was das Konzept §7 wirklich meint: die BENANNTEN Pläne
        // („Normalbetrieb", „Sommerferien"), die die Verwaltung in Phase 3 auf
        // einer EIGENEN Seite anlegt und aktiviert. Die heißt dann
        // „Wochenpläne" (Plural) und ist etwas anderes als diese hier.
        {
          href: "/schedule",
          label: "Kursplan",
          icon: "calendar",
          isActive: under("/schedule"),
        },
      ],
    });
  }

  if (rights.verwaltung) {
    groups.push({
      id: "verwaltung",
      label: "Verwaltung",
      area: "verwaltung",
      // Seit dem 02.09.2026 hat auch dieser Bereich seine Übersicht — der
      // Titel führt dorthin und öffnet die Rubrik zugleich (Leons Vorgabe:
      // „egal welche weiteren Rechte jemand hat"). Damit rutscht die Gruppe
      // aus dem dritten Fall von GroupHeading in den zweiten.
      href: "/verwaltung",
      items: [
        {
          href: "/verwaltung/mitglieder",
          label: "Mitglieder",
          icon: "users",
          isActive: under("/verwaltung/mitglieder"),
        },
        {
          href: "/verwaltung/einladungen",
          label: "Einladungen",
          icon: "plus",
          isActive: under("/verwaltung/einladungen"),
        },
        {
          href: "/verwaltung/neuigkeiten",
          label: "Neuigkeiten",
          icon: "bell",
          isActive: under("/verwaltung/neuigkeiten"),
        },
        // WOCHENPLAN — der Kursplan als Sache des GYMS.
        //
        // ER STEHT HIER FÜR JEDE VERWALTUNG, auch für eine, die zusätzlich
        // Trainer ist (Leons Einwand 02.09.2026: „Es fehlt der Kursplan in der
        // Verwaltung"). Bis dahin blendete ihn ein `rights.trainer`-Gate aus,
        // mit der Begründung, ein Trainer habe den Plan ja schon oben als
        // im Trainerbereich. Das war aus Sicht des MENÜS gedacht und nicht aus
        // der des Menschen: Wer den Verwaltungsbereich aufklappt, um das Gym zu
        // führen, erwartet den Kursplan dort — und findet ihn nicht, weil ein
        // ganz anderes Häkchen ihn versteckt. Eine Rubrik muss vollständig
        // sein; ein Eintrag, der je nach zweiter Rolle verschwindet, ist keine
        // Aufräumhilfe, sondern eine Lücke.
        //
        // ER HEISST WIE ÜBERALL „Kursplan" (Leon 02.09.2026) — siehe die
        // Begründung im Trainerbereich oben. „Wochenplan" bleibt dem
        // Phase-3-Objekt vorbehalten (benannte Pläne, `schedulePlans`).
        //
        // ER FÜHRT AUF DIESELBE SEITE wie der Punkt im Trainerbereich — seit dem
        // 02.09. auch mit denselben Rechten: `firestore.rules` erlaubt Schreiben
        // an `trainingSessions` Trainern UND Verwaltung (per REST nachgemessen:
        // beide 200, Athlet 403), und `app/schedule/page.tsx` bietet die Pflege
        // seitdem beiden an. Der frühere Kommentar hier behauptete das
        // Gegenteil — er stammte aus der Zeit, als das UI hinter den Regeln
        // zurückblieb. Mit Phase 3 bekommt dieser Punkt seine eigene Adresse;
        // bis dahin trägt er die Unterscheidung nur im Namen.
        //
        // BEIDE ZEILEN GELTEN ALS AKTIV — die im Trainerbereich und diese.
        //
        // Ein erster Versuch am 02.09. ließ diese hier bewusst NICHT leuchten,
        // damit ein Cheftrainer nicht zwei markierte Zeilen für eine Seite
        // sieht. Das war falsch, und zwar sichtbar: `groupContains()` in
        // StaffSidebar fragt genau diese Funktion, um zu entscheiden, welche
        // Rubrik AUFGEKLAPPT steht. Eine Zeile, die nie aktiv ist, nimmt ihrer
        // Rubrik den Anspruch auf die Seite — wer in der Verwaltung auf
        // „Kursplan" klickte, landete auf der Seite und sah, wie das Akkordeon
        // unter seiner Hand zum Trainerbereich sprang (Leons Einwand 02.09.).
        //
        // Zwei markierte Zeilen entstehen dadurch trotzdem nicht: Es ist immer
        // nur EINE Rechte-Rubrik aufgeklappt, und welche das ist, entscheidet
        // die Sidebar — sie bleibt in der Rubrik, aus der man kam
        // (`openGroupId` in StaffSidebar). Sichtbar ist deshalb genau eine.
        {
          href: "/schedule",
          label: "Kursplan",
          icon: "calendar" as IconName,
          isActive: under("/schedule"),
        },
      ],
    });
  }

  if (rights.admin) {
    groups.push({
      id: "admin",
      label: "Plattform",
      area: "admin",
      // Die Plattform-Übersicht (Leons Vorgabe 02.09.2026): gym-übergreifende
      // Kennzahlen, die in KEINER Gym-Oberfläche vorkommen dürfen. Sie ist
      // ein Vorgriff auf die Admin-Konsole aus Phase 3 (Konzept §10) — die
      // Zahlen stehen schon, das Anlegen und Sperren von Gyms folgt dort.
      href: "/admin",
      items: [
        {
          href: "/admin/users",
          label: "Nutzer",
          icon: "shield",
          isActive: under("/admin/users"),
        },
        {
          href: "/admin/seed",
          label: "Demo-Daten",
          icon: "spark",
          isActive: under("/admin/seed"),
        },
      ],
    });
  }

  groups.push({
    id: "training",
    label: "Mein Training",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: "chart",
        isActive: exact("/dashboard"),
      },
      {
        href: "/workout/generator",
        label: "Workouts",
        icon: "barbell",
        isActive: under("/workout"),
      },
      {
        href: "/timer",
        label: "Timer",
        icon: "timer",
        isActive: under("/timer"),
      },
      // Nur für Menschen ohne Trainer-Häkchen: mit Häkchen steht dieselbe
      // Adresse oben im Trainerbereich (siehe dort).
      //
      // ER LEUCHTET NICHT AUF, WENN OBEN SCHON DIE VERWALTUNGS-ZEILE STEHT: Beide führen
      // heute auf dieselbe Seite, und zwei gleichzeitig markierte Zeilen
      // ließen den Menschen rätseln, was ihn unterscheidet. Markiert wird die
      // Zeile in der RECHTE-Gruppe — wer Verwaltung ist und den Plan öffnet,
      // tut das als Gym, nicht als Athlet. Mit Phase 3 werden es zwei echte
      // Seiten und die Ausnahme fällt weg.
      ...(rights.trainer
        ? []
        : [
            {
              href: "/schedule",
              label: "Kursplan",
              icon: "calendar" as IconName,
              isActive: rights.verwaltung ? () => false : under("/schedule"),
            },
          ]),
    ],
  });

  groups.push({
    id: "lernen",
    label: "Lernen",
    items: [
      {
        href: "/techniques",
        label: "Techniken",
        icon: "glove",
        isActive: under("/techniques"),
      },
      {
        href: "/regeln",
        label: "Regeln",
        icon: "book",
        isActive: under("/regeln"),
      },
      { href: "/quiz", label: "Quiz", icon: "star", isActive: under("/quiz") },
      {
        href: "/library",
        label: "Sammlung",
        icon: "heart",
        isActive: under("/library"),
      },
    ],
  });

  return groups;
}

/**
 * Das Konto-Menü — die persönlichen Wege.
 *
 * Sie hingen bis zum 01.09.2026 nachmittags als Fußgruppe am unteren Rand der
 * Sidebar. Leon wollte oben links den Account „wie in der Vorlage" mit einem
 * Aufklapp-Menü für Einstellungen und Abmelden — damit gehören sie dorthin:
 * Kampfprofil, Einstellungen und Hilfe betreffen die PERSON, nicht den
 * Bereich, in dem sie gerade arbeitet. Die Sidebar wird unten dadurch leer
 * bis auf die Rechtszeile, und genau das war das Ziel („sie soll leichter
 * wirken").
 *
 * Hell/Dunkel und Abmelden stehen im selben Panel, sind aber keine Links —
 * die rendert `StaffSidebar` selbst.
 */
export const SHELL_ACCOUNT_ITEMS: ShellNavItem[] = [
  {
    href: "/profile",
    label: "Account-Einstellungen",
    icon: "settings",
    isActive: under("/profile"),
  },
  {
    href: "/kampfprofil",
    label: "Kampfprofil",
    icon: "target",
    // /deepfight leitet auf /kampfprofil um (CLAUDE.md) — beide Adressen
    // sollen denselben Punkt hervorheben.
    isActive: (p) => under("/kampfprofil")(p) || under("/deepfight")(p),
  },
  { href: "/help", label: "Hilfe", icon: "info", isActive: under("/help") },
];

// ─── Der Pfad im Header (Leon 01.09.2026) ────────────────────────────────────

export interface ShellCrumb {
  label: string;
  /** Fehlt beim letzten Glied und bei Gruppen — die sind keine Seiten. */
  href?: string;
}

/**
 * „Trainerbereich › Schüler" — der Weg zur gerade offenen Seite.
 *
 * ER WIRD AUS DENSELBEN GRUPPEN GEBAUT wie die Sidebar und nicht aus einer
 * zweiten Tabelle. Zwei Listen wären zwei Stellen, an denen ein neuer
 * Menüpunkt eingetragen werden müsste — und die zweite wäre die, die man
 * vergisst. Die Gruppen-Überschrift ist bewusst KEIN Link: „Trainerbereich"
 * ist keine Adresse, sondern eine Schublade.
 *
 * TIEFERE SEITEN BEKOMMEN KEIN DRITTES GLIED. Auf `/trainer/students/abc123`
 * steht „Trainerbereich › Schüler" — der Name des Schülers stünde erst nach
 * dem Laden fest, und ein Pfad, der eine Sekunde später länger wird, springt.
 * Die H1 der Seite sagt ohnehin, wer gemeint ist.
 *
 * Findet sich gar nichts (z. B. `/beitreten`), kommt eine leere Liste zurück
 * und der Header zeigt links nichts an — besser als ein geratener Name.
 */
export function shellBreadcrumb(
  pathname: string,
  rights: RoleSet,
): ShellCrumb[] {
  for (const group of shellNavGroups(rights)) {
    // Die Übersichtsseite eines Bereichs hat keinen eigenen Menüpunkt mehr —
    // ihr Pfad ist das Gruppenwort selbst („Trainer"), sonst stünde der
    // Header auf der Startseite des Bereichs leer.
    if (group.href && pathname === group.href) {
      return group.label ? [{ label: group.label }] : [];
    }
    for (const item of group.items) {
      // Seit die Gruppentitel klickbar sind, ist „Trainer" eine echte
      // Adresse — das erste Glied trägt sie mit, wo es sie gibt. Gruppen
      // ohne Übersichtsseite bleiben reiner Text.
      const child = item.children?.find((c) => c.isActive(pathname));
      if (child) {
        return [
          { label: group.label ?? "", href: group.href },
          { label: item.label, href: item.href },
          { label: child.label },
        ].filter((c) => c.label);
      }
      if (item.isActive(pathname)) {
        return [
          { label: group.label ?? "", href: group.href },
          { label: item.label },
        ].filter((c) => c.label);
      }
    }
  }
  const personal = SHELL_ACCOUNT_ITEMS.find((i) => i.isActive(pathname));
  return personal ? [{ label: personal.label }] : [];
}
