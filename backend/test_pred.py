import sys
import os
from app import create_app
from app.routes.predictions import predict
import app.routes.predictions as preds

# Bypass JWT for testing
preds.jwt_required = lambda: lambda fn: fn

app = create_app()

with app.app_context():
    # monkeypatch jwt_required out of the view function
    with app.test_request_context('/predictions/predict?ticker=AAPL'):
        # Just call predict directly
        try:
            res = predict()
            print("Response Status:", res[1])
            # print("Response JSON keys:", res[0].json.keys())
            print("Successfully executed predict.")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print("API error:", e)
