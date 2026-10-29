# pyright: reportMissingImports=false
import os
import sys

# Ensure backend directory is discoverable by python
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from app.main import app
except ImportError:
    from backend.app.main import app
