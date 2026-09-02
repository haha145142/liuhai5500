from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

import akshare as ak

app = FastAPI(title="Fund AI Pro AKShare Sector Flow")


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
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize(df: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if df is None:
        return rows
    for _, row in df.iterrows():
        name = str(pick_value(row, "名称", "板块名称", "行业", "概念") or "").strip()
        if not name:
            continue
        rows.append(
            {
                "name": name,
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
async def health() -> dict[str, str]:
    return {"ok": "true", "source": "AKShare"}


@app.get("/api/akshare-sector-flow")
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
        return {
            "ok": True,
            "source": "AKShare",
            "sector_type": sector_type,
            "indicator": indicator,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "rows": normalize(df),
        }
    except Exception as exc:
        return JSONResponse(
            {"ok": False, "source": "AKShare", "error": f"{type(exc).__name__}: {exc}"},
            status_code=502,
        )
