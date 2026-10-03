import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import vm from 'node:vm'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { Context } from '@deepseek-ai/cordis'
import { SystemPrompt, renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import z from '@deepseek-ai/schemastery'
import { apply, Config, readSettings, SETTINGS_NAMESPACE, classifyEnvironmentLanguage, formatEnvironment, sanitizeInline, validateSnapshot } from '../lib/index.js'

const settingsKeys = ['enabled', 'locale', 'injectTime', 'injectTimezone', 'injectWeekday', 'injectWeather', 'showLocation', 'showCondition', 'showTemperature', 'showFeelsLike', 'showHumidity', 'showWind', 'weatherProvider', 'locationMode', 'reverseGeocodingProvider', 'manualLocation', 'weatherRefreshMinutes', 'locationRefreshMinutes', 'injectBattery', 'showCharging', 'injectDevice', 'showDeviceName', 'showDeviceModel', 'showDevicePlatform', 'customDeviceName']
const expectedDefaults = { enabled: true, locale: 'zh-CN', injectTime: true, injectTimezone: true, injectWeekday: true, injectWeather: true, showLocation: true, showCondition: true, showTemperature: true, showFeelsLike: true, showHumidity: true, showWind: true, weatherProvider: 'auto', locationMode: 'manual', reverseGeocodingProvider: 'auto', manualLocation: '武汉', weatherRefreshMinutes: 30, locationRefreshMinutes: 10, injectBattery: true, showCharging: true, injectDevice: true, showDeviceName: true, showDeviceModel: true, showDevicePlatform: true, customDeviceName: '' }
const s = { ...expectedDefaults, customDeviceName: '我的电脑' }

assert.equal(sanitizeInline('<x>\n model'), 'x model')
assert.equal(validateSnapshot({ capturedAt: 'bad' }), null)
assert.equal(classifyEnvironmentLanguage('zh-CN'), 'zh')
assert.equal(classifyEnvironmentLanguage('zh-TW'), 'zh')
assert.equal(classifyEnvironmentLanguage('zh_CN'), 'zh')
assert.equal(classifyEnvironmentLanguage('zhx'), 'zh')
assert.equal(classifyEnvironmentLanguage('cmn-CN'), 'en')
assert.equal(classifyEnvironmentLanguage('not_a_locale'), 'en')
assert.equal(classifyEnvironmentLanguage(''), undefined)

const text = formatEnvironment({ capturedAt: '2026-01-01T00:00:00Z', locale: 'zh-Hant', time: { timeZone: 'Asia/Shanghai' }, location: { label: '武汉 / 湖北 / 中国' }, weather: { condition: '晴', temperature: 30, feelsLike: 35, humidity: 80, windSpeed: 8, windDirection: '北' }, battery: { percentage: 100, charging: true }, device: { platform: 'Windows' } }, s, new Date('2026-08-18T13:00:00Z'))
for (const part of ['【现实环境信息】', '地点：武汉 / 湖北 / 中国', '天气：晴', '温度：30°C（体感：35°C）', '湿度：80%', '电量：100%', '设备名称：我的电脑']) assert.ok(text.includes(part), `Chinese prompt missing ${part}`)
const english = formatEnvironment({ capturedAt: '2026-01-01T00:00:00Z', locale: 'fr-FR', time: { timeZone: 'Europe/Paris' }, location: { label: 'Paris / Île-de-France / France' }, weather: { condition: 'Clear sky', temperature: 24, feelsLike: 25, humidity: 45, windSpeed: 12, windDirection: 'NW' }, battery: { percentage: 80, charging: false }, device: { name: 'WORKSTATION', model: 'Example Model', platform: 'Windows 11' } }, { ...s, customDeviceName: '' }, new Date('2026-08-18T13:00:00Z'))
for (const part of ['[Current environment]', 'Local time:', 'Time zone: Europe/Paris', 'Weekday: Tuesday', 'Location: Paris / Île-de-France / France', 'Weather: Clear sky', 'Temperature: 24°C (feels like 25°C)', 'Humidity: 45%', 'Wind: 12 km/h NW', 'Battery: 80%', 'Charging: no', 'Name: WORKSTATION']) assert.ok(english.includes(part), `English prompt missing ${part}`)
assert.ok(!english.includes('【现实环境信息】'), 'non-Chinese browser locale must not use Chinese injection')

// --- DSH 0.2 settings model -------------------------------------------------
const packageJson = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'))
assert.equal(packageJson.version, '0.4.0')
assert.equal(SETTINGS_NAMESPACE, 'environment-context')
assert.deepEqual(Object.keys(expectedDefaults).sort(), [...settingsKeys].sort())
assert.deepEqual(readSettings(Config({})), expectedDefaults)

// Every user setting is editable live; placement stays ordinary configuration.
assert.deepEqual(Object.keys(Config.dict).filter(key => Config.dict[key].meta.volatile).sort(), [...settingsKeys].sort())
assert.ok(!Config.dict.sectionOrder.meta.volatile, 'sectionOrder must stay plain configuration')
assert.ok(!('sectionOrder' in expectedDefaults), 'placement is not a user setting')

// The Host projects volatile fields into a serialized form schema and the
// browser decodes the namespace value against it; a value the wire format
// cannot carry would leave the whole settings page read-only with defaults on
// screen. Reproduce the real projection here so such a field fails this test.
const settingsSchemaUrl = new URL('types/schema.js', import.meta.resolve('@deepseek-ai/dsh-settings'))
assert.ok(settingsSchemaUrl.pathname.endsWith('/lib/types/schema.js'), settingsSchemaUrl.href)
const { volatileForm, projectForm, plainConfig } = await import(settingsSchemaUrl.href)
const form = volatileForm(Config)
assert.deepEqual(Object.keys(form.dict).sort(), [...settingsKeys].sort())
assert.equal(form.dict.sectionOrder, undefined)
const projected = projectForm(form, plainConfig(Config({})))
const decoded = new z(JSON.parse(JSON.stringify(form.toJSON())))
assert.deepEqual(decoded(projected), expectedDefaults)
assert.deepEqual(decoded(projectForm(form, plainConfig(Config({ manualLocation: '宜昌', weatherProvider: 'wttr.in', weatherRefreshMinutes: 45 })))), { ...expectedDefaults, manualLocation: '宜昌', weatherProvider: 'wttr.in', weatherRefreshMinutes: 45 })

// --- removed 0.1-era APIs ---------------------------------------------------
const host = await fs.readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
const clientSource = await fs.readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
for (const forbidden of ['installSettingsSection', 'settingsNamespace(', 'settingsScope']) {
  assert.ok(!host.includes(forbidden), `host still uses ${forbidden}`)
}
for (const forbidden of ['settingsScope', 'dsh-client-runtime', 'dsh-client-web-react']) {
  assert.ok(!clientSource.includes(forbidden), `client still uses ${forbidden}`)
}
assert.ok(host.includes('entry.enabled.get()'), 'host must read volatile fields per assembly')
assert.ok(host.includes('interpolate:false'), 'the injected section must not interpolate snapshot text')
assert.ok(clientSource.includes("ctx.configForms.get<EnvironmentSettings>('environment-context')"))
assert.ok(clientSource.includes('whileServed'))
assert.deepEqual(packageJson.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-ui-renderer'])

// --- the real settings service and the real Loader entry path ---------------
// A saved volatile setting must reach the NEXT request on the same Context: no
// reinstall, no plugin restart, no new conversation, no second section.
// The Loader, the Entry and its volatile commit are the real ones: the entry is
// created through `ctx.loader` and each save calls the real `entry.update()`,
// which is what makes `Entry._commitVolatile` write the new value into the
// RUNNING fiber's reference without restarting it. Only the profile/YAML
// persistence layer is stubbed (`configEditor.edit`), because it needs a real
// profile directory and a root Include entry.
const SettingsForms = (await import('@deepseek-ai/dsh-settings')).default
const Loader = (await import('@deepseek-ai/cordis-plugin-loader')).default
const home = await fs.mkdtemp(join(tmpdir(), 'environment-context-'))
const ctx = new Context()
await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false })
ctx.provide('webServer', { register: () => () => {} })
ctx.provide('subprocess', { spawn: () => { throw new Error('subprocess must not be used during assembly') } })
ctx.provide('profileContext', { home, name: 'test-profile', dir: home, installAnchor: home })
await ctx.plugin(Loader)
let pluginApplies = 0
const pluginName = 'environment-context'
ctx.loader.builtins[pluginName] = {
  name: pluginName,
  Config,
  inject: ['systemPrompt', 'webServer', 'subprocess'],
  apply: (pluginCtx, config) => { pluginApplies += 1; return apply(pluginCtx, config) },
}
const volatileCommits = []
await ctx.loader.create({ id: pluginName, name: `cordis:${pluginName}`, config: { manualLocation: '武汉', customDeviceName: '{{leak}}' } })
await ctx.loader.await()
const entry = ctx.loader.resolve(pluginName)
entry.fiber.ctx.on('loader/volatile-update', paths => volatileCommits.push(paths))
assert.equal(pluginApplies, 1)
ctx.provide('configEditor', {
  documentPath: join(home, 'cordis.patch.yml'),
  entries: () => [...ctx.loader.entries()],
  configuration: () => [...ctx.loader.entries()].map(row => ({ entry: row, inherited: {}, override: {} })),
  async edit(target, change) {
    const next = change(structuredClone(target.options.config ?? {}), {})
    await target.update({ config: next }, false, true)
  },
})
await ctx.plugin(SettingsForms)
const fiber = entry.fiber

