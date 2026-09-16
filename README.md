# Dossier – Ausgabetool für Korrekturen

Deutschsprachige Web-App zum Zusammenstellen von Fehlerlisten, korrigierten Texten mit Randbemerkungen und Kommentaren. Mehrere Dossiers lassen sich einzeln als PDF oder gemeinsam als ZIP herunterladen.

## Verwendung

1. Bis zu **100 Dateien pro Auswahl** gemeinsam auswählen oder ablegen. Ein Paket wird speicherschonend Datei für Datei verarbeitet; eine Fortschrittsanzeige zeigt den Stand. Fehler einzelner Dateien stoppen den restlichen Import nicht und bleiben im Importbericht sichtbar. Mehr als 100 Dateien werden ohne Teilimport abgewiesen; weitere Pakete können anschliessend ergänzt werden. Die aktuelle Registerkarte hat keinen Einfluss auf die automatische Zuordnung.
2. Das Namensschema ist `Klassenbezeichnung_VornameNachname_Dokumentart`, beispielsweise:
   - `S4d_AnnaMeier_Fehlerliste.docx`
   - `S4d_AnnaMeier_Text_mit_Randbemerkungen.pdf`
   - `S4d_AnnaMeier_Kommentar.txt`
Auch die Kombination aus der Korrekturwerkstatt wird automatisch erkannt:
   - `S4d_AnnaMeier_mit_Randbemerkungen.docx` → Text mit Randbemerkungen
   - `S4d_AnnaMeier_mit_Randbemerkungen-korrektur.docx` → Kommentar / Gutachten
   - `S4d_AnnaMeier_Fehlerliste.pdf` → Fehlerliste

3. Klasse und Name bilden den gemeinsamen Schlüssel. Gleiche Namen in unterschiedlichen Klassen bleiben getrennt. Auch zeitversetzte Uploads ergänzen das passende Dossier. Die Erkennung toleriert übliche Trennzeichen, CamelCase, Gross-/Kleinschreibung, Umlaute/ae/oe/ue und explizite Versionszusätze wie `_v2` oder `_final`. Sie verwendet keinen unscharfen Namensabgleich.
4. Erkannte Arten: Fehlerliste/Fehlerübersicht/Fehlerprotokoll/Fehleranalyse; Text mit Randbemerkungen/Randkommentaren, korrigierter Text, Text/Aufsatz; Kommentar/Gesamtkommentar/Schlusskommentar/Feedback/Rückmeldung/Beurteilung.
5. Unter **Zuordnung klären** unbekannte oder mehrdeutige Namen manuell einem Dossier und einer Dokumentart zuweisen. Doppelte Arten überschreiben niemals vorhandene Dateien. Bei zwei Versionen die nicht benötigte Quelle entfernen und dann die gewünschte zuordnen.
6. Ein vollständiges Dossier enthält **genau eine Fehlerliste, einen Text mit Randbemerkungen und einen Kommentar**. Fehlende und doppelte Arten werden angezeigt. PDF-Export ist erst bei vollständigen Dossiers möglich; nach dem Import werden standardmässig alle vollständigen, eindeutig zugeordneten Dossiers automatisch als ein ZIP heruntergeladen. Unvollständige Dossiers und Zuordnungskonflikte werden ausgelassen und in der Oberfläche sowie in `Ausgabebericht.txt` im ZIP ausgewiesen. Einzelne Exportfehler stoppen die übrigen Dossiers nicht. Die Automatik kann vor dem Import ausgeschaltet werden; **Alle fertigen Dossiers als ZIP erstellen** startet die Gesamtausgabe jederzeit erneut. Ein Downloadlink bleibt nach der Ausgabe sichtbar.
7. Mit **Prüfen** Inhalte bearbeiten und bei Bedarf Dokumentart oder Dossier ändern. Bereits belegte Arten werden geschützt. Direkte Texteingabe bleibt als manuelle Alternative für einen noch leeren Bereich erhalten.
8. Vor dem Schliessen **Projekt sichern**. Die JSON-Datei enthält alle Inhalte, PDF-Originale, Zuordnungsschlüssel und ungeklärte Dateien. **Projekt öffnen** fügt gesicherte Dossiers dem aktuellen Projekt hinzu.

