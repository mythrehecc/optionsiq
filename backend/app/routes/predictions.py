"""
Stock Trend Prediction API — CNN + LSTM dual-model inference.

Generates 20-day chart images and price sequences on-the-fly,
runs inference with pre-trained models, returns predictions.

Models are loaded once and cached for the lifetime of the process.
  - CNN  expects input (None, 64, 64, 3)
  - LSTM expects input (None, 20, 2)   → [daily_return, volume_ratio]
"""

import io
import os
import base64
import numpy as np
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

predictions_bp = Blueprint("predictions", __name__)

SUPPORTED_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA",
    "JPM", "BAC", "GS", "JNJ", "PFE", "XOM", "CVX",
    "WMT", "HD", "DIS", "NFLX", "AMD", "INTC",
]

WINDOW = 20
THRESHOLD = 0.005  # ±0.5%

# ── Model cache ─────────────────────────────────────────────────────────────
_cnn_model = None
_lstm_model = None
_models_loaded = False

_model_stats = {
    "cnn_accuracy": 62.4,
    "lstm_accuracy": 64.1,
    "train_period": "2010-01 to 2018-01",
    "test_period": "2018-02 to 2020-01",
    "tickers_trained": len(SUPPORTED_TICKERS),
}


def _get_model_dir():
    return os.path.join(os.path.dirname(__file__), "..", "..", "models")


def _load_models():
    """Load CNN and LSTM models once; cache globally."""
    global _cnn_model, _lstm_model, _models_loaded
    if _models_loaded:
        return _cnn_model, _lstm_model

    cnn_path = os.path.join(_get_model_dir(), "stock_cnn_model.h5")
    lstm_path = os.path.join(_get_model_dir(), "stock_lstm_model.h5")

    # Log resolved paths so startup issues are obvious in server console
    import logging
    log = logging.getLogger(__name__)
    log.info(f"[predictions] CNN  path: {os.path.abspath(cnn_path)}  exists={os.path.exists(cnn_path)}")
    log.info(f"[predictions] LSTM path: {os.path.abspath(lstm_path)}  exists={os.path.exists(lstm_path)}")

    try:
        from tensorflow.keras.models import load_model

        if os.path.exists(cnn_path):
            _cnn_model = load_model(cnn_path, compile=False)
            log.info("[predictions] CNN model loaded OK")
        else:
            log.warning("[predictions] CNN model file NOT FOUND")
            _cnn_model = None

        if os.path.exists(lstm_path):
            _lstm_model = load_model(lstm_path, compile=False)
            log.info("[predictions] LSTM model loaded OK")
        else:
            log.warning("[predictions] LSTM model file NOT FOUND")
            _lstm_model = None

    except ImportError as e:
        log.error(f"[predictions] TensorFlow not installed in this Python env: {e}")
        log.error(f"[predictions] Python executable: {os.sys.executable}")
        _cnn_model = None
        _lstm_model = None
    except Exception as e:
        log.error(f"[predictions] Failed to load models: {e}")
        _cnn_model = None
        _lstm_model = None

    _models_loaded = True
    return _cnn_model, _lstm_model



# ── Data fetching ────────────────────────────────────────────────────────────

def _fetch_data(ticker, period="3mo"):
    """Fetch recent stock data via yfinance.

    NOTE: yfinance >= 1.0 requires curl_cffi internally.
    Do NOT pass a requests.Session — let yfinance manage its own session.
    """
    import yfinance as yf

    for p in [period, "6mo", "1y"]:
        try:
            df = yf.download(ticker, period=p, progress=False, auto_adjust=True)
        except Exception:
            df = None

        if df is not None and not df.empty:
            # Flatten multi-level columns if present (multi-ticker download)
            if hasattr(df.columns, "levels"):
                df.columns = df.columns.get_level_values(0)
            if len(df) >= WINDOW + 1:
                return df

    return None


# ── Feature engineering ──────────────────────────────────────────────────────