const assemble = async () => {
  const assembly = await ctx.systemPrompt.assemble()
  assert.equal(assembly.contexts.length, 0, 'the plugin must not register dynamic prompt context')
  const sections = assembly.sections.filter(section => section.name === 'environment-context')
  assert.ok(sections.length <= 1, 'the plugin must not register the section twice')
  return { assembly, section: sections[0] }
}

let { assembly, section: injected } = await assemble()
assert.ok(injected, 'the environment-context section must be registered')
assert.equal(injected.interpolate, false)
assert.ok(injected.text.includes('【现实环境信息】'))
assert.ok(injected.text.includes('设备名称：{{leak}}'), 'snapshot text must stay literal')
assert.ok(renderPrompt(assembly).includes('{{leak}}'), 'snapshot text must not be read as prompt variables')
assert.equal(ctx.settings.describe().find(row => row.ns === 'environment-context').autoGenerate, false, 'the plugin owns its page policy')

// A saved value changes the next assembly: language and rendered device name.
await ctx.settings.update('environment-context', { customDeviceName: '办公室主机', locale: 'en-US' })
;({ section: injected } = await assemble())
assert.ok(injected.text.startsWith('[Current environment]'), 'a saved locale must take effect on the next assembly')
assert.ok(injected.text.includes('Name: 办公室主机'), 'a saved device name must take effect on the next assembly')
assert.ok(!injected.text.includes('{{leak}}'))
assert.equal(ctx.settings.describe().find(row => row.ns === 'environment-context').value.customDeviceName, '办公室主机')
assert.equal(fiber.config.customDeviceName.get(), '办公室主机', 'the live reference itself must carry the new value')
assert.equal(pluginApplies, 1, 'a volatile-only change must not restart the plugin')
assert.ok(volatileCommits.some(paths => paths.map(path => path.join('.')).includes('customDeviceName')), 'the Loader must report the volatile commit it performed')

