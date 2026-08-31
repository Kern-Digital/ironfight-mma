/**
 * In die Zwischenablage kopieren — mit Rückfallweg.
 *
 * `navigator.clipboard` gibt es NUR in sicheren Kontexten (https oder
 * localhost). Wer den Dev-Server vom Handy über die LAN-IP aufruft, hat
 * schlichtes http — dort ist die API nicht vorhanden, und genau dort will man
 * einen Einladungslink kopieren. Deshalb der alte `execCommand`-Weg als
 * Rückfall: unsichtbares Textfeld, auswählen, kopieren.
 *
 * Gibt zurück, ob es geklappt hat — die Oberfläche zeigt sonst eine Meldung
 * statt still nichts zu tun.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fällt auf den Rückfallweg durch
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    // Ausserhalb des Sichtfelds, aber fokussierbar — display:none wäre nicht
    // auswählbar und würde das Kopieren verhindern.
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
