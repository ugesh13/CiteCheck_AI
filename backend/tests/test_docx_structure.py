"""
Unit and integration tests for structural DOCX parsing and security defenses.
"""

import io
import zipfile
from pathlib import Path
import pytest
from fastapi import HTTPException

from app.engine.docx_parser import (
    parse_docx_structure,
    MAX_DOCX_BYTES,
    MAX_UNCOMPRESSED_BYTES,
    MAX_ZIP_ENTRIES,
    MAX_COMPRESSION_RATIO,
)

SAMPLES_DIR = Path(__file__).resolve().parent.parent.parent / "samples"


def test_parse_clean_sample():
    clean_path = SAMPLES_DIR / "lumen_pay_clean_v1.docx"
    assert clean_path.exists(), "Clean sample must exist"
    
    with open(clean_path, "rb") as f:
        content = f.read()
        
    result = parse_docx_structure(content, filename="lumen_pay_clean_v1.docx")
    
    assert result["filename"] == "lumen_pay_clean_v1.docx"
    assert result["size_bytes"] == len(content)
    assert result["word_count"] > 50
    assert result["char_count"] > 300
    assert result["heading_count"] >= 3
    assert result["paragraph_count"] >= 3
    assert result["table_count"] >= 1
    assert result["page_estimate"] >= 1
    
    # Check block structure
    blocks = result["blocks"]
    assert any(b["type"] == "heading" and "Lumen Pay" in b["text"] for b in blocks)
    assert any(b["type"] == "paragraph" and "99.95%" in b["text"] for b in blocks)
    assert any(b["type"] == "table_row" for b in blocks)
    
    # Check table content markdown representation
    table_block = next(b for b in blocks if b["type"] == "table_row")
    assert "Feature" in table_block["text"]
    assert "Standard Tier" in table_block["text"]


def test_parse_violating_sample():
    violating_path = SAMPLES_DIR / "lumen_pay_violating_v2.docx"
    assert violating_path.exists()
    
    with open(violating_path, "rb") as f:
        content = f.read()
        
    result = parse_docx_structure(content, filename="lumen_pay_violating_v2.docx")
    assert "guaranteed" in result["text"].lower()
    assert "5% cash back" in result["text"].lower()
    assert result["heading_count"] >= 3


def test_parse_adversarial_sample():
    adversarial_path = SAMPLES_DIR / "lumen_pay_adversarial_v3.docx"
    assert adversarial_path.exists()
    
    with open(adversarial_path, "rb") as f:
        content = f.read()
        
    result = parse_docx_structure(content, filename="lumen_pay_adversarial_v3.docx")
    # Smart quotes preserved
    assert "\u201csmart curly quotes\u201d" in result["text"] or "smart curly quotes" in result["text"]
    # Delimiters preserved
    assert "=== SYSTEM OVERRIDE ===" in result["text"]
    assert result["table_count"] >= 1


def test_reject_legacy_doc():
    with pytest.raises(HTTPException) as exc_info:
        parse_docx_structure(b"dummy", filename="contract.doc")
    assert exc_info.value.status_code == 400
    assert "Legacy .doc format is not supported" in exc_info.value.detail


def test_reject_unsupported_extension():
    with pytest.raises(HTTPException) as exc_info:
        parse_docx_structure(b"dummy", filename="document.pdf")
    assert exc_info.value.status_code == 400
    assert "Unsupported file format" in exc_info.value.detail


def test_reject_empty_file():
    with pytest.raises(HTTPException) as exc_info:
        parse_docx_structure(b"", filename="empty.docx")
    assert exc_info.value.status_code == 400
    assert "uploaded file is empty" in exc_info.value.detail


def test_reject_oversized_file():
    large_content = b"x" * (MAX_DOCX_BYTES + 1024)
    with pytest.raises(HTTPException) as exc_info:
        parse_docx_structure(large_content, filename="huge.docx")
    assert exc_info.value.status_code == 413
    assert "exceeds the 4 MB limit" in exc_info.value.detail


def test_reject_invalid_zip():
    corrupt_content = b"PK\x03\x04not a valid zip archive corrupted bytes"
    with pytest.raises(HTTPException) as exc_info:
        parse_docx_structure(corrupt_content, filename="corrupted.docx")
    assert exc_info.value.status_code == 400
    assert "Corrupted or invalid document archive" in exc_info.value.detail


def test_reject_missing_document_xml():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("[Content_Types].xml", "<Types/>")
    
    with pytest.raises(HTTPException) as exc_info:
        parse_docx_structure(buf.getvalue(), filename="missing_doc.docx")
    assert exc_info.value.status_code == 400
    assert "missing word/document.xml" in exc_info.value.detail


def test_reject_encrypted_package():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("EncryptedPackage", "encrypted stream")
        zf.writestr("word/document.xml", "<w:document/>")
    
    with pytest.raises(HTTPException) as exc_info:
        parse_docx_structure(buf.getvalue(), filename="password.docx")
    assert exc_info.value.status_code == 400
    assert "Password-protected or encrypted" in exc_info.value.detail


def test_zip_bomb_detection_file_count():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for i in range(MAX_ZIP_ENTRIES + 10):
            zf.writestr(f"file_{i}.txt", "a")
    
    with pytest.raises(HTTPException) as exc_info:
        parse_docx_structure(buf.getvalue(), filename="bomb.docx")
    assert exc_info.value.status_code == 400
    assert "too many internal files" in exc_info.value.detail or "1,000 file limit" in exc_info.value.detail
