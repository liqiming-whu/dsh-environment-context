# DSH Environment Context

Inject current time, timezone, weekday, weather, location, browser battery, and device information into DeepSeek Harness, with a dedicated settings page.

## Injection model

The plugin registers one dynamic `systemPrompt.section()`. Every model-request assembly reads the latest browser snapshot from Host memory and merges Host-cached Open-Meteo weather. It does not call `agent.inject()`, create `user/message` events, or register `PromptContext`, so environment messages never appear in the chat timeline or accumulate across turns. Browser snapshots are process-memory only.

DSH enforces “model-visible means reconstructable from the session log.” Consequently, the final system prompt remains part of request audit data. Removing it entirely would violate replay/audit invariants. This implementation is the least-polluting supported design: **one replacing system section, no chat node, and no accumulated context snapshots**.

## Features

- Browser-local time, timezone, and weekday
- Manual city geocoding and current Open-Meteo weather (keyless, cached, stale-aware)
- Battery Status API when available
- UA Client Hints / UA platform and model
- Dedicated settings page with field toggles, city, refresh interval, locale, and refresh button
- Same-origin memory transport; browser telemetry is not stored in settings or chat

## Install

```powershell
dsh plugin --profile web add D:\\DSH_workspace\\dsh-environment-context
```

Restart the existing DSH Web Host and refresh `http://127.0.0.1:3080`. Pin a commit for Git installs. Source installs require permission for the package `prepare` script; packed releases include `lib/`.

## Development

```bash
pnpm install
pnpm run check
pnpm run build
pnpm pack
```

See [README.zh.md](README.zh.md) for privacy and operational details.
