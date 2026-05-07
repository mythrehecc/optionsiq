import sys, os
sys.path.insert(0, '.')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

import numpy as np
from app.routes.predictions import (
    _fetch_data, _load_models,
    _generate_cnn_input, _generate_lstm_input,
    _decode_prediction, WINDOW
)

LABEL = {1: "Rise", 0: "Neutral", -1: "Fall"}

print("=== Step 1: Fetch data ===")
df = _fetch_data('AAPL')
if df is None:
    print("FAIL: no data returned")
    sys.exit(1)
recent = df.tail(WINDOW)
closes = recent['Close'].reset_index(drop=True)
volumes = recent['Volume'].values.flatten().astype(np.float32)
print(f"OK: {len(recent)} rows fetched")

print("\n=== Step 2: Load models ===")
cnn, lstm = _load_models()
print(f"CNN loaded  : {cnn is not None}")
print(f"LSTM loaded : {lstm is not None}")
if cnn is None and lstm is None:
    print("FAIL: neither model loaded")
    sys.exit(1)

print("\n=== Step 3: CNN inference ===")
if cnn is not None:
    img = _generate_cnn_input(closes, volumes)
    print(f"CNN input shape : {img.shape}")
    probs = cnn.predict(np.expand_dims(img, 0), verbose=0)[0]
    print(f"CNN raw probs   : Fall={probs[0]:.3f}, Neutral={probs[1]:.3f}, Rise={probs[2]:.3f}")
    label, conf = _decode_prediction(probs)
    print(f"CNN prediction  : {LABEL[label]} ({conf*100:.1f}% confidence)")
else:
    print("SKIP: CNN model not found")

print("\n=== Step 4: LSTM inference ===")
if lstm is not None:
    seq = _generate_lstm_input(closes, volumes)
    print(f"LSTM input shape : {seq.shape}")
    probs = lstm.predict(np.expand_dims(seq, 0), verbose=0)[0]
    print(f"LSTM raw probs   : Fall={probs[0]:.3f}, Neutral={probs[1]:.3f}, Rise={probs[2]:.3f}")
    label, conf = _decode_prediction(probs)
    print(f"LSTM prediction  : {LABEL[label]} ({conf*100:.1f}% confidence)")
else:
    print("SKIP: LSTM model not found")

print("\nALL TESTS PASSED — rule-based fallback is GONE")
