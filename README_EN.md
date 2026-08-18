# DSH Environment Context

[简体中文](README.md)

A strict DSH port of `SillyTavern-Environment-Context`, exposing a native **Environment Context** settings page and injecting time, weather, location, battery, and device data through one dynamic system-prompt section.

## Install from scratch

```powershell
pnpm install
pnpm run check
pnpm pack
dsh plugin --profile web add .\dsh-environment-context-0.3.2.tgz
```

Restart the existing DSH Web Host, refresh `http://127.0.0.1:3080`, then open **Settings → Environment Context**.

## Feature parity

The plugin includes Open-Meteo, MET Norway, and wttr.in with explicit Open-Meteo fallback; manual city and browser Geolocation; Nominatim, BigDataCloud, and Photon reverse geocoding with ordered automatic fallback; provider-keyed stale-safe caches; all original display toggles; battery/device collection; conditional settings; live preview; and force-refresh testing.

## Injection method

DSH's only non-chat-message solution is the official `systemPrompt.section()`. The plugin therefore removes the meaningless placement setting entirely. `agent.inject()` and dynamic `PromptContext` would persist session events and do not meet this plugin's goal.

Automatic location uses browser Geolocation and battery uses Battery Status, matching the original plugin; neither proxy addresses nor public-IP geolocation are used. Device identity is collected by the DSH Host through Node `os` and Windows CIM, never User-Agent.
