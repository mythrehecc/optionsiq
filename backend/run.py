"""
Backend entry point.

Auto-selects venv312 Python (3.12) which has TensorFlow installed.
If this script is run with the wrong Python (e.g. system 3.14),
it will automatically re-launch itself with venv312's python.
"""

import os
import sys

# ── Auto re-launch with venv312 if TensorFlow is not importable ──────────────
def _venv_python():
    """Return path to venv312 python.exe (works regardless of cwd)."""
    # run.py lives in  <project>/backend/run.py
    # venv312 lives in <project>/venv312/
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(backend_dir)
    return os.path.join(project_dir, "venv312", "Scripts", "python.exe")

_venv_py = _venv_python()

# Only re-exec if: venv exists AND we are NOT already running from it
if (
    os.path.exists(_venv_py) and
    os.path.abspath(sys.executable).lower() != os.path.abspath(_venv_py).lower()
):
    print(f"[run.py] Switching to venv312 Python: {_venv_py}")
    os.execv(_venv_py, [_venv_py] + sys.argv)
    # os.execv replaces the current process — nothing below runs unless exec fails

# ── Normal startup ────────────────────────────────────────────────────────────
print(f"[run.py] Python: {sys.executable}")

from app import create_app, db

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)

    print("[run.py] Starting Flask on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)