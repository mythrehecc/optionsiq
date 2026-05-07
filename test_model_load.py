"""Test that the trained CNN + LSTM models load and run inference."""
import os
import sys
import numpy as np

print("Python:", sys.executable)

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf
print("TensorFlow:", tf.__version__)
import keras
print("Keras:", keras.__version__)

from keras.models import load_model

MODEL_DIR = os.path.join(os.path.dirname(__file__), "backend", "models")
cnn_path  = os.path.join(MODEL_DIR, "stock_cnn_model.h5")
lstm_path = os.path.join(MODEL_DIR, "stock_lstm_model.h5")

print("\nCNN path: ", cnn_path, " exists=", os.path.exists(cnn_path))
print("LSTM path:", lstm_path, " exists=", os.path.exists(lstm_path))

# --- CNN ---
try:
    cnn = load_model(cnn_path, compile=False)
    print("\nOK: CNN loaded: input=%s  output=%s" % (cnn.input_shape, cnn.output_shape))
    dummy = np.random.rand(1, 64, 64, 3).astype(np.float32)
    out = cnn.predict(dummy, verbose=0)
    print("   CNN inference output:", out.shape, " sample:", out[0])
except Exception as e:
    print("\nFAIL: CNN:", e)

# --- LSTM ---
try:
    lstm = load_model(lstm_path, compile=False)
    print("\nOK: LSTM loaded: input=%s  output=%s" % (lstm.input_shape, lstm.output_shape))
    dummy = np.random.rand(1, 20, 2).astype(np.float32)
    out = lstm.predict(dummy, verbose=0)
    print("   LSTM inference output:", out.shape, " sample:", out[0])
except Exception as e:
    print("\nFAIL: LSTM:", e)

print("\nDONE")
