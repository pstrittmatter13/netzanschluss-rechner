"""Netzkosten-Atlas von Daniel Maier unverändert nach atlas/ kopieren.

Quelle: https://github.com/Signenum/netzkosten-atlas (CC BY-NC 4.0). Kopiert wird der ganze Stand
(Karte index.html, assets/, data/, src/ mit Kartenvorlage und Erzeugungsskript, METHODIK.md, LICENSE),
ohne .git und docs/. Herkunft (Commit, Datum, Abruf) steht danach in atlas/HERKUNFT.txt.
Nichts in atlas/ von Hand ändern: Anpassungen macht src/baue_seite.py beim Erzeugen von index.html.

Aufruf im Projektordner:   python src/hole_atlas.py [Commit]      (ohne Commit: neuester Stand)
Benötigt: git, Python 3.9+ (nur Standardbibliothek).
"""
import datetime
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

URL = "https://github.com/Signenum/netzkosten-atlas.git"
PROJEKT = Path(__file__).resolve().parent.parent
ZIEL = PROJEKT / "atlas"
WEGLASSEN = {".git", "docs"}


def git(*args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True, encoding="utf-8").stdout.strip()


def main():
    commit = sys.argv[1] if len(sys.argv) > 1 else None
    with tempfile.TemporaryDirectory() as tmp:
        quelle = Path(tmp) / "atlas"
        subprocess.run(["git", "clone", "-q", URL, str(quelle)], check=True)
        if commit:
            git("checkout", "-q", commit, cwd=quelle)
        stand = git("log", "-1", "--format=%H|%ci|%s", cwd=quelle).split("|", 2)

        if ZIEL.exists():
            shutil.rmtree(ZIEL)
        ZIEL.mkdir()
        for teil in quelle.iterdir():
            if teil.name in WEGLASSEN:
                continue
            (shutil.copytree if teil.is_dir() else shutil.copy2)(teil, ZIEL / teil.name)

    (ZIEL / "HERKUNFT.txt").write_text(
        "Netzkosten-Atlas Deutschland · Daniel Maier · CC BY-NC 4.0\n"
        f"Quelle:  {URL[:-4]}\n"
        f"Commit:  {stand[0]}\n"
        f"Datum:   {stand[1]}\n"
        f"Meldung: {stand[2]}\n"
        f"Abgerufen: {datetime.datetime.now():%d.%m.%Y %H:%M} mit src/hole_atlas.py (unverändert, ohne .git und docs/)\n",
        encoding="utf-8")
    print("Atlas kopiert:", stand[0][:7], stand[1])


if __name__ == "__main__":
    main()
