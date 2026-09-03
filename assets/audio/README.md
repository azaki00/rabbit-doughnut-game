# Audio samples

Everything else in the game is synthesized at runtime (see `src/audio/Sfx.js`).
Drop recorded one-shots here.

## Expected files

| Name | Purpose | Accepted paths (first match wins) |
|---|---|---|
| shotgun | The gun's report | `assets/audio/shotgun.mp3`, `assets/audio/SHOTGUN-SFX.mp3`, `shotgun-sfx.mp3`, `SHOTGUN-SFX.mp3` (repo root) |

If a file is missing the game logs a warning and falls back to the synthesized
version — it never goes silent. Check the console for
`[audio] sample "shotgun" loaded from …` to confirm which path was used.
