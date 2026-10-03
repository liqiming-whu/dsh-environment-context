import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import '@deepseek-ai/dsh-system-prompt'; import '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import '@deepseek-ai/dsh-settings'
import { formatEnvironment, validateSnapshot, type EnvironmentSettings, type EnvironmentSnapshot } from './context.ts'
import { readSystemEnvironment } from './system.ts'
export { classifyEnvironmentLanguage, formatEnvironment, sanitizeInline, validateSnapshot } from './context.ts'
export const name='environment-context'; export const inject=['systemPrompt','webServer','subprocess']
// DSH 0.2 addresses settings by the profile entry id; there is no separate settings namespace.
export const SETTINGS_NAMESPACE='environment-context'
export const Config=z.object({
  enabled:z.boolean().default(true).volatile(),locale:z.string().default('zh-CN').volatile(),injectTime:z.boolean().default(true).volatile(),injectTimezone:z.boolean().default(true).volatile(),injectWeekday:z.boolean().default(true).volatile(),
  injectWeather:z.boolean().default(true).volatile(),showLocation:z.boolean().default(true).volatile(),showCondition:z.boolean().default(true).volatile(),showTemperature:z.boolean().default(true).volatile(),showFeelsLike:z.boolean().default(true).volatile(),showHumidity:z.boolean().default(true).volatile(),showWind:z.boolean().default(true).volatile(),
  weatherProvider:z.union(['auto','open-meteo','met-norway','wttr.in']).default('auto').volatile(),locationMode:z.union(['manual','auto']).default('manual').volatile(),reverseGeocodingProvider:z.union(['auto','nominatim','bigdatacloud','photon']).default('auto').volatile(),manualLocation:z.string().default('武汉').volatile(),weatherRefreshMinutes:z.number().min(5).max(180).default(30).volatile(),locationRefreshMinutes:z.number().min(5).max(60).default(10).volatile(),
  injectBattery:z.boolean().default(true).volatile(),showCharging:z.boolean().default(true).volatile(),injectDevice:z.boolean().default(true).volatile(),showDeviceName:z.boolean().default(true).volatile(),showDeviceModel:z.boolean().default(true).volatile(),showDevicePlatform:z.boolean().default(true).volatile(),customDeviceName:z.string().default('').volatile(),
  // Placement stays ordinary configuration: it is not an editable user setting.
  sectionOrder:z.number().default(20)
})
export type Config=ReturnType<typeof Config>
/** Read the live user settings. Volatile fields are read per assembly, never snapshotted. */
export function readSettings(entry:Config):EnvironmentSettings{return{
  enabled:entry.enabled.get(),locale:entry.locale.get(),injectTime:entry.injectTime.get(),injectTimezone:entry.injectTimezone.get(),injectWeekday:entry.injectWeekday.get(),
  injectWeather:entry.injectWeather.get(),showLocation:entry.showLocation.get(),showCondition:entry.showCondition.get(),showTemperature:entry.showTemperature.get(),showFeelsLike:entry.showFeelsLike.get(),showHumidity:entry.showHumidity.get(),showWind:entry.showWind.get(),
  weatherProvider:entry.weatherProvider.get(),locationMode:entry.locationMode.get(),reverseGeocodingProvider:entry.reverseGeocodingProvider.get(),manualLocation:entry.manualLocation.get(),weatherRefreshMinutes:entry.weatherRefreshMinutes.get(),locationRefreshMinutes:entry.locationRefreshMinutes.get(),
  injectBattery:entry.injectBattery.get(),showCharging:entry.showCharging.get(),injectDevice:entry.injectDevice.get(),showDeviceName:entry.showDeviceName.get(),showDeviceModel:entry.showDeviceModel.get(),showDevicePlatform:entry.showDevicePlatform.get(),customDeviceName:entry.customDeviceName.get()
}}
const MAX_BODY=64*1024
async function readJson(req:IncomingMessage){let text='';for await(const chunk of req){text+=chunk.toString();if(text.length>MAX_BODY)throw new Error('payload too large')}return JSON.parse(text||'{}')}
function reply(res:ServerResponse,status:number,body:unknown){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(body))}
export function apply(ctx:Context,entry:Config){let snapshot:EnvironmentSnapshot|null=null
 // The policy belongs to this plugin and follows Settings replacements; injection never depends on the settings UI.
 ctx.inject(['settings'],child=>{child.effect(()=>child.settings.configure({auto:false},ctx.fiber))})
 ctx.effect(()=>ctx.webServer.register({kind:'exact',path:'/api/environment-context/system',handler:async(req,res)=>{if(req.method!=='GET')return reply(res,405,{ok:false,error:'method not allowed'});return reply(res,200,{ok:true,...await readSystemEnvironment(ctx)})}}))
 ctx.effect(()=>ctx.webServer.register({kind:'exact',path:'/api/environment-context/snapshot',handler:async(req,res)=>{const config=readSettings(entry);if(req.method==='GET')return reply(res,200,{ok:true,snapshot,prompt:formatEnvironment(snapshot,config),config});if(req.method==='POST')try{const value=validateSnapshot(await readJson(req));if(!value)return reply(res,400,{ok:false,error:'invalid snapshot'});snapshot=value;return reply(res,200,{ok:true,prompt:formatEnvironment(snapshot,config)})}catch(error){return reply(res,400,{ok:false,error:String(error)});}if(req.method==='DELETE'){snapshot=null;return reply(res,200,{ok:true})}return reply(res,405,{ok:false,error:'method not allowed'})}}))
 // `interpolate:false` keeps snapshot text literal: weather or place names must never be read as prompt variables.
 ctx.effect(()=>ctx.systemPrompt.section({name:'environment-context',order:entry.sectionOrder,interpolate:false,text:(_assembly:AssembleContext)=>formatEnvironment(snapshot,readSettings(entry))}))
}
