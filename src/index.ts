import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import '@deepseek-ai/dsh-system-prompt'
import '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { formatEnvironment, validateSnapshot, type EnvironmentSnapshot } from './context.ts'
import { fetchManualWeather } from './weather.ts'
export { formatEnvironment, sanitizeInline, validateSnapshot } from './context.ts'

export const name = 'environment-context'
export const inject = ['systemPrompt', 'webServer']
export const SETTINGS_NAMESPACE = settingsNamespace('environment-context')

export interface Config {
  enabled: boolean; locale: string; includeTime: boolean; includeTimezone: boolean; includeWeekday: boolean
  includeWeather: boolean; manualLocation: string; weatherProvider: 'open-meteo'; weatherRefreshMinutes: number
  includeBattery: boolean; includeDevice: boolean; sectionOrder: number
}
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true), locale: z.string().default('zh-CN'), includeTime: z.boolean().default(true), includeTimezone: z.boolean().default(true), includeWeekday: z.boolean().default(true),
  includeWeather: z.boolean().default(true), manualLocation: z.string().default('武汉'), weatherProvider: z.union(['open-meteo']).default('open-meteo'), weatherRefreshMinutes: z.number().min(5).max(180).default(30),
  includeBattery: z.boolean().default(true), includeDevice: z.boolean().default(true), sectionOrder: z.number().default(20),
})

const MAX_BODY = 32 * 1024
async function readJson(req: IncomingMessage): Promise<unknown> {
  let text = ''
  for await (const chunk of req) { text += chunk.toString(); if (text.length > MAX_BODY) throw new Error('payload too large') }
  return JSON.parse(text || '{}')
}
function reply(res: ServerResponse, status: number, body: unknown) { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)) }

export function apply(ctx: Context, entry: Config) {
  let source = () => entry
  let browserSnapshot: EnvironmentSnapshot | null = null
  let weatherCache: EnvironmentSnapshot['weather'] | undefined
  let locationCache: EnvironmentSnapshot['location'] | undefined
  let weatherAt = 0
  let inflight: Promise<void> | null = null

  const refreshWeather = (config: Config, signal?: AbortSignal) => {
    if (!config.includeWeather || !config.manualLocation.trim() || Date.now() - weatherAt < config.weatherRefreshMinutes * 60_000) return inflight
    if (!inflight) inflight = fetchManualWeather(config.manualLocation, signal).then(value => { locationCache = value.location; weatherCache = value.weather; weatherAt = Date.now() }).catch(error => { if (weatherCache) weatherCache = { ...weatherCache, stale: true }; ctx.logger(name).warn('weather refresh failed: %s', String(error)) }).finally(() => { inflight = null })
    return inflight
  }

  installSettingsSection(ctx, SETTINGS_NAMESPACE, Config, entry, { setSource: current => { source = current }, onChange: () => { weatherAt = 0 } })

  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/api/environment-context/snapshot', handler: async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'POST') {
      try { const snapshot = validateSnapshot(await readJson(req)); if (!snapshot) return reply(res, 400, { ok: false, error: 'invalid snapshot' }); browserSnapshot = snapshot; return reply(res, 200, { ok: true }) }
      catch (error) { return reply(res, 400, { ok: false, error: String(error) }) }
    }
    if (req.method === 'DELETE') { browserSnapshot = null; return reply(res, 200, { ok: true }) }
    return reply(res, 405, { ok: false, error: 'method not allowed' })
  }}))

  ctx.effect(() => ctx.systemPrompt.section({ name: 'environment-context', order: entry.sectionOrder, text: (assembly: AssembleContext) => {
    const config = source()
    if (!config.enabled) return ''
    void refreshWeather(config, assembly.signal)
    const base = browserSnapshot ?? { capturedAt: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    return formatEnvironment({ ...base, location: locationCache ?? base.location, weather: weatherCache ?? base.weather }, config)
  }}))
}