## Formate und Grenzen

- DOCX: Text, Tabelleninhalte, vollständige Kommentare in einer eigenen Randspalte neben dem zugehörigen Absatz, hervorgehobene Textstellen und einfache Nummernverweise, Fuss- und Endnoten. Einfügungen der Änderungsverfolgung werden übernommen, Löschungen ausgelassen. Bilder und ursprüngliches Seitenlayout werden nicht übernommen.
- ODT: Text, Tabelleninhalte und eingebettete Anmerkungen; kein Erhalt des ursprünglichen Layouts oder der Bilder.
- PDF: Originalseiten im Anhang und auslesbare Anmerkungen als Text. Auch gescannte PDFs können als Original angehängt werden. Keine OCR, keine passwortgeschützten PDFs. Interaktive Formulare und Signaturen werden nicht als interaktive beziehungsweise gültig signierte Dokumente erhalten. PDF-Originale vor dem Import bei Bedarf im PDF-Programm drucken/flatten.
- TXT, Markdown, CSV, TSV, HTML und JSON: vereinheitlichte Textdarstellung. Markdown wird als lesbarer Quelltext übernommen, CSV/TSV nicht fachlich interpretiert. HTML-Skripte und aktive Inhalte werden nicht ausgeführt.
- UTF-8, UTF-16 (mit BOM) und Windows-1252 werden eingelesen.
- Keine alten DOC/RTF-Dateien oder Bilddateien. Vorher nach DOCX oder PDF konvertieren.
- 25 MB pro Datei, 80 MB entpackte Office-Inhalte, 150 MB pro Projektimport. Sehr grosse Sammlungen hängen vom Gerätespeicher ab.
- PDF-Ausgabe mit eingebetteter Roboto-Schrift: europäische Sprachen, Griechisch und Kyrillisch; keine vollständige Abdeckung aller Schriftsysteme oder Emojis.
- Seitenzahlen werden auch auf angehängten PDF-Seiten unten rechts ergänzt. Alle Ergebnisse vor der Weitergabe prüfen.

Die Randkommentar-Darstellung gilt auch für bereits gesicherte Projekte mit dem bisherigen Importformat. Erneut exportieren genügt. Bei sehr langen Absätzen oder Kommentaren wird die Zweispaltendarstellung auf der nächsten Seite fortgesetzt. Kommentare ohne auffindbaren Verweis bleiben als solche gekennzeichnet erhalten.

## Datenschutz

Dokumente werden ausschliesslich im Browser verarbeitet. Kein Backend, keine Analysewerkzeuge, keine externen Schrift- oder Bibliotheksaufrufe zur Laufzeit. GitHub enthält nur Anwendungscode, Tests und Build-Konfiguration; hochgeladene Dokumente werden nicht übertragen. Hosting-Zugriffe unterliegen den normalen GitHub-Pages-Protokollen. Inhalte bleiben nur im aktuellen Tab; Projekte bewusst als lokale Datei sichern. Projektdateien enthalten personenbezogene Inhalte unverschlüsselt und müssen entsprechend geschützt aufbewahrt werden.

## Entwicklung

Node.js 24+, `npm ci`, `npm run dev`. `npm test` prüft Textdekodierung und Projektvalidierung. `npm run build` erstellt `dist/`. GitHub Actions baut und veröffentlicht bei Änderungen an `main` auf GitHub Pages; Pages muss auf GitHub Actions eingestellt sein. Alle Bibliotheken werden im Build mitgeliefert.

Die Anwendung benötigt keine API-Schlüssel. Quellen: PDF.js (Apache-2.0), pdf-lib (MIT), pdfmake (MIT; Roboto Apache-2.0), fflate (MIT), Vite (MIT). Zugehörige Lizenzdateien liegen in den installierten npm-Paketen.
