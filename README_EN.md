# DSH Environment Context

[简体中文](README.md)

A strict DSH port of `SillyTavern-Environment-Context`, exposing a native **Environment Context** settings page and injecting time, weather, location, battery, and device data through one dynamic system-prompt section.

## Install from scratch

```powershell
pnpm install
pnpm run check
pnpm pack
dsh plugin --profile web add .\dsh-environment-context-0.2.0.tgz
```

Restart the existing DSH Web Host, refresh `http://127.0.0.1:3080`, then open **Settings → Environment Context**.

## Feature parity

The plugin includes Open-Meteo, MET Norway, and wttr.in with explicit Open-Meteo fallback; manual city and browser Geolocation; Nominatim, BigDataCloud, and Photon reverse geocoding with ordered automatic fallback; provider-keyed stale-safe caches; all original display toggles; battery/device collection; conditional settings; live preview; and force-refresh testing.

## One unavoidable DSH difference

DSH requires every model-visible input to be reconstructable from the session log. Ephemeral in-chat depth and author-note insertion have no DSH equivalent: `agent.inject()` or `PromptContext` would persist session events. The UI therefore exposes only the supported system-prompt placement, implemented with `systemPrompt.section()`. Compatibility fields remain in configuration, but unsupported modes are never simulated.

Geolocation, Battery Status, and UA Client Hints are used as browser/desktop-WebView equivalents. A desktop shell may withhold location, battery, or model information; unavailable values are reported rather than fabricated.
