# DSH Environment Context

[简体中文](README.md)

Real-time time, weather, location, battery, and system-device context for DeepSeek Harness. The plugin contributes a native **Environment Context** settings page and injects one dynamic system-prompt section without creating chat messages or accumulating context nodes.

## Install

Use the standard DSH GitHub plugin form (no version pin — installs the latest from the repository):

```powershell
dsh plugin --profile web add --allow-build=dsh-environment-context github:liqiming-whu/dsh-environment-context --trust-lockfile
```

`--allow-build` permits the Git source package to run its `prepare` build; `--trust-lockfile` skips the lockfile supply-chain verification (versions published less than 24 hours ago trip pnpm's `minimumReleaseAge` gate — drop it if your pnpm does not accept the flag). Restart the existing DSH Web Host, refresh `http://127.0.0.1:3080`, and open **Settings → Environment Context**.

## Features

- Open-Meteo, MET Norway, and wttr.in, with explicit Open-Meteo fallback.
- Manual city or browser Geolocation; no proxy-address or public-IP geolocation.
- Nominatim, BigDataCloud, and Photon reverse geocoding with ordered automatic fallback.
- Provider-keyed, stale-safe caches and complete display toggles.
- Browser battery plus Host system identity from Node `os` and Windows CIM.
- Native settings, conditional fields, live injection preview, status diagnostics, and force-refresh testing.

## Injection and privacy

The plugin uses DSH's official `systemPrompt.section()`. It does not call `agent.inject()` or register dynamic `PromptContext`, so no environment message appears or accumulates in the chat timeline. DSH still records the assembled model-visible system request for replay and audit.

Coordinates are sent only to the selected weather and reverse-geocoding services. Battery and device summaries remain in same-origin Host process memory and disappear on Host restart.

## Development

```powershell
pnpm install
pnpm run check
pnpm pack
```

## License

[MIT](LICENSE)
