from __future__ import annotations

import argparse
import json
from pathlib import Path

from engine import run_portfolio


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the WTC Tortila local backtester.")
    parser.add_argument("--config", default="config.example.json")
    parser.add_argument("--out", default="result.json")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    result = run_portfolio(config)
    Path(args.out).write_text(json.dumps(result, indent=2), encoding="utf-8")
    p = result["portfolio"]
    print(f"final_equity={p['final_equity']} total_return_pct={p['total_return_pct']} trades={p['total_trades']}")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