// The enable toggle empties the section without touching the registration.
await ctx.settings.update('environment-context', { enabled: false })
;({ section: injected } = await assemble())
assert.ok(injected, 'the section stays registered while disabled')
assert.equal(injected.text, '', 'disabling must inject nothing on the next assembly')
await ctx.settings.update('environment-context', { enabled: true, customDeviceName: '我的电脑', locale: 'zh-CN' })
;({ section: injected } = await assemble())
assert.ok(injected.text.startsWith('【现实环境信息】'), 'switching back must take effect on the next assembly')
assert.ok(injected.text.includes('设备名称：我的电脑'))

// Placement is ordinary configuration, not a user setting.
await assert.rejects(ctx.settings.update('environment-context', { sectionOrder: 99 }), /is not volatile/)
await assert.rejects(ctx.settings.update('missing-entry', { enabled: false }), /No configurable plugin entry/)

await fiber.dispose()
assert.ok(!(await ctx.systemPrompt.assemble()).sections.some(section => section.name === 'environment-context'))
await ctx.fiber.dispose()
await fs.rm(home, { recursive: true, force: true })

// --- the shipped browser bundle --------------------------------------------
const bundle = await fs.readFile(new URL('../lib/client.cjs', import.meta.url), 'utf8')
for (const part of ['open-meteo', 'met-norway', 'wttr.in', 'nominatim', 'bigdatacloud', 'photon', 'settings.section', '立即测试并强制刷新', 'Test now and force refresh', 'Environment Context', 'Weather provider', 'Auto (Open-Meteo', 'navigator.language']) assert.ok(bundle.includes(part), `bundle missing ${part}`)
assert.ok(!bundle.includes('注入位置'), 'obsolete placement setting remains')

