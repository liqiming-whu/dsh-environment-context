import assert from 'node:assert/strict'
import { formatEnvironment, sanitizeInline, validateSnapshot } from '../lib/index.js'

const options = { locale: 'zh-CN', includeTime: true, includeTimezone: true, includeWeekday: true, includeWeather: true, includeBattery: true, includeDevice: true }
assert.equal(sanitizeInline('<x>\n model'), 'x model')
assert.equal(validateSnapshot({ capturedAt: 'nope' }), null)
const text = formatEnvironment({ capturedAt:'2026-01-01T00:00:00Z', timeZone:'Asia/Shanghai', location:{label:'武汉'}, battery:{percentage:57,charging:false}, device:{platform:'Android'} }, options, new Date('2026-01-02T03:04:05Z'))
assert.match(text, /【现实环境信息】/)
assert.match(text, /地点：武汉/)
assert.match(text, /电量：57%/)
console.log('context tests passed')
