# Agent Note: ephemeral environment context

## Decision

Use a dynamic system-prompt section plus an in-memory browser snapshot route. Do not use `PromptContext` or `agent.inject()`, because those mechanisms deliberately materialize durable user-role context snapshots.

The browser records its current preferred language in each snapshot. One shared classifier normalizes case and underscores, then treats every non-empty value beginning with `zh` as Chinese (`zh-CN`, `zh-TW`, and `zh_CN` included); all other values select English. The configured locale is a fallback only. Prompt rendering, the full settings UI, weather, geocoding, and wind-direction output use the same two-way choice, and remote-data caches include that language so localized values cannot leak across variants.

Weather provider `auto` follows one fixed order: Open-Meteo, MET Norway, then wttr.in. It records each failed attempt and returns the first success. Explicit provider choices do not silently switch providers, matching reverse-geocoding semantics.

## Invariant

DSH requires all model-visible input to remain reconstructable. “Not saved with conversation history” therefore means no chat message and no accumulating runtime-context node; it cannot mean invisible to request audit logs.

## Security and privacy

The snapshot endpoint accepts at most a 64 KiB JSON body, validates the timestamp, sanitizes rendered strings, and retains one latest snapshot in memory. Configuration uses the Host settings namespace. Weather and geocoding requests use only HTTPS endpoints from the configured providers.
