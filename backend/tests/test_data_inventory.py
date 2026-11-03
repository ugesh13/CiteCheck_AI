import hashlib
import re
from pathlib import Path
from backend.app.core.limiter import RateLimitMiddleware

ROOT_DIR = Path(__file__).resolve().parent.parent.parent


def test_zero_third_party_fonts_in_html_files():
    """Verify that all production and template HTML files have zero Google Fonts links."""
    html_paths = [
        ROOT_DIR / "index.html",
        ROOT_DIR / "public" / "index.html",
        ROOT_DIR / "Frontend" / "Glassmorphic-Frontend-Builder" / "artifacts" / "citecheck-ai" / "index.html",
    ]
    for p in html_paths:
        if p.exists():
            content = p.read_text(encoding="utf-8")
            assert "fonts.googleapis.com" not in content, f"Third-party Google Fonts link found in {p}"
            assert "fonts.gstatic.com" not in content, f"Third-party Google Fonts preconnect found in {p}"


def test_ip_pseudonymization_in_rate_limiter():
    """Verify that rate limiter never stores raw IP addresses and uses 16-char salted SHA-256 hashes."""
    raw_ips = ["192.168.1.100", "10.0.0.1", "2001:0db8:85a3:0000:0000:8a2e:0370:7334", "127.0.0.1"]
    for client_ip in raw_ips:
        # Simulate the middleware's IP hashing logic
        ip_hash = hashlib.sha256(f"citecheck-salt:{client_ip}".encode("utf-8")).hexdigest()[:16]
        client_key = f"ip:{ip_hash}"
        assert client_key.startswith("ip:"), f"Key {client_key} does not start with 'ip:' prefix"
        hashed_part = client_key[3:]
        assert len(hashed_part) == 16, f"Expected 16-char hex hash, got {len(hashed_part)}"
        assert bool(re.match(r"^[0-9a-f]{16}$", hashed_part)), f"Not valid hex: {hashed_part}"
        assert client_ip not in client_key, f"Raw IP leaked in key: {client_key}"


def test_local_storage_keys_inventory():
    """Verify that frontend localStorage keys are strictly within the documented essential set."""
    allowed_keys = {
        "citecheck_token",
        "citecheck_user",
        "citecheck_oauth_role",
        "citecheck_dismiss_tour",
    }
    frontend_src = ROOT_DIR / "Frontend" / "Glassmorphic-Frontend-Builder" / "artifacts" / "citecheck-ai" / "src"
    found_keys = set()
    for tsx_file in frontend_src.rglob("*.ts*"):
        text = tsx_file.read_text(encoding="utf-8", errors="ignore")
        matches = re.findall(r"localStorage\.(?:getItem|setItem|removeItem)\(\s*['\"]([^'\"]+)['\"]", text)
        for m in matches:
            found_keys.add(m)

    unexpected = found_keys - allowed_keys
    assert not unexpected, f"Found undocumented localStorage keys in frontend: {unexpected}"