let loaded
const require = createRequire(import.meta.url)
vm.runInNewContext(bundle, {
  window: { __ModuleLoader__: { load: definition => { loaded = definition } } },
  navigator: { language: 'zh-CN', languages: ['zh-CN'] },
  TextEncoder,
})
assert.equal(loaded.id, 'dsh-environment-context')
const client = loaded.factory(id => {
  assert.ok(id === 'react' || id.startsWith('react/'), `cross-plugin runtime import: ${id}`)
  return require(id)
})
assert.deepEqual(Array.from(client.inject), ['slots', 'configForms'])
assert.deepEqual(Object.keys(client.defaults).sort(), [...settingsKeys].sort())
assert.deepEqual({ ...client.defaults }, expectedDefaults)
const scope = {}
let registered
let watchDisposer
const fakeCtx = {
  effect: setup => { watchDisposer = setup() },
  configForms: {
    get(entryId) { assert.equal(entryId, 'environment-context'); return scope },
    whileServed(entries, register) {
      assert.deepEqual(Array.from(entries), ['environment-context'])
      return register(new Set(entries))
    },
  },
  slots: {
    inject(slot, register) { assert.equal(slot, 'settings.section'); return register() },
    register(options, Section) { registered = options; assert.equal(typeof Section, 'function'); return () => {} },
  },
}
client.apply(fakeCtx)
assert.equal(registered.id, 'environment-context')
assert.equal(registered.order, 35)
assert.equal(registered.label(), '环境上下文')
assert.equal(registered.inject().scope, scope)
assert.equal(typeof watchDisposer, 'function')
watchDisposer()

assert.equal(packageJson.exports['./package.json'], './package.json')
const readme = await fs.readFile(new URL('../README.md', import.meta.url), 'utf8'), readmeEn = await fs.readFile(new URL('../README_EN.md', import.meta.url), 'utf8'), patch = await fs.readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
for (const doc of [readme, readmeEn]) { assert.ok(doc.includes('Microsoft Windows 11')); assert.ok(!doc.includes('MECHREVO')); assert.ok(!doc.includes('YAOSHI')) }
assert.ok(patch.includes('weatherProvider: auto'))
console.log('DSH 0.2 settings, prompt injection, and client bundle tests passed')
