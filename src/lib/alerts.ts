import type { FundQuote, SectorQuote } from "./types";

export type AlertKind = "fund_up" | "fund_down" | "drawdown" | "valuation_range" | "sector_change";
export type AlertRule = { id:string; code:string; kind:AlertKind; threshold:number; enabled:boolean };
export type AlertEvent = { id:string; ruleId:string; code:string; kind:AlertKind; value:number; threshold:number; message:string; triggeredAt:number };

const RULE_KEY = "fund_ai_pro_alert_rules_v1";
const EVENT_KEY = "fund_ai_pro_alert_events_v1";
const SECTOR_KEY = "fund_ai_pro_alert_sector_snapshot_v1";
const COOLDOWN_MS = 60 * 60_000;

function read<T>(key:string, fallback:T):T { if(typeof window === "undefined") return fallback; try { const value=JSON.parse(localStorage.getItem(key)||"null"); return value ?? fallback; } catch { return fallback; } }
function write(key:string, value:unknown) { if(typeof window === "undefined") return; try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

export function loadAlertRules():AlertRule[] {
  return read<AlertRule[]>(RULE_KEY,[]).filter((r)=>r&&typeof r.id==="string"&&typeof r.code==="string"&&Number.isFinite(Number(r.threshold))&&(r.kind==="fund_up"||r.kind==="fund_down"||r.kind==="drawdown"||r.kind==="valuation_range"||r.kind==="sector_change"));
}
export function saveAlertRules(rules:AlertRule[]) { write(RULE_KEY,rules); }
export function loadAlertEvents():AlertEvent[] { return read<AlertEvent[]>(EVENT_KEY,[]).filter((e)=>e&&typeof e.id==="string").slice(0,50); }

export function notifyAlertEvents(events: AlertEvent[]) {
  if(typeof window === "undefined" || !events.length || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  for(const event of events.slice(0,3)) {
    try { new Notification("Fund AI Pro · 智能提醒", { body: event.message, tag: `fap-alert-${event.ruleId}` }); } catch {}
  }
}

function maxDrawdown(history:number[]) { let peak=-Infinity; let max=0; for(const v of history){ if(!Number.isFinite(v)||v<=0) continue; peak=Math.max(peak,v); if(peak>0) max=Math.max(max,(peak-v)/peak*100); } return max; }
function matchesFund(rule:AlertRule, quote:FundQuote) {
  const day=quote.dayPct;
  if(rule.kind==="fund_up") return day!=null && day>=rule.threshold ? day : null;
  if(rule.kind==="fund_down") return day!=null && day<=-Math.abs(rule.threshold) ? day : null;
  if(rule.kind==="drawdown") {
    const dd=maxDrawdown(quote.history||[]);
    return Number.isFinite(dd) && dd>=Math.abs(rule.threshold) ? dd : null;
  }
  const low=quote.estimateRangeLowPct;
  const high=quote.estimateRangeHighPct;
  const target=Math.abs(rule.threshold);
  if(low!=null && Number.isFinite(low) && low<=-target) return low;
  if(high!=null && Number.isFinite(high) && high>=target) return high;
  const estimate=quote.estimatePct;
  return estimate!=null && Number.isFinite(estimate) && Math.abs(estimate)>=target ? estimate : null;
}

function message(rule:AlertRule, quote:FundQuote, value:number) {
  if(rule.kind==="fund_up") return `${quote.name||rule.code} 今日涨幅 ${value.toFixed(2)}% ≥ +${rule.threshold.toFixed(2)}%`;
  if(rule.kind==="fund_down") return `${quote.name||rule.code} 今日跌幅 ${value.toFixed(2)}% ≤ -${Math.abs(rule.threshold).toFixed(2)}%`;
  if(rule.kind==="drawdown") return `${quote.name||rule.code} 历史最大回撤 ${value.toFixed(2)}% ≥ ${Math.abs(rule.threshold).toFixed(2)}%`;
  return `${quote.name||rule.code} 盘中估值区间已触及 ${value.toFixed(2)}%（阈值 ±${Math.abs(rule.threshold).toFixed(2)}%）`;
}

function evaluateSectorRule(rule:AlertRule, sectors:SectorQuote[], previous:Record<string,number>): AlertEvent | null {
  const code=rule.code.replace(/^sector:/,"");
  const sector=sectors.find((x)=>x.bkCode===code || x.id===code);
  if(!sector || sector.change==null || !Number.isFinite(sector.change)) return null;
  const before=previous[code];
  previous[code]=sector.change;
  if(before==null) return null;
  const delta=sector.change-before;
  return Math.abs(delta)>=Math.abs(rule.threshold) ? {
    id:`${rule.id}-${Date.now()}`, ruleId:rule.id, code:rule.code, kind:rule.kind,
    value:delta, threshold:rule.threshold,
    message:`${sector.name} 强弱变化 ${delta>=0?"+":""}${delta.toFixed(2)} 个百分点，已达到 ±${Math.abs(rule.threshold).toFixed(2)} 阈值`,
    triggeredAt:Date.now(),
  } : null;
}

export function evaluateFundAlerts(funds:Record<string,FundQuote>, sectors:SectorQuote[] = []):AlertEvent[] {
  if(typeof window === "undefined") return [];
  const rules=loadAlertRules().filter((r)=>r.enabled);
  const events=loadAlertEvents(); const now=Date.now(); const created:AlertEvent[]=[];
  const previous=read<Record<string,number>>(SECTOR_KEY,{});
  for(const rule of rules){
    if(rule.kind==="sector_change") {
      const event=evaluateSectorRule(rule,sectors,previous);
      if(!event) continue;
      const recent=events.find((e)=>e.ruleId===rule.id&&now-e.triggeredAt<COOLDOWN_MS);
      if(!recent) created.push(event);
      continue;
    }
    if(!/^\d{6}$/.test(rule.code)) continue;
    const quote=funds[rule.code]; if(!quote) continue;
    const value=matchesFund(rule,quote); if(value==null) continue;
    const recent=events.find((e)=>e.ruleId===rule.id&&now-e.triggeredAt<COOLDOWN_MS); if(recent) continue;
    created.push({id:`${rule.id}-${now}`,ruleId:rule.id,code:rule.code,kind:rule.kind,value,threshold:rule.threshold,message:message(rule,quote,value),triggeredAt:now});
  }
  if(sectors.length) write(SECTOR_KEY,previous);
  if(created.length) write(EVENT_KEY,[...created,...events].slice(0,50));
  return created;
}

export const alertKindLabel:Record<AlertKind,string>={fund_up:"涨幅提醒",fund_down:"跌幅提醒",drawdown:"回撤提醒",valuation_range:"估值区间",sector_change:"板块变化"};
