# Agent Note: ephemeral environment context

## Decision

Use a dynamic system-prompt section plus an in-memory browser snapshot route. Do not use `PromptContext` or `agent.inject()`, because those mechanisms deliberately materialize durable user-role context snapshots.

## Invariant

DSH requires all model-visible input to remain reconstructable. “Not saved with conversation history” therefore means no chat message and no accumulating runtime-context node; it cannot mean invisible to request audit logs.

## Security and privacy

The endpoint accepts only a 32 KiB JSON body, validates the timestamp, sanitizes all rendered strings, and retains one latest snapshot in memory. Configuration uses the Host settings namespace. Weather uses only HTTPS Open-Meteo endpoints.
