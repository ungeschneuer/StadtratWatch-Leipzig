# Leipzig: Untertitel lokal mit Whisper erzeugen

Für fast alle Leipziger Sitzungen liefert der Video-Hoster KI-Untertitel, die `leipzig-recordings` archiviert. Drei
Sitzungstage haben keine (2025-12-18, 2026-01-28, 2026-02-25). Für sie wurden die Untertitel lokal mit
[whisper.cpp](https://github.com/ggml-org/whisper.cpp) erzeugt. Die Abstimmungsprüfung (Ansagen) und die Zeiten der
Reden ([`leipzig-site-data`](../../src/scripts/leipzig-site-data/README.md)) nutzen sie wie die des Hosters.

Das läuft nur lokal: Auf GitHub Actions ohne GPU wäre es zu langsam, und neue Sitzungen haben Untertitel vom Hoster.

## Werkzeuge

- `whisper.cpp` (Homebrew: `brew install whisper-cpp`), getestet mit 1.9.5
- Modell `ggml-large-v3-turbo.bin` (1,6 GB, SHA-256 `1fc70f77…2bc69`) von
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin`
- VAD-Modell `ggml-silero-v5.1.2.bin` (SHA-256 `29940d98…04ea2cf`) von
  `https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin`
- `ffmpeg`

Auf einem Apple M1 schafft das Modell mit Metal etwa das Siebenfache der Echtzeit, eine Sitzung von sieben Stunden
dauert eine knappe Stunde.

## Ablauf je Sitzung

```bash
session=2026-01-28
hls=$(jq -r --arg s "$session" '.recordings[] | select(.sessionId == $s) | .hlsUrl' data/leipzig-8/recordings.json)
low="$(dirname "$hls")/$(curl -s "$hls" | grep -v '^#' | head -1)"

# Nur die Tonspur, 16 kHz mono
ffmpeg -rw_timeout 30000000 -i "$low" -vn -ac 1 -ar 16000 -c:a pcm_s16le "output/whisper/$session.wav"

whisper-cli -m output/whisper/ggml-large-v3-turbo.bin -l de -f "output/whisper/$session.wav" \
  --vad -vm output/whisper/ggml-silero-v5.1.2.bin -mc 0 -ovtt -of "output/whisper/$session" -np
```

**Warum VAD und `-mc 0`:** Ohne Sprachaktivitätserkennung erfindet Whisper in Stille und Musik Text (vor Sitzungsbeginn
etwa „Vertraue und glaube, es hilft, es heilt die göttliche Kraft!“). Ohne `-mc 0` (kein Vortext als Kontext) bleibt es
in Pausen in Schleifen hängen: Im ersten Lauf stand 35 Minuten lang „Und ich schließe auch hier.“. Mit beiden
Einstellungen gab es keine Schleifen und keine Halluzinationen, bei gleicher Übereinstimmung mit den Untertiteln des
Hosters (96 % der Wörter in einer Stichprobe vom 03.09.2026).

## Ablegen

Die Datei bekommt im Kopf die Angaben zur Herkunft, wie die Dateien des Hosters (`Type:AI Generated`):

```text
WEBVTT
Kind:Caption
Language:de
Type:AI Generated
Model:ggml-large-v3-turbo, whisper.cpp 1.9.5, VAD ggml-silero-v5.1.2, max-context 0
Source:local transcription of the HLS audio, StadtratWatch Leipzig
```

Sie liegt als `data/leipzig-8/<datum>/subtitles-<datum>.vtt`. In `recordings.json` bekommt die Sitzung `subtitleFile`
und `subtitleSha256`; `subtitleUrl` bleibt `null`. Danach `leipzig-votings --corrections-only -s <datum>` (Ansagen) und
`leipzig-site-data` (Reden).
