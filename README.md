# Dossier – Ausgabetool für Korrekturen

Deutschsprachige Web-App zum Zusammenstellen von Fehlerlisten, korrigierten Texten mit Randbemerkungen und Kommentaren. Mehrere Dossiers lassen sich einzeln als PDF oder gemeinsam als ZIP herunterladen.

## Verwendung

1. Dossier benennen, Name und Klasse ergänzen.
2. Den Bereich **Fehlerliste**, **Korrigierter Text** oder **Kommentare** wählen.
3. Dateien ablegen oder Text direkt einfügen. Jede Datei wird dem aktuell gewählten Bereich und Dossier zugeordnet.
4. Mit **Prüfen** Inhalte bearbeiten oder einem anderen Bereich zuordnen.
5. PDF herunterladen; mit **Neues Dossier** weitere Personen anlegen und mit **Alle PDFs als ZIP** gesammelt exportieren.
6. Vor dem Schliessen **Projekt sichern**. Die JSON-Datei enthält alle Inhalte und PDF-Originale. **Projekt öffnen** fügt gesicherte Dossiers dem aktuellen Projekt hinzu.

## Formate und Grenzen

- DOCX: Text, Tabelleninhalte, Kommentare mit R-Verweisen, Fuss- und Endnoten. Einfügungen der Änderungsverfolgung werden übernommen, Löschungen ausgelassen. Bilder und ursprüngliches Seitenlayout werden nicht übernommen.
- ODT: Text, Tabelleninhalte und eingebettete Anmerkungen; kein Erhalt des ursprünglichen Layouts oder der Bilder.
- PDF: Originalseiten im Anhang und auslesbare Anmerkungen als Text. Auch gescannte PDFs können als Original angehängt werden. Keine OCR, keine passwortgeschützten PDFs. Interaktive Formulare und Signaturen werden nicht als interaktive beziehungsweise gültig signierte Dokumente erhalten. PDF-Originale vor dem Import bei Bedarf im PDF-Programm drucken/flatten.
- TXT, Markdown, CSV, TSV, HTML und JSON: vereinheitlichte Textdarstellung. Markdown wird als lesbarer Quelltext übernommen, CSV/TSV nicht fachlich interpretiert. HTML-Skripte und aktive Inhalte werden nicht ausgeführt.
- UTF-8, UTF-16 (mit BOM) und Windows-1252 werden eingelesen.
- Keine alten DOC/RTF-Dateien oder Bilddateien. Vorher nach DOCX oder PDF konvertieren.
- 25 MB pro Datei, 80 MB entpackte Office-Inhalte, 150 MB pro Projektimport. Sehr grosse Sammlungen hängen vom Gerätespeicher ab.
- PDF-Ausgabe mit eingebetteter Roboto-Schrift: europäische Sprachen, Griechisch und Kyrillisch; keine vollständige Abdeckung aller Schriftsysteme oder Emojis.
- Seitenzahlen werden auch auf angehängten PDF-Seiten unten rechts ergänzt. Alle Ergebnisse vor der Weitergabe prüfen.

## Datenschutz

Dokumente werden ausschliesslich im Browser verarbeitet. Kein Backend, keine Analysewerkzeuge, keine externen Schrift- oder Bibliotheksaufrufe zur Laufzeit. GitHub enthält nur Anwendungscode, Tests und Build-Konfiguration; hochgeladene Dokumente werden nicht übertragen. Hosting-Zugriffe unterliegen den normalen GitHub-Pages-Protokollen. Inhalte bleiben nur im aktuellen Tab; Projekte bewusst als lokale Datei sichern. Projektdateien enthalten personenbezogene Inhalte unverschlüsselt und müssen entsprechend geschützt aufbewahrt werden.

## Entwicklung

Node.js 24+, `npm ci`, `npm run dev`. `npm test` prüft Textdekodierung und Projektvalidierung. `npm run build` erstellt `dist/`. GitHub Actions baut und veröffentlicht bei Änderungen an `main` auf GitHub Pages; Pages muss auf GitHub Actions eingestellt sein. Alle Bibliotheken werden im Build mitgeliefert.

Die Anwendung benötigt keine API-Schlüssel. Quellen: PDF.js (Apache-2.0), pdf-lib (MIT), pdfmake (MIT; Roboto Apache-2.0), fflate (MIT), Vite (MIT). Zugehörige Lizenzdateien liegen in den installierten npm-Paketen.
