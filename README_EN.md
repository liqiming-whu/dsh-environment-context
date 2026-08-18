# DSH Environment Context

[简体中文](README.md)

Inject current time, timezone, weekday, weather, location, browser battery, and device information into DeepSeek Harness, with a native **Environment Context** page in DSH Settings.

## Finding the settings page

After installation and a DSH Web Host restart:

1. Open `http://127.0.0.1:3080`.
2. Click **Settings** (the gear icon) at the bottom of the left sidebar.
3. Select **Environment Context** in the settings navigation.

If it is absent, verify that the plugin was installed into the `web` profile rather than merely cloned, restart the Host, and hard-refresh the browser. The client plugin table is scanned at Host startup.

## Injection model

The plugin registers one dynamic `systemPrompt.section()`. Every model-request assembly reads the latest browser snapshot from Host memory and merges Host-cached Open-Meteo weather. It does not call `agent.inject()`, create `user/message` events, or register `PromptContext`, so environment messages never appear in the chat timeline or accumulate across turns. Browser snapshots are process-memory only.

DSH enforces “model-visible means reconstructable from the session log.” Consequently, the final system prompt remains part of request audit data. Removing it entirely would violate replay/audit invariants. This implementation is the least-polluting supported design: **one replacing system section, no chat node, and no accumulated context snapshots**.

## Features

- Browser-local time, timezone, and weekday
- Manual city geocoding and current Open-Meteo weather
- Battery Status API when available
- UA Client Hints / UA platform and model
- Native settings page with toggles, city, refresh interval, locale, and refresh action
- Same-origin memory transport; browser telemetry is not stored in settings or chat

## Install

Cloning alone does not register the settings page. Install the package into the Web profile:

```powershell
dsh plugin --profile web add D:\\DSH_workspace\\dsh-environment-context
```

Restart the existing DSH Web Host and refresh `http://127.0.0.1:3080`. Do not start a replacement server for the existing GUI. Pin a commit for Git installs. Source installs require permission for `prepare`; packed releases include `lib/`.

## Development

```bash
pnpm install
pnpm run check
pnpm run build
pnpm pack
```
