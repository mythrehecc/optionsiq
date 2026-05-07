import h5py
import sys

print("Python:", sys.executable)

for fname in ['backend/models/stock_cnn_model.h5', 'backend/models/stock_lstm_model.h5']:
    try:
        with h5py.File(fname, 'r') as f:
            kv = f.attrs.get('keras_version', b'?')
            if isinstance(kv, bytes): kv = kv.decode()
            bk = f.attrs.get('backend', b'?')
            if isinstance(bk, bytes): bk = bk.decode()
            print(f"{fname}: keras_version={kv}, backend={bk}")
            print(f"  Keys: {list(f.keys())}")
    except Exception as e:
        print(f"{fname}: ERROR {e}")
