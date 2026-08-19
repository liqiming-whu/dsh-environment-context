# Changelog

## 0.3.4 — 2026-08-19

- Add automatic weather-provider failover in the fixed order Open-Meteo → MET Norway → wttr.in.
- Keep explicit weather-provider selections strict instead of silently switching providers.
- Treat every preferred-language string beginning with `zh`, including `zh-CN`, `zh-TW`, and `zh_CN`, as Chinese.
- Localize the complete settings page into English for non-Chinese browser languages.
- Replace machine-specific README examples with generic location and device placeholders.

## 0.3.3 — 2026-08-19

- Detect the browser's preferred language from every submitted environment snapshot.
- Canonicalize BCP 47 language tags, inject Chinese when the primary language resolves to `zh`, and use English otherwise.
- Localize weather conditions, wind directions, and geocoded locations while isolating caches by language.
- Document complete Chinese and English injection examples in both READMEs.

## 0.3.2 — 2026-08-18

- Register a native DSH “Environment Context” settings page.
- Add Open-Meteo, MET Norway, and wttr.in weather providers with fallback.
- Add Nominatim, BigDataCloud, and Photon reverse geocoding with ordered fallback.
- Add manual and browser-geolocation modes, provider-keyed stale caches, battery and Host system-device collection.
- Add live prompt preview and force-refresh diagnostics.
- Use dynamic `systemPrompt.section()` injection without chat timeline messages.
- Fix DSH client discovery and Windows PowerShell UTF-8 system information.
