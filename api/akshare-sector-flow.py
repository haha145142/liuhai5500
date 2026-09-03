from __future__ import annotations

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

import akshare as ak

app = FastAPI(title="Fund AI Pro AKShare Sector Flow")
CN = ZoneInfo("Asia/Shanghai")


def pick_value(row: Any, *keys: str) -> Any:
    for key in keys:
        try:
            if key in row:
                return row[key]
        except Exception:
            pass
    return None


def as_number(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        text = str(value).replace(",", "").replace("%", "").strip()
        parsed = float(text)
        return parsed if parsed == parsed and parsed not in (float("inf"), float("-inf")) else None
    except (TypeError, ValueError):
        return None


def latest_trade_date() -> str:
    today = datetime.now(CN).date()
    try:
        frame = ak.tool_trade_date_hist_sina()
        dates = []
        for value in frame.iloc[:, 0].tolist():
            try:
                day = datetime.fromisoformat(str(value)[:10]).date()
            except ValueError:
                continue
            if day <= today:
                dates.append(day)
        if dates:
            return max(dates).isoformat()
    except Exception:
        pass
    day = today
    while day.weekday() >= 5:
        day = day.fromordinal(day.toordinal() - 1)
    return day.isoformat()


def normalize(df: Any, sector_type: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
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
                "change_pct": as_number(pick_value(row, "今日涨跌幅", "涨跌幅", "涨跌")),
                "main_net_inflow": as_number(pick_value(row, "今日主力净流入-净额", "主力净流入-净额", "主力净流入")),
                "main_net_ratio": as_number(pick_value(row, "今日主力净流入-净占比", "主力净流入-净占比")),
                "super_net_inflow": as_number(pick_value(row, "今日超大单净流入-净额", "超大单净流入-净额")),
                "large_net_inflow": as_number(pick_value(row, "今日大单净流入-净额", "大单净流入-净额")),
                "mid_net_inflow": as_number(pick_value(row, "今日中单净流入-净额", "中单净流入-净额")),
                "small_net_inflow": as_number(pick_value(row, "今日小单净流入-净额", "小单净流入-净额")),
            }
        )
    return rows


@app.get("/")
async def sector_flow(
    sector_type: str = Query(default="industry"),
    indicator: str = Query(default="今日"),
):
    if sector_type not in {"industry", "concept", "region"}:
        return JSONResponse({"ok": False, "error": "unsupported sector_type"}, status_code=400)
    mapping = {
        "industry": "行业资金流",
        "concept": "概念资金流",
        "region": "地域资金流",
    }
    try:
        df = ak.stock_sector_fund_flow_rank(indicator=indicator, sector_type=mapping[sector_type])
        rows = normalize(df, sector_type)
        return {
            "ok": bool(rows),
            "source": "AKShare",
            "sector_type": sector_type,
            "indicator": indicator,
            "fetchedAt": datetime.now(CN).isoformat(),
            "marketDate": latest_trade_date(),
            "rowCount": len(rows),
            "rows": rows,
        }
    except Exception as exc:
        return JSONResponse(
            {"ok": False, "source": "AKShare", "error": f"{type(exc).__name__}: {exc}"},
            status_code=502,
        )
