WTC Tortila Local Backtester 0.1.0

This runner executes on your own computer. The WTC web app does not run user
backtests on the server in this MVP.

Requirements:
- Python 3.11+
- pip install -r requirements.txt

Quick start:
1. Edit config.example.json.
2. Put OHLCV CSV files in ./data, or use download_ohlcv.py to fetch public data.
3. Run:
   python run.py --config config.example.json --out result.json

CSV format:
timestamp,open,high,low,close,volume

The timestamp can be an ISO datetime or milliseconds since epoch. No exchange
API keys are required. Results stay local as result.json.

