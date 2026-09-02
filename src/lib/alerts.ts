import type { FundQuote } from "./types";

export type AlertKind = "fund_up" | "fund_down" | "drawdown";
export type AlertRule = { id:string; code:string; kind:AlertKind; threshold:number; enabled:boolean };
export type AlertEvent = { id:string; ruleId:string; code:string; kind:AlertKind; value:number; threshold:number; message:string; triggeredAt:number };

const RULE_KEY = "fund_ai_pro_alert_rules_v1";
const EVENT_KEY = "fund_ai_pro_alert_events_v1";
const COOLDOWN_MS = 60 * 60_000;

function read<T>(key:string, fallback:T):T { if(typeof window === "undefined") return fallback; try { const value=JSON.parse(localStorage.getItem(key)||"null"); return value ?? fallback; } catch { return fallback; } }
function write(key:string, value:unknown) { if(typeof window === "undefined") return; try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export function loadAlertRules():AlertRule[] { return read<AlertRule[]>(RULE_KEY,[]).filter((r)=>r&&typeof r.id==="string"&&/^\d{6}$/.test(r.code)&&(r.kind==="fund_up"||r.kind==="fund_down"||r.kind==="drawdown")&&Number.isFinite(Number(r.threshold))); }
export function saveAlertRules(rules:AlertRule[]) { write(RULE_KEY,rules); }
export function loadAlertEvents():AlertEvent[] { return read<AlertEvent[]>(EVENT_KEY,[]).filter((e)=>e&&typeof e.id==="string").slice(0,50); }

function maxDrawdown(history:number[]) { let peak=-Infinity; let max=0; for(const v of history){ if(!Number.isFinite(v)||v<=0) continue; peak=Math.max(peak,v); if(peak>0) max=Math.max(max,(peak-v)/peak*100); } return max; }
function matches(rule:AlertRule, quote:FundQuote) {
  const day=quote.dayPct;
  if(rule.kind==="fund_up") return day!=null && day>=rule.threshold ? day : null;
  if(rule.kind==="fund_down") return day!=null && day<=-Math.abs(rule.threshold) ? day : null;
  const dd=maxDrawdown(quote.history||[]);
  return Number.isFinite(dd) && dd>=Math.abs(rule.threshold) ? dd : null;
}
function message(rule:AlertRule, quote:FundQuote, value:number) {
  if(rule.kind==="fund_up") return `${quote.name||rule.code} 今日涨幅 ${value.toFixed(2)}% ≥ +${rule.threshold.toFixed(2)}%`;
  if(rule.kind==="fund_down") return `${quote.name||rule.code} 今日跌幅 ${value.toFixed(2)}% ≤ -${Math.abs(rule.threshold).toFixed(2)}%`;
  return `${quote.name||rule.code} 历史最大回撤 ${value.toFixed(2)}% ≥ ${Math.abs(rule.threshold).toFixed(2)}%`;
}

export function evaluateFundAlerts(funds:Record<string,FundQuote>):AlertEvent[] {
  if(typeof window === "undefined") return [];
  const rules=loadAlertRules().filter((r)=>r.enabled);
  const events=loadAlertEvents(); const now=Date.now(); const created:AlertEvent[]=[];
  for(const rule of rules){ const quote=funds[rule.code]; if(!quote) continue; const value=matches(rule,quote); if(value==null) continue; const recent=events.find((e)=>e.ruleId===rule.id&&now-e.triggeredAt<COOLDOWN_MS); if(recent) continue; created.push({id:`${rule.id}-${now}`,ruleId:rule.id,code:rule.code,kind:rule.kind,value,threshold:rule.threshold,message:message(rule,quote,value),triggeredAt:now}); }
  if(created.length) write(EVENT_KEY,[...created,...events].slice(0,50));
  return created;
}

export const alertKindLabel:Record<AlertKind,string>={fund_up:"涨幅提醒",fund_down:"跌幅提醒",drawdown:"回撤提醒"};
