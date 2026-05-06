import json

nb_path = 'stock_prediction.ipynb'
with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# ── 1. Update the config cell (contains TICKERS + START_DATE) ─────────────────
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        src = ''.join(cell['source'])
        if 'START_DATE' in src and 'TICKERS' in src:
            cell['source'] = [
                "from datetime import datetime, timedelta\n",
                "\n",
                "# ── Dynamic date configuration (always relative to today) ──────────────\n",
                "today      = datetime.today()\n",
                "END_DATE   = today.strftime('%Y-%m-%d')                          # today\n",
                "START_DATE = today.replace(year=today.year - 10).strftime('%Y-%m-%d')  # 10 yrs back\n",
                "_train_end = today.replace(year=today.year - 2)                  # 2 yrs back\n",
                "TRAIN_END  = _train_end.strftime('%Y-%m-%d')\n",
                "TEST_START = (_train_end + timedelta(days=1)).strftime('%Y-%m-%d')\n",
                "\n",
                "print(f'Date Range : {START_DATE}  -->  {END_DATE}')\n",
                "print(f'Train      : {START_DATE}  -->  {TRAIN_END}')\n",
                "print(f'Test       : {TEST_START}  -->  {END_DATE}')\n",
                "\n",
                "# ── Tickers ────────────────────────────────────────────────────────────\n",
                "TICKERS = [\n",
                "    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA',\n",
                "    'JPM',  'BAC',  'GS',   'JNJ',  'PFE',  'XOM',  'CVX',\n",
                "    'WMT',  'HD',   'DIS',  'NFLX', 'AMD',  'INTC'\n",
                "]\n",
                "\n",
                "WINDOW    = 20\n",
                "THRESHOLD = 0.005  # +/- 0.5 % return for labels\n",
                "\n",
                "# ── Output directories ─────────────────────────────────────────────────\n",
                "import os\n",
                "IMAGE_DIR = 'chart_images'\n",
                "TRAIN_DIR = os.path.join(IMAGE_DIR, 'train')\n",
                "TEST_DIR  = os.path.join(IMAGE_DIR, 'test')\n",
                "PRED_DIR  = os.path.join(IMAGE_DIR, 'predictions')\n",
                "\n",
                "for d in [TRAIN_DIR, TEST_DIR, PRED_DIR]:\n",
                "    os.makedirs(d, exist_ok=True)\n",
                "\n",
                "# ── Fetch data ─────────────────────────────────────────────────────────\n",
                "import yfinance as yf\n",
                "import pandas as pd\n",
                "all_data = {}\n",
                "print('Fetching data...')\n",
                "for ticker in TICKERS:\n",
                "    df = yf.download(ticker, start=START_DATE, end=END_DATE, progress=False)\n",
                "    if not df.empty:\n",
                "        if hasattr(df.columns, 'levels'):\n",
                "            df.columns = df.columns.get_level_values(0)\n",
                "        df['Daily_Return'] = df['Close'].pct_change().fillna(0)\n",
                "        all_data[ticker] = df\n",
                "\n",
                "print(f'Fetched data for {len(all_data)} tickers.')\n",
            ]
            print('[OK] Config cell updated with dynamic dates.')
            break

# ── 2. Update the markdown description ────────────────────────────────────────
for cell in nb['cells']:
    if cell['cell_type'] == 'markdown':
        src = ''.join(cell['source'])
        if 'Jan 2010' in src or 'Jan 2018' in src or 'Feb 2018' in src:
            cell['source'] = [
                "# Stock Trend Prediction - CNN & LSTM Pipeline\n",
                "\n",
                "This notebook covers:\n",
                "1. **Phase 1: Data Preparation & Chart Generation** - Fetching historical data "
                "from Yahoo Finance (last **10 years → today**), calculating daily returns, "
                "relative volume, and generating 20-day chart images.\n",
                "2. **Phase 2: Model Development & Training** - Splitting data by time "
                "(**Train:** 10 yrs ago → 2 yrs ago | **Test:** 2 yrs ago → today), "
                "labeling data based on day-21 returns, and training both a CNN on images "
                "and an LSTM on raw sequences.\n",
                "3. **Phase 3: Inference & Evaluation** - Evaluating accuracy, saving models "
                "(`.h5`), rewriting test images with predictions, and providing a function "
                "to randomly display test results.",
            ]
            print('[OK] Markdown header updated.')
            break

# ── 3. Save ───────────────────────────────────────────────────────────────────
with open(nb_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print('[DONE] Notebook saved successfully.')
