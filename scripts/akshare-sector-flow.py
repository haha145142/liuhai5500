from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import akshare as ak

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "akshare" / "sector-flow.json"
CATEGORIES = {
    "industry": "行业资金流",
    "concept": "概念资金流",
    "region": "地域资金流",
}


def pick_value(row, *keys):
    for key in keys:
        try:
            if key in row:
                return row[key]
        except Exception:
            continue
    return None


def number(value):
    if value is None:
        return None
    text = str(value).replace(",", "").replace("%", "").strip()
    if not text:
        return None
    try:
        value = float(text)
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) else None


def latest_trade_date(now: datetime) -> str:
    today = now.date()
    try:
        frame = ak.tool_trade_date_hist_sina()
        candidates = []
        for value in frame.iloc[:, 0].tolist():
            text = str(value).strip()[:10]
            try:
                day = datetime.fromisoformat(text).date()
            except ValueError:
                continue
            if day <= today:
                candidates.append(day)
        if candidates:
            return max(candidates).isoformat()
    except Exception:
        pass
    # Conservative fallback when the calendar provider is unavailable. Never move
    # the data date into the future; weekends roll back to the previous Friday.
    fallback = today
    while fallback.weekday() >= 5:
        fallback = fallback.fromordinal(fallback.toordinal() - 1)
    return fallback.isoformat()


def normalize_eastmoney(df, sector_type):
    rows = []
    if df is None:
        return rows
    for _, row in df.iterrows():
        name = str(pick_value(row, "名称", "板块名称", "行业", "概念", "地域") or "").strip()
        if not name:
            continue
        rows.append(
            {
                "name": name,
                "sector_type": sector_type,
                "provider": "AKShare/EastMoney",
                "change_pct": number(pick_value(row, "今日涨跌幅", "涨跌幅", "涨跌")),
                "main_net_inflow": number(pick_value(row, "今日主力净流入-净额", "主力净流入-净额", "主力净流入")),
                "main_net_ratio": number(pick_value(row, "今日主力净流入-净占比", "主力净流入-净占比")),
                "super_net_inflow": number(pick_value(row, "今日超大单净流入-净额", "超大单净流入-净额")),
                "large_net_inflow": number(pick_value(row, "今日大单净流入-净额", "大单净流入-净额")),
                "mid_net_inflow": number(pick_value(row, "今日中单净流入-净额", "中单净流入-净额")),
                "small_net_inflow": number(pick_value(row, "今日小单净流入-净额", "小单净流入-净额")),
            }
        )
    return rows


def normalize_ths(df, sector_type):
    rows = []
    if df is None:
        return rows
    for _, row in df.iterrows():
        name = str(pick_value(row, "行业", "概念", "名称", "板块名称") or "").strip()
        if not name:
            continue
        net_yi = number(pick_value(row, "净额"))
        rows.append(
            {
                "name": name,
                "sector_type": sector_type,
                "provider": "AKShare/THS",
                "change_pct": number(pick_value(row, "行业-涨跌幅", "涨跌幅", "涨跌")),
                "main_net_inflow": net_yi * 100_000_000 if net_yi is not None else None,
                "main_net_ratio": None,
                "super_net_inflow": None,
                "large_net_inflow": None,
                "mid_net_inflow": None,
                "small_net_inflow": None,
            }
        )
    return rows


def fetch():
    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    market_date = latest_trade_date(now)
    payload = {
        "ok": True,
        "source": "AKShare",
        "provider": "akshare",
        "schemaVersion": 3,
        "fetchedAt": now.isoformat(),
        "marketDate": market_date,
        "rows": [],
        "errors": [],
        "sources": [],
    }

    for sector_type, api_value in CATEGORIES.items():
        rows = []
        try:
            frame = ak.stock_sector_fund_flow_rank(
                indicator="今日",
                sector_type=api_value,
            )
            rows = normalize_eastmoney(frame, sector_type)
            if rows:
                payload["sources"].append({"sector_type": sector_type, "provider": "AKShare/EastMoney", "rowCount": len(rows)})
        except Exception as exc:
            payload["errors"].append(
                {
                    "sector_type": sector_type,
                    "provider": "AKShare/EastMoney",
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

        if not rows and sector_type == "industry":
            try:
                frame = ak.stock_fund_flow_industry(symbol="即时")
                rows = normalize_ths(frame, sector_type)
                if rows:
                    payload["sources"].append({"sector_type": sector_type, "provider": "AKShare/THS", "rowCount": len(rows)})
            except Exception as exc:
                payload["errors"].append(
                    {
                        "sector_type": sector_type,
                        "provider": "AKShare/THS",
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                )

        if not rows and sector_type == "concept":
            try:
                frame = ak.stock_fund_flow_concept(symbol="即时")
                rows = normalize_ths(frame, sector_type)
                if rows:
                    payload["sources"].append({"sector_type": sector_type, "provider": "AKShare/THS", "rowCount": len(rows)})
            except Exception as exc:
                payload["errors"].append(
                    {
                        "sector_type": sector_type,
                        "provider": "AKShare/THS",
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                )

        payload["rows"].extend(rows)

    if not payload["rows"]:
        raise RuntimeError("AKShare returned no sector-flow rows from any supported source")

    source_types = {item["sector_type"] for item in payload["sources"]}
    payload["complete"] = source_types == set(CATEGORIES)
    payload["rowCount"] = len(payload["rows"])
    return payload


def main():
    payload = fetch()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {payload['rowCount']} AKShare rows to {OUTPUT}")
    print(f"marketDate={payload['marketDate']}")
    print(f"sources={payload['sources']}")
    if payload["errors"]:
        print(f"errors={payload['errors']}")


if __name__ == "__main__":
    main()
