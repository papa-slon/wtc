from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class EngineConfig:
    symbols: list[str]
    timeframe: str
    system: int
    risk_pct: float
    stop_n: float
    add_step: float
    max_units: int
    atr_period: int
    initial_equity: float
    fee_rate: float
    slippage: float
    data_dir: str


def _read_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"timestamp", "open", "high", "low", "close"}
    missing = required.difference(df.columns)
    if missing:
        raise ValueError(f"{path} missing columns: {sorted(missing)}")
    ts = df["timestamp"]
    if np.issubdtype(ts.dtype, np.number):
        df["ts_ms"] = ts.astype("int64")
    else:
        df["ts_ms"] = pd.to_datetime(ts, utc=True).astype("int64") // 1_000_000
    for col in ["open", "high", "low", "close"]:
        df[col] = pd.to_numeric(df[col], errors="raise")
    return df.sort_values("ts_ms").reset_index(drop=True)


def _atr(df: pd.DataFrame, period: int) -> pd.Series:
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()


def _max_drawdown_pct(equity: list[dict[str, float]]) -> float:
    peak = None
    max_dd = 0.0
    for p in equity:
        value = float(p["equity"])
        peak = value if peak is None else max(peak, value)
        if peak > 0:
            max_dd = max(max_dd, (peak - value) / peak * 100)
    return round(max_dd, 4)


def _profit_factor(pnls: list[float]) -> float | None:
    gains = sum(p for p in pnls if p > 0)
    losses = abs(sum(p for p in pnls if p < 0))
    if losses == 0:
        return None if gains == 0 else float("inf")
    return round(gains / losses, 4)


def run_symbol(symbol: str, cfg: EngineConfig) -> dict[str, Any]:
    file_symbol = symbol.replace("/", "_").replace(":", "_")
    path = Path(cfg.data_dir) / f"{file_symbol}_{cfg.timeframe}.csv"
    df = _read_csv(path)
    if len(df) < max(cfg.atr_period + 60, 100):
        raise ValueError(f"{symbol}: insufficient bars ({len(df)})")

    entry_lookback = 55 if cfg.system == 2 else 20
    exit_lookback = 20 if cfg.system == 2 else 10
    df["atr"] = _atr(df, cfg.atr_period)
    df["entry_high"] = df["high"].shift(1).rolling(entry_lookback).max()
    df["exit_low"] = df["low"].shift(1).rolling(exit_lookback).min()

    equity = cfg.initial_equity
    position_qty = 0.0
    avg_entry = 0.0
    stop = 0.0
    open_ts = 0
    trades: list[dict[str, Any]] = []
    curve: list[dict[str, float]] = []

    for row in df.itertuples(index=False):
        price = float(row.close)
        atr = float(row.atr) if pd.notna(row.atr) else np.nan
        ts_ms = int(row.ts_ms)

        if position_qty == 0 and pd.notna(row.entry_high) and price > float(row.entry_high) and pd.notna(atr):
            risk_cash = equity * cfg.risk_pct
            stop_dist = max(atr * cfg.stop_n, price * 0.001)
            position_qty = risk_cash / stop_dist
            avg_entry = price * (1 + cfg.slippage)
            stop = avg_entry - stop_dist
            open_ts = ts_ms
            equity -= abs(position_qty * avg_entry) * cfg.fee_rate
        elif position_qty > 0:
            exit_signal = pd.notna(row.exit_low) and price < float(row.exit_low)
            stop_signal = float(row.low) <= stop
            if exit_signal or stop_signal:
                exit_price = (stop if stop_signal else price) * (1 - cfg.slippage)
                pnl = (exit_price - avg_entry) * position_qty
                fee = abs(position_qty * exit_price) * cfg.fee_rate
                equity += pnl - fee
                trades.append(
                    {
                        "symbol": symbol,
                        "side": "long",
                        "qty": round(position_qty, 8),
                        "avg_entry": round(avg_entry, 8),
                        "exit_price": round(exit_price, 8),
                        "pnl": round(pnl - fee, 4),
                        "open_ts": open_ts,
                        "close_ts": ts_ms,
                        "exit_reason": "stop" if stop_signal else "exit_signal",
                    }
                )
                position_qty = 0.0
                avg_entry = 0.0
                stop = 0.0

        unrealized = (price - avg_entry) * position_qty if position_qty > 0 else 0.0
        curve.append({"ts_ms": ts_ms, "equity": round(equity + unrealized, 4)})

    pnls = [float(t["pnl"]) for t in trades]
    wins = [p for p in pnls if p > 0]
    final_equity = curve[-1]["equity"]
    return {
        "symbol": symbol,
        "timeframe": cfg.timeframe,
        "initial_equity": cfg.initial_equity,
        "final_equity": final_equity,
        "total_return_pct": round((final_equity / cfg.initial_equity - 1) * 100, 4),
        "num_trades": len(trades),
        "win_rate": round(len(wins) / len(trades) * 100, 4) if trades else None,
        "profit_factor": _profit_factor(pnls),
        "max_drawdown_pct": _max_drawdown_pct(curve),
        "equity_curve": curve,
        "trades": trades,
        "bars_processed": len(df),
    }


def run_portfolio(config: dict[str, Any]) -> dict[str, Any]:
    cfg = EngineConfig(**config)
    per_symbol = [run_symbol(symbol, cfg) for symbol in cfg.symbols]
    final_equity = sum(float(r["final_equity"]) for r in per_symbol)
    initial = cfg.initial_equity * len(per_symbol)
    total_trades = sum(int(r["num_trades"]) for r in per_symbol)
    return {
        "schema_version": "wtc-local-tortila/v1",
        "engine": "tortila",
        "runner_version": "0.1.0",
        "config": config,
        "portfolio": {
            "initial_equity": initial,
            "final_equity": round(final_equity, 4),
            "total_return_pct": round((final_equity / initial - 1) * 100, 4),
            "total_trades": total_trades,
            "max_drawdown_pct": max((float(r["max_drawdown_pct"]) for r in per_symbol), default=0.0),
        },
        "per_symbol": per_symbol,
    }

