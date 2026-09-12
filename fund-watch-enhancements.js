/* Fund Watch enhancement layer
 * 1) 波段信号：位置 + 盘中估算 + 趋势
 * 2) 组合自检：持仓/集中度/行业集中度
 * 3) 自选板块：localStorage 持久化
 * 4) 收益区间：近7/30/90日，数据不足明确提示
 * 5) 不覆盖现有 Vue 代码；通过独立层挂载到首页
 */
(() => {
  'use strict';

  const NS = 'fwProSuite';
  const SECTOR_KEY = 'fwCustomSectors';
  const RANGE = { '7': 12, '30': 30, '90': 90 };

  const esc = (v) => String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : NaN;
  const pct = (v) => {
    const n = num(v);
    return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : '—';
  };

  async function api(path) {
    const r = await fetch(path, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  function storageGet(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '');
      return v ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function ensureStyle() {
    if (document.getElementById(`${NS}-style`)) return;
    const s = document.createElement('style');
    s.id = `${NS}-style`;
    s.textContent = `
      #fw-pro-suite{margin:20px 0 0;display:grid;gap:16px}
      #fw-pro-suite .fw-card{border:1px solid rgba(255,255,255,.10);border-radius:22px;
        background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.055));
        backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
        box-shadow:0 14px 40px rgba(0,0,0,.14);padding:18px}
      #fw-pro-suite .fw-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      #fw-pro-suite .fw-title{font-size:17px;font-weight:800;letter-spacing:-.02em}
      #fw-pro-suite .fw-sub{font-size:12px;opacity:.62;margin-top:3px}
      #fw-pro-suite .fw-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}
      #fw-pro-suite .fw-signal{display:grid;grid-template-columns:180px 1fr;gap:16px;align-items:center}
      #fw-pro-suite .fw-badge{border-radius:18px;padding:18px;text-align:center;background:rgba(255,255,255,.07)}
      #fw-pro-suite .fw-badge strong{display:block;font-size:24px;line-height:1.1}
      #fw-pro-suite .fw-badge span{display:block;margin-top:7px;font-size:12px;opacity:.7}
      #fw-pro-suite .fw-reason{padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.09);font-size:13px}
      #fw-pro-suite .fw-reason:last-child{border-bottom:0}
      #fw-pro-suite .fw-up{color:#2fd26f}.fw-down{color:#ff6b78}.fw-muted{opacity:.6}
      #fw-pro-suite .fw-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      #fw-pro-suite .fw-stat{padding:12px;border-radius:15px;background:rgba(255,255,255,.055)}
      #fw-pro-suite .fw-stat b{display:block;font-size:19px}.fw-stat span{font-size:11px;opacity:.62}
      #fw-pro-suite .fw-good{color:#46d985}.fw-watch{color:#eeb94f}.fw-risk{color:#ff6b78}
      #fw-pro-suite .fw-range-tabs{display:flex;gap:8px;overflow:auto;margin-bottom:12px}
      #fw-pro-suite .fw-tab{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);
        border-radius:999px;padding:7px 12px;font-size:12px;color:inherit}
      #fw-pro-suite .fw-tab.on{background:rgba(120,170,255,.18);border-color:rgba(120,170,255,.35)}
      #fw-pro-suite .fw-range-value{font-size:27px;font-weight:800}
      #fw-pro-suite .fw-range-meta{margin-top:6px;font-size:12px;opacity:.62}
      #fw-pro-suite .fw-sector-add{display:flex;gap:8px}.fw-sector-add input{flex:1;min-width:0}
      #fw-pro-suite input{border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.10);color:inherit;
        border-radius:12px;padding:9px 11px;outline:none}
      #fw-pro-suite button{color:inherit;cursor:pointer}
      #fw-pro-suite .fw-mini-btn{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);
        border-radius:11px;padding:8px 11px;font-size:12px}
      #fw-pro-suite .fw-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      #fw-pro-suite .fw-chip{display:inline-flex;align-items:center;gap:7px;border-radius:999px;
        padding:7px 10px;background:rgba(255,255,255,.06);font-size:12px}
      #fw-pro-suite .fw-chip button{border:0;background:none;padding:0;opacity:.65}
      @media(max-width:760px){
        #fw-pro-suite .fw-grid{grid-template-columns:1fr}
        #fw-pro-suite .fw-signal{grid-template-columns:1fr}
        #fw-pro-suite .fw-stats{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(s);
  }

  function currentFundCode() {
    // Existing page exposes selected fund visually; prefer Vue's page data indirectly.
    const detailCode = document.querySelector('.detail-hero small')?.textContent?.match(/\d{6}/)?.[0];
    if (detailCode) return detailCode;
    const row = document.querySelector('.fund-card');
    return row ? row.querySelector('.fund-bottom')?.textContent?.match(/\d{6}/)?.[0] : null;
  }

  async function loadFunds() {
    const r = await api('/api/funds');
    return Array.isArray(r.data) ? r.data : [];
  }

  async function loadHistory(code, points) {
    const r = await api(`/api/funds/${encodeURIComponent(code)}/nav-history?points=${points}`);
    return Array.isArray(r.data) ? r.data : [];
  }

  function historyPosition(history) {
    const vals = history.map(x => num(x.nav ?? x.estimated_nav)).filter(Number.isFinite);
    if (vals.length < 3) return null;
    const cur = vals.at(-1), min = Math.min(...vals), max = Math.max(...vals);
    return (cur - min) / Math.max(1e-9, max - min) * 100;
  }

  function trend(history) {
    const vals = history.map(x => num(x.nav ?? x.estimated_nav)).filter(Number.isFinite);
    if (vals.length < 6) return null;
    const a = vals.at(-6), b = vals.at(-1);
    return (b - a) / Math.max(1e-9, Math.abs(a)) * 100;
  }

  function signalFor(fund, history) {
    const position = historyPosition(history);
    const live = num(fund?.estimated_change_pct ?? fund?.change_pct);
    const tr = trend(history);
    let score = 50;
    const reasons = [];
    if (Number.isFinite(position)) {
      score += (position - 50) * .65;
      reasons.push(`历史样本位置约 ${position.toFixed(0)}%`);
    } else {
      reasons.push('历史数据不足，位置判断降级');
    }
    if (Number.isFinite(live)) {
      score += live * 8;
      reasons.push(`盘中估算 ${pct(live)}`);
    } else {
      reasons.push('当前无可靠盘中估算');
    }
    if (Number.isFinite(tr)) {
      score += tr * 12;
      reasons.push(`近期趋势 ${pct(tr)}`);
    }
    score = Math.max(0, Math.min(100, score));
    let level = '中性区';
    let cls = 'fw-watch';
    if (score <= 38) { level = '低位区 · 可观察'; cls = 'fw-good'; }
    else if (score >= 68) { level = '高位区 · 谨慎'; cls = 'fw-risk'; }
    return { score, level, cls, reasons };
  }

  async function buildSelfCheck(funds) {
    const holdings = [];
    for (const f of funds.slice(0, 12)) {
      try {
        const r = await api(`/api/funds/${encodeURIComponent(f.fund_code)}/holdings`);
        (r.data || []).forEach(h => holdings.push({...h, fund_code: f.fund_code}));
      } catch (_) {}
    }
    if (!holdings.length) return { count: funds.length, maxStock: null, maxIndustry: null, status:'data' };

    const stock = new Map(), industry = new Map();
    holdings.forEach(h => {
      const w = num(h.weight);
      if (!Number.isFinite(w)) return;
      const s = h.stock_name || h.stock_code || '未知';
      const i = h.industry || '其他';
      stock.set(s, (stock.get(s)||0) + w);
      industry.set(i, (industry.get(i)||0) + w);
    });
    const maxStock = Math.max(...stock.values());
    const maxIndustry = Math.max(...industry.values());
    let status = '正常', cls = 'fw-good';
    if (maxStock >= 15 || maxIndustry >= 40) { status='高风险'; cls='fw-risk'; }
    else if (maxStock >= 10 || maxIndustry >= 30) { status='需关注'; cls='fw-watch'; }
    return {count:funds.length,maxStock,maxIndustry,status,cls};
  }

  async function mount() {
    if (document.getElementById('fw-pro-suite')) return;
    const home = document.querySelector('main.page > .view');
    if (!home) return;
    ensureStyle();

    const code = currentFundCode();
    let funds = [];
    try { funds = await loadFunds(); } catch (_) {}
    const fund = funds.find(x => x.fund_code === code) || funds[0];
    if (!fund) return;

    const suite = document.createElement('section');
    suite.id = 'fw-pro-suite';
    suite.innerHTML = `
      <div class="fw-grid">
        <div class="fw-card">
          <div class="fw-head"><div><div class="fw-title">波段信号 · 决策区</div><div class="fw-sub">位置 + 盘中估算 + 趋势，实时数据不可用时不伪造</div></div></div>
          <div class="fw-signal">
            <div class="fw-badge"><strong id="fw-signal-level">计算中</strong><span id="fw-signal-score">—</span></div>
            <div id="fw-signal-reasons" class="fw-muted">正在读取历史净值…</div>
          </div>
        </div>
        <div class="fw-card">
          <div class="fw-head"><div><div class="fw-title">组合自检</div><div class="fw-sub">检查数量、单只集中度、行业集中度</div></div></div>
          <div class="fw-stats" id="fw-selfcheck"><div class="fw-stat"><b>计算中</b><span>状态</span></div></div>
        </div>
      </div>
      <div class="fw-grid">
        <div class="fw-card">
          <div class="fw-head"><div><div class="fw-title">收益区间</div><div class="fw-sub">基于接口返回的历史净值样本，不足时明确提示</div></div></div>
          <div class="fw-range-tabs" id="fw-range-tabs">
            <button class="fw-tab on" data-range="7">近7日</button>
            <button class="fw-tab" data-range="30">近30日</button>
            <button class="fw-tab" data-range="90">近90日</button>
          </div>
          <div class="fw-range-value" id="fw-range-value">计算中</div>
          <div class="fw-range-meta" id="fw-range-meta">—</div>
        </div>
        <div class="fw-card">
          <div class="fw-head"><div><div class="fw-title">自选板块</div><div class="fw-sub">本机持久化，保留现有行业雷达</div></div></div>
          <div class="fw-sector-add"><input id="fw-sector-input" maxlength="20" placeholder="输入板块名称，如：半导体"><button class="fw-mini-btn" id="fw-sector-add">添加</button></div>
          <div class="fw-chips" id="fw-sector-list"></div>
        </div>
      </div>
    `;
    home.appendChild(suite);

    async function refreshSignal() {
      try {
        const history = await loadHistory(fund.fund_code, 60);
        const s = signalFor(fund, history);
        document.getElementById('fw-signal-level').textContent = s.level;
        document.getElementById('fw-signal-level').className = s.cls;
        document.getElementById('fw-signal-score').textContent = `综合分 ${s.score.toFixed(0)}/100`;
        document.getElementById('fw-signal-reasons').innerHTML = s.reasons.map(x => `<div class="fw-reason">${esc(x)}</div>`).join('');
      } catch (_) {
        document.getElementById('fw-signal-level').textContent = '数据不足';
        document.getElementById('fw-signal-score').textContent = '不做伪造判断';
      }
    }

    async function refreshSelfCheck() {
      const box = document.getElementById('fw-selfcheck');
      const s = await buildSelfCheck(funds);
      if (s.status === 'data') {
        box.innerHTML = '<div class="fw-stat"><b>数据不足</b><span>无法完成集中度检查</span></div>';
        return;
      }
      box.innerHTML = `
        <div class="fw-stat"><b>${s.count}</b><span>基金数量</span></div>
        <div class="fw-stat"><b>${s.maxStock.toFixed(1)}%</b><span>最高单项集中度</span></div>
        <div class="fw-stat"><b>${s.maxIndustry.toFixed(1)}%</b><span>最高行业集中度</span></div>
        <div class="fw-stat"><b class="${s.cls}">${s.status}</b><span>组合结论</span></div>
      `;
    }

    async function refreshRange(days) {
      const value = document.getElementById('fw-range-value');
      const meta = document.getElementById('fw-range-meta');
      value.textContent = '计算中';
      meta.textContent = '正在读取历史净值…';
      try {
        const history = await loadHistory(fund.fund_code, RANGE[String(days)] || 30);
        const vals = history.map(x => num(x.nav ?? x.estimated_nav)).filter(Number.isFinite);
        if (vals.length < 2) {
          value.textContent = '数据不足';
          meta.textContent = '接口未返回足够历史净值';
          return;
        }
        const start = days === 7 ? vals.slice(-7)[0] : vals[0];
        const end = vals.at(-1);
        const ret = (end / start - 1) * 100;
        value.textContent = pct(ret);
        meta.textContent = `样本 ${vals.length} 点；实际日期跨度以接口数据为准`;
      } catch (_) {
        value.textContent = '数据不足';
        meta.textContent = '当前无法取得历史净值';
      }
    }

    function renderSectors() {
      const el = document.getElementById('fw-sector-list');
      const list = storageGet(SECTOR_KEY, []);
      el.innerHTML = list.length ? list.map((x,i) =>
        `<span class="fw-chip">${esc(x)}<button data-i="${i}" aria-label="删除">×</button></span>`
      ).join('') : '<span class="fw-muted">暂无自选板块</span>';
      el.querySelectorAll('button').forEach(btn => btn.onclick = () => {
        const next = storageGet(SECTOR_KEY, []);
        next.splice(Number(btn.dataset.i), 1);
        storageSet(SECTOR_KEY, next);
        renderSectors();
      });
    }

    document.getElementById('fw-range-tabs').querySelectorAll('.fw-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#fw-range-tabs .fw-tab').forEach(x => x.classList.remove('on'));
        btn.classList.add('on');
        refreshRange(Number(btn.dataset.range));
      };
    });

    document.getElementById('fw-sector-add').onclick = () => {
      const input = document.getElementById('fw-sector-input');
      const v = input.value.trim();
      if (!v) return;
      const list = storageGet(SECTOR_KEY, []);
      if (!list.includes(v)) list.push(v);
      storageSet(SECTOR_KEY, list);
      input.value = '';
      renderSectors();
    };

    renderSectors();
    await Promise.all([refreshSignal(), refreshSelfCheck(), refreshRange(7)]);

    // Existing app refreshes every 30s; keep this layer aligned without replacing its timer.
    setInterval(() => {
      if (!document.getElementById('fw-pro-suite')) return;
      refreshSignal().catch(()=>{});
      refreshSelfCheck().catch(()=>{});
    }, 30000);
  }

  const boot = setInterval(() => {
    if (document.querySelector('main.page > .view')) {
      clearInterval(boot);
      mount().catch(() => {});
    }
  }, 500);

  window.addEventListener('beforeunload', () => clearInterval(boot));
})();
