# Changelog

## 0.4.0 — 2026-10-02

- Adapt to **DSH 0.2.0-rc.2**: user settings are now volatile `Config` fields read through the plugin entry during every prompt assembly, and the settings page binds that entry's form through `ctx.configForms`.
- Remove the deleted `installSettingsSection`, `settingsNamespace`, and `settingsScope` APIs, and the `dsh-client-runtime` / `dsh-client-web-react` client imports.
- Register the injected section with `interpolate: false`, so snapshot text (place names, weather wording, a custom device name) can never be read as prompt variables.
- Follow the entry snapshot's `writable` alone for editability, so a single field that fails to decode cannot lock the settings page.
- Keep `sectionOrder` ordinary configuration rather than a user setting; the HTTP snapshot route stays a raw `webServer` exact route.
- Tests now reproduce the real Host form projection and decode it the way the browser does, drive the real `ctx.settings.update()` against a real Loader entry (real `Entry._commitVolatile` and its `loader/volatile-update` event; only the profile YAML persistence and root-Include reconcile are stubbed) asserting the next assembly renders the new value while the plugin is applied exactly once, drive the real `systemPrompt` service, and load the shipped browser bundle through the `ModuleLoader` protocol.

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