def _generate_chart_display(closes, volumes):
    """Generate a styled 2-panel chart image for display (base64 PNG)."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    daily_returns = closes.pct_change().fillna(0).values
    cum_returns = np.cumprod(1 + daily_returns) - 1
    avg_vol = np.mean(volumes)
    rel_volume = volumes / avg_vol if avg_vol > 0 else volumes

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(3, 3), dpi=80,
                                    gridspec_kw={"height_ratios": [2, 1]})
    fig.patch.set_facecolor("#0f0f23")

    ax1.plot(cum_returns, color="#6366f1", linewidth=1.5)
    ax1.fill_between(range(len(cum_returns)), cum_returns, alpha=0.15, color="#6366f1")
    ax1.set_facecolor("#0f0f23")
    ax1.tick_params(colors="white", labelsize=6)
    ax1.set_title("Cumulative Return", color="white", fontsize=7, pad=3)
    ax1.axhline(y=0, color="#ffffff", alpha=0.2, linewidth=0.5)
    for spine in ax1.spines.values():
        spine.set_visible(False)

    ax2.bar(range(len(rel_volume)), rel_volume, color="#22d3ee", alpha=0.7, width=0.8)
    ax2.set_facecolor("#0f0f23")
    ax2.tick_params(colors="white", labelsize=6)
    ax2.set_title("Relative Volume", color="white", fontsize=7, pad=3)
    for spine in ax2.spines.values():
        spine.set_visible(False)

    plt.tight_layout(pad=0.5)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="#0f0f23")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _generate_cnn_input(closes, volumes):
    """
    Generate a 64×64 RGB numpy array for CNN inference.
    CNN input shape: (None, 64, 64, 3)
    """
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from PIL import Image

    daily_returns = closes.pct_change().fillna(0).values
    cum_returns = np.cumprod(1 + daily_returns) - 1
    avg_vol = np.mean(volumes)
    rel_volume = volumes / avg_vol if avg_vol > 0 else np.ones_like(volumes)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(0.64, 0.64), dpi=100,
                                    gridspec_kw={"height_ratios": [2, 1]})
    ax1.plot(cum_returns, color="black", linewidth=1)
    ax1.set_xticks([])
    ax1.set_yticks([])
    ax2.bar(range(len(rel_volume)), rel_volume, color="gray", width=0.8)
    ax2.set_xticks([])
    ax2.set_yticks([])
    for ax in [ax1, ax2]:
        for spine in ax.spines.values():
            spine.set_visible(False)
    plt.subplots_adjust(hspace=0.05, left=0, right=1, top=1, bottom=0)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0)
    plt.close(fig)
    buf.seek(0)

    # Resize to exactly 64×64 RGB as the CNN expects
    img = Image.open(buf).convert("RGB").resize((64, 64))
    return np.array(img, dtype=np.float32) / 255.0


def _generate_lstm_input(closes, volumes):
    """
    Prepare a 20-step sequence for LSTM inference.
    LSTM input shape: (None, 20, 2) → [daily_return, volume_ratio]
    """
    daily_returns = closes.pct_change().fillna(0).values
    avg_vol = np.mean(volumes)
    rel_volume = volumes / avg_vol if avg_vol > 0 else np.ones_like(volumes, dtype=np.float32)
    seq = np.stack([daily_returns, rel_volume], axis=-1)  # (20, 2)
    return seq.astype(np.float32)


def _decode_prediction(prob_array):
    """Convert 3-class softmax output → (label int, confidence float)."""
    label_map = {0: -1, 1: 0, 2: 1}   # class 0 = Fall, 1 = Neutral, 2 = Rise
    idx = int(np.argmax(prob_array))
    conf = float(prob_array[idx])
    return label_map[idx], conf


# ── Routes ──────────────────────────────────────────────────────────────────

@predictions_bp.route("/tickers", methods=["GET"])
@jwt_required()
def get_tickers():
    return jsonify({"tickers": SUPPORTED_TICKERS}), 200


@predictions_bp.route("/model-info", methods=["GET"])
@jwt_required()
def model_info():
    cnn_available = os.path.exists(os.path.join(_get_model_dir(), "stock_cnn_model.h5"))
    lstm_available = os.path.exists(os.path.join(_get_model_dir(), "stock_lstm_model.h5"))
    return jsonify({
        "stats": _model_stats,
        "cnn_available": cnn_available,
        "lstm_available": lstm_available,
    }), 200


@predictions_bp.route("/debug", methods=["GET"])
def debug_models():
    """No-auth debug endpoint — shows exact model load status."""
    import sys
    model_dir = os.path.abspath(_get_model_dir())
    cnn_path  = os.path.join(model_dir, "stock_cnn_model.h5")
    lstm_path = os.path.join(model_dir, "stock_lstm_model.h5")

    tf_version = None
    tf_error   = None
    try:
        import tensorflow as tf
        tf_version = tf.__version__
    except Exception as e:
        tf_error = str(e)

    # Force-reload models so debug always shows fresh result
    global _models_loaded
    _models_loaded = False
    cnn, lstm = _load_models()

    return jsonify({
        "python":         sys.executable,
        "python_version": sys.version,
        "tensorflow":     tf_version,
        "tf_error":       tf_error,
        "model_dir":      model_dir,
        "cnn_file_exists":  os.path.exists(cnn_path),
        "lstm_file_exists": os.path.exists(lstm_path),
        "cnn_loaded":     cnn  is not None,
        "lstm_loaded":    lstm is not None,
        "status": "OK" if (cnn and lstm) else "PARTIAL" if (cnn or lstm) else "FAILED",
    }), 200


@predictions_bp.route("/predict", methods=["GET"])
@jwt_required()
def predict():
    ticker = request.args.get("ticker", "AAPL").upper()
    if ticker not in SUPPORTED_TICKERS:
        return jsonify({"error": f"Ticker '{ticker}' is not supported"}), 400

    # ── 1. Fetch market data ────────────────────────────────────────────────
    df = _fetch_data(ticker)
    if df is None or len(df) < WINDOW + 1:
        return jsonify({"error": f"Could not fetch enough market data for {ticker}"}), 400

    recent = df.tail(WINDOW)
    closes = recent["Close"].reset_index(drop=True)
    volumes = recent["Volume"].values.flatten().astype(np.float32)

    # ── 2. Load models ──────────────────────────────────────────────────────
    cnn_model, lstm_model = _load_models()

    if cnn_model is None and lstm_model is None:
        return jsonify({
            "error": "Trained models are not available. "
                     "Please ensure stock_cnn_model.h5 and stock_lstm_model.h5 "
                     "exist in the models/ directory and TensorFlow is installed."
        }), 503

    label_text = {1: "Rise", 0: "Neutral", -1: "Fall"}
    result = {"ticker": ticker}

    # ── 3. CNN inference ────────────────────────────────────────────────────
    if cnn_model is not None:
        try:
            img_arr = _generate_cnn_input(closes, volumes)             # (64, 64, 3)
            probs = cnn_model.predict(np.expand_dims(img_arr, 0), verbose=0)[0]
            cnn_label, cnn_conf = _decode_prediction(probs)
            result["cnn"] = {
                "prediction": cnn_label,
                "prediction_text": label_text[cnn_label],
                "confidence": round(cnn_conf * 100, 1),
                "model_accuracy": _model_stats["cnn_accuracy"],
            }
        except Exception as e:
            result["cnn"] = {"error": f"CNN inference failed: {str(e)}"}
    else:
        result["cnn"] = {"error": "CNN model file not found"}

    # ── 4. LSTM inference ───────────────────────────────────────────────────
    if lstm_model is not None:
        try:
            seq = _generate_lstm_input(closes, volumes)                # (20, 2)
            probs = lstm_model.predict(np.expand_dims(seq, 0), verbose=0)[0]
            lstm_label, lstm_conf = _decode_prediction(probs)
            result["lstm"] = {
                "prediction": lstm_label,
                "prediction_text": label_text[lstm_label],
                "confidence": round(lstm_conf * 100, 1),
                "model_accuracy": _model_stats["lstm_accuracy"],
            }
        except Exception as e:
            result["lstm"] = {"error": f"LSTM inference failed: {str(e)}"}
    else:
        result["lstm"] = {"error": "LSTM model file not found"}

    # ── 5. Display chart ────────────────────────────────────────────────────
    try:
        chart_b64 = _generate_chart_display(closes, volumes)
        result["chart_image"] = chart_b64
    except Exception as e:
        result["chart_image"] = None

    result["window_days"] = WINDOW
    result["data_points"] = len(recent)

    return jsonify(result), 200
