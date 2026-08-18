import assert from 'node:assert/strict'
import { formatEnvironment, sanitizeInline, validateSnapshot } from '../lib/index.js'

const options = { locale: 'zh-CN', includeTime: true, includeTimezone: true, includeWeekday: true, includeWeather: true, includeBattery: true, includeDevice: true }
assert.equal(sanitizeInline('<x>\n model'), 'x model')
assert.equal(validateSnapshot({ capturedAt: 'nope' }), null)
const text = formatEnvironment({ capturedAt:'2026-01-01T00:00:00Z', timeZone:'Asia/Shanghai', location:{label:'武汉'}, battery:{percentage:57,charging:false}, device:{platform:'Android'} }, options, new Date('2026-01-02T03:04:05Z'))
assert.match(text, /【现实环境信息】/)
assert.match(text, /地点：武汉/)
assert.match(text, /电量：57%/)
const clientBundle = await import('node:fs/promises').then(fs => fs.readFile(new URL('../lib/client.cjs', import.meta.url), 'utf8'))
assert.match(clientBundle, /ctx\.slots\.inject\("settings\.section"/)
assert.match(clientBundle, /id: "environment-context"/)
assert.match(clientBundle, /label: \(\) => "环境上下文"/)
console.log('context and settings registration tests passed')
