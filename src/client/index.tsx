import React, { useEffect, useSyncExternalStore } from 'react'
import type { ClientContext, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import '@deepseek-ai/dsh-client-ui-settings/client'

type Config = { enabled:boolean; locale:string; includeTime:boolean; includeTimezone:boolean; includeWeekday:boolean; includeWeather:boolean; manualLocation:string; weatherProvider:'open-meteo'; weatherRefreshMinutes:number; includeBattery:boolean; includeDevice:boolean; sectionOrder:number }
const defaults: Config = { enabled:true, locale:'zh-CN', includeTime:true, includeTimezone:true, includeWeekday:true, includeWeather:true, manualLocation:'武汉', weatherProvider:'open-meteo', weatherRefreshMinutes:30, includeBattery:true, includeDevice:true, sectionOrder:20 }

function decode(value: unknown): Config | undefined { return value && typeof value === 'object' ? { ...defaults, ...(value as Partial<Config>) } : undefined }
function detectPlatform() { const text = `${(navigator as any).userAgentData?.platform ?? ''} ${navigator.userAgent} ${navigator.platform}`.toLowerCase(); if (text.includes('android')) return 'Android'; if (/iphone|ipad|ipod/.test(text)) return 'iOS'; if (text.includes('windows')) return 'Windows'; if (text.includes('mac')) return 'macOS'; if (text.includes('linux')) return 'Linux'; return navigator.platform || 'Unknown' }
async function collect(config: Config) {
  let battery: { percentage:number; charging:boolean } | undefined
  if (config.includeBattery && typeof (navigator as any).getBattery === 'function') { try { const b = await (navigator as any).getBattery(); battery = { percentage: Math.round(b.level * 100), charging: Boolean(b.charging) } } catch {} }
  let model = ''
  const uaData = (navigator as any).userAgentData
  if (config.includeDevice && uaData?.getHighEntropyValues) { try { model = (await uaData.getHighEntropyValues(['model'])).model || '' } catch {} }
  return { capturedAt:new Date().toISOString(), timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone || '', battery, device: config.includeDevice ? { model, platform:detectPlatform() } : undefined }
}
async function publish(config: Config) { if (!config.enabled) { await fetch('/api/environment-context/snapshot', { method:'DELETE' }); return } const snapshot = await collect(config); await fetch('/api/environment-context/snapshot', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(snapshot) }) }

function Section({ scope }: { scope: SettingsScope<Config> }) {
  const state = useSyncExternalStore(scope.subscribe.bind(scope), scope.getSnapshot.bind(scope))
  const config = state.value ?? defaults
  useEffect(() => { void publish(config); const id = window.setInterval(() => void publish(config), 60_000); const onFocus = () => void publish(config); window.addEventListener('focus', onFocus); return () => { clearInterval(id); window.removeEventListener('focus', onFocus) } }, [config])
  const set = (key: keyof Config, value: unknown) => void scope.set(key, value)
  const toggle = (key: keyof Config, label: string) => <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={Boolean(config[key])} disabled={!state.writable} onChange={e=>set(key,e.target.checked)}/>{label}</label>
  return <section style={{maxWidth:720,display:'flex',flexDirection:'column',gap:14}}>
    <h2 style={{margin:0}}>环境上下文</h2>
    <p style={{margin:0,opacity:.75}}>每次请求只注入一段当前环境系统提示；不会创建聊天消息或累积历史快照。浏览器状态仅保存在 Host 内存中。</p>
    {toggle('enabled','启用环境上下文')}
    <fieldset><legend>时间</legend>{toggle('includeTime','本地时间')}{toggle('includeTimezone','时区')}{toggle('includeWeekday','星期')}</fieldset>
    <fieldset><legend>天气与地点</legend>{toggle('includeWeather','天气')}<label>手动地点 <input value={config.manualLocation} disabled={!state.writable} onChange={e=>set('manualLocation',e.target.value)} /></label><label>刷新间隔（分钟） <input type="number" min={5} max={180} value={config.weatherRefreshMinutes} disabled={!state.writable} onChange={e=>set('weatherRefreshMinutes',Number(e.target.value))}/></label></fieldset>
    <fieldset><legend>浏览器设备</legend>{toggle('includeBattery','电量与充电状态')}{toggle('includeDevice','平台与型号')}</fieldset>
    <label>输出语言 <select value={config.locale} disabled={!state.writable} onChange={e=>set('locale',e.target.value)}><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></label>
    <button type="button" onClick={()=>void publish(config)}>立即刷新浏览器状态</button>
    <small>DSH 的“模型可见即必须可重建”约束意味着最终组装后的系统请求仍会进入请求审计记录；本插件避免的是聊天消息、动态 context 节点和跨轮累积，而不是绕过审计。</small>
  </section>
}

export const inject = ['slots','settingsScope','connection','remote']
export function apply(ctx: ClientContext) {
  const scope = ctx.settingsScope.bind<Config>({ namespace:'environment-context', decode })
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name:'settings.section', id:'environment-context', order:35, label:()=>'环境上下文', inject:()=>({ scope }) }, Section as any))
}
