# Agent Note: ephemeral environment context

## Decision

Use a dynamic system-prompt section plus an in-memory browser snapshot route. Do not use `PromptContext` or `agent.inject()`, because those mechanisms deliberately materialize durable user-role context snapshots.

The browser records its current preferred language in each snapshot. One shared classifier normalizes case and underscores, then treats every non-empty value beginning with `zh` as Chinese (`zh-CN`, `zh-TW`, and `zh_CN` included); all other values select English. The configured locale is a fallback only. Prompt rendering, the full settings UI, weather, geocoding, and wind-direction output use the same two-way choice, and remote-data caches include that language so localized values cannot leak across variants.

Weather provider `auto` follows one fixed order: Open-Meteo, MET Norway, then wttr.in. It records each failed attempt and returns the first success. Explicit provider choices do not silently switch providers, matching reverse-geocoding semantics.

## DSH 0.2 settings migration

User settings are volatile fields on the plugin `Config` (`.volatile()` per field); `sectionOrder` stays ordinary configuration and is deliberately not a user setting. A settings write that differs only in volatile fields does **not** restart the plugin: `cordis-plugin-loader`'s `Entry._commitVolatile` resolves the new raw config with the entry's own schema and writes each changed value into the running fiber's volatile reference (`updateVolatile`). That is precisely why the injected section must call `entry.field.get()` on every assembly — a snapshot taken when the plugin is applied would keep the old value forever, because nothing remounts it. The regression drives the real `ctx.settings.update()` against a **real Loader entry** (`ctx.loader.create` / `Entry.update`), so `Entry._commitVolatile` and its `loader/volatile-update` event are the production ones, and asserts that the next assembly renders the new value while the plugin is applied exactly once. Only the profile YAML write and the root-Include reconcile are stubbed, because those need a real profile directory.

The settings page binds the entry form with `ctx.configForms.get('environment-context')` (the profile entry id — 0.2 has no separate settings namespace) and registers through `ctx.configForms.whileServed([...])` inside `ctx.effect`, so a deployment that never serves the entry shows no page. Editability follows the snapshot's `writable` alone; never gate it on the decode status, or one field the wire format cannot carry turns the whole page read-only with defaults on screen.

Rule: never put `z.transform` on a volatile field. DSH projects volatile fields into a serialized form schema for the browser (host-side `plainSchema` does `new z(schema.toJSON())` and then `form.toJSON()` again); a callback revived through `new Function` loses its `toJSON`, is dropped by the second serialization, and the browser decode then throws `callback is not a function`. Validate in the settings UI and defensively where the value is consumed instead.

The injected section is registered with `interpolate: false`, so snapshot text is never resolved as a prompt variable. The snapshot HTTP route stays a raw `webServer` exact route: in 0.2 the browser cookie only guards index/static serving (`connection.authorizeIndex`) and the `/api` channel (`connection.admit`), so a same-origin `fetch` from the page keeps working. The settings service is optional — the plugin loads, injects, and serves its routes without it.

## Invariant

DSH requires all model-visible input to remain reconstructable. “Not saved with conversation history” therefore means no chat message and no accumulating runtime-context node; it cannot mean invisible to request audit logs.

## Security and privacy

The snapshot endpoint accepts at most a 64 KiB JSON body, validates the timestamp, sanitizes rendered strings, and retains one latest snapshot in memory. Configuration lives in the plugin's own `Config` (volatile fields, edited through that entry's ConfigForm). Weather and geocoding requests use only HTTPS endpoints from the configured providers.
