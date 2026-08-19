# Agent Note: ephemeral environment context

## Decision

Use a dynamic system-prompt section plus an in-memory browser snapshot route. Do not use `PromptContext` or `agent.inject()`, because those mechanisms deliberately materialize durable user-role context snapshots.

The browser records its current preferred BCP 47 language in each snapshot. One shared classifier canonicalizes the tag: a primary language of `zh` selects the Chinese prompt, while every other valid language selects English. The configured locale is a fallback only. Weather, geocoding, and wind-direction output use the same two-way language choice, and remote-data caches include that language so localized values cannot leak across variants.

## Invariant

DSH requires all model-visible input to remain reconstructable. “Not saved with conversation history” therefore means no chat message and no accumulating runtime-context node; it cannot mean invisible to request audit logs.

## Security and privacy

The snapshot endpoint accepts at most a 64 KiB JSON body, validates the timestamp, sanitizes rendered strings, and retains one latest snapshot in memory. Configuration uses the Host settings namespace. Weather and geocoding requests use only HTTPS endpoints from the configured providers.
