from __future__ import annotations

import argparse
import time
from pathlib import Path

import ccxt
import pandas as pd


def main() -> int:
    parser = argparse.ArgumentParser(description="Download public OHLCV CSVs for the local backtester.")
    parser.add_argument("--symbols", nargs="+", required=True)
    parser.add_argument("--timeframe", default="1h", choices=["1h", "4h"])
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--out", default="data")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    exchange = ccxt.bingx({"enableRateLimit": True})
    since = int((time.time() - args.days * 86400) * 1000)

    for symbol in args.symbols:
        rows = []
        cursor = since
        while True:
            batch = exchange.fetch_ohlcv(symbol, args.timeframe, since=cursor, limit=1000)
            if not batch:
                break
            rows.extend(batch)
            cursor = batch[-1][0] + 1
            if len(batch) < 1000:
                break
        df = pd.DataFrame(rows, columns=["timestamp", "open", "high", "low", "close", "volume"])
        file_symbol = symbol.replace("/", "_").replace(":", "_")
        path = out / f"{file_symbol}_{args.timeframe}.csv"
        df.to_csv(path, index=False)
        print(f"wrote {path} ({len(df)} bars)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

