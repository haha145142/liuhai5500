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


def normalize(df, sector_type):
    rows = []
    if df is None:
        return rows
    for _, row in df.iterrows():
        name = str(
            pick_value(row, "名称", "板块名称", "行业", "概念", "地域") or ""
        ).strip()
        if not name:
            continue
        rows.append(
            {
                "name": name,
                "sector_type": sector_type,
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


def fetch():
    now = datetime.now(ZoneInfo("Asia/Shanghai"))
    payload = {
        "ok": True,
        "source": "AKShare",
        "provider": "akshare",
        "schemaVersion": 1,
        "fetchedAt": now.isoformat(),
        "marketDate": now.date().isoformat(),
        "rows": [],
        "errors": [],
    }

    for sector_type, api_value in CATEGORIES.items():
        try:
            frame = ak.stock_sector_fund_flow_rank(
                indicator="今日",
                sector_type=api_value,
            )
            payload["rows"].extend(normalize(frame, sector_type))
        except Exception as exc:
            payload["errors"].append(
                {
                    "sector_type": sector_type,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

    if not payload["rows"]:
        raise RuntimeError("AKShare returned no sector-flow rows")

    # Keep successful data even if one category endpoint failed.
    payload["complete"] = not payload["errors"]
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


if __name__ == "__main__":
    main()
