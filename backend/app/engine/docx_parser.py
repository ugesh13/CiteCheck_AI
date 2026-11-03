"""
CiteCheck AI — DOCX Ingestion Engine.

Provides secure, structural extraction from Microsoft Word .docx documents:
- 4 MB serverless size guardrail (Vercel request body budget).
- Zip-bomb defense: max 1,000 files, max 20 MB uncompressed, max 10:1 compression ratio.
- Password/encryption detection before extraction.
- Preserves document hierarchy: headings (#, ##), bulleted/numbered lists, and markdown tables.
- Emits detailed block-level JSON with paragraph indices, runs, and formatting.
"""

from __future__ import annotations

import io
import logging
import traceback
import zipfile
from typing import Any, Dict, List, Optional

import docx
from fastapi import HTTPException, status

logger = logging.getLogger("citecheck.docx")

MAX_DOCX_BYTES = 4 * 1024 * 1024  # 4 MB
MAX_UNCOMPRESSED_BYTES = 20 * 1024 * 1024  # 20 MB
MAX_ZIP_ENTRIES = 1000
MAX_COMPRESSION_RATIO = 10.0


def validate_and_inspect_docx_archive(content: bytes) -> zipfile.ZipFile:
    """
    Validates zip integrity and enforces anti-zip-bomb and anti-encryption controls.
    """
    if len(content) > MAX_DOCX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 4 MB limit (exceeds the 5 MB limit). Please upload a smaller document.",
        )

    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Corrupted or invalid document archive. The file does not appear to be a valid Microsoft Word .docx document.",
        )

    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
        infolist = zf.infolist()

        if len(infolist) > MAX_ZIP_ENTRIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Suspicious archive: contains too many internal files (exceeds 1,000 file limit).",
            )

        total_uncompressed = sum(info.file_size for info in infolist)
        if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Suspicious archive: uncompressed size exceeds the 20 MB security limit.",
            )

        compressed_size = max(1, len(content))
        ratio = total_uncompressed / compressed_size
        if total_uncompressed > 1024 * 1024 and ratio > MAX_COMPRESSION_RATIO:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Suspicious archive: compression ratio too high (potential zip bomb detected).",
            )

        namelist = [info.filename for info in infolist]
        if any(e in name.lower() for e in ["encryption", "encryptedpackage", "encrypted"] for name in namelist):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password-protected or encrypted documents are not supported. Please remove the password and re-upload.",
            )

        if "word/document.xml" not in namelist:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid .docx structure: missing word/document.xml. Please ensure this is an uncorrupted Word document.",
            )

        return zf
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("ZIP security inspection failed: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read this DOCX file. Please ensure it is a valid, uncorrupted Word document.",
        )


def parse_docx_structure(content: bytes, filename: str = "document.docx") -> Dict[str, Any]:
    """
    Parses a DOCX document into rich structural elements:
    - paragraphs: style, heading_level, list_item flag, runs (bold, italic).
    - tables: raw row/cell grid and formatted table text.
    - headers/footers.
    - full_text: markdown-formatted text preserving headers and tables.
    - stats: word, character, paragraph, and table counts.
    """
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext == "doc":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Legacy .doc format is not supported. Please save or export the document as a modern .docx file and re-upload.",
        )
    if ext != "docx":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '.{ext}'. CiteCheck accepts Microsoft Word .docx files only.",
        )

    if not content or len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty (0 bytes). Please upload a valid .docx document.",
        )

    # Security check on archive
    _ = validate_and_inspect_docx_archive(content)

    try:
        doc = docx.Document(io.BytesIO(content))
    except Exception as exc:
        logger.error("python-docx parsing error: %s\n%s", exc, traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read this DOCX file. Please ensure it is a valid, uncorrupted Word document.",
        )

    blocks: List[Dict[str, Any]] = []
    paragraphs_data: List[Dict[str, Any]] = []
    tables_data: List[Dict[str, Any]] = []

    text_offset = 0
    heading_count = 0
    paragraph_count = 0
    list_item_count = 0

    # 1. Section Headers
    for s_idx, section in enumerate(doc.sections):
        if section.header:
            for p_idx, p in enumerate(section.header.paragraphs):
                txt = p.text.strip()
                if txt:
                    start = text_offset
                    end = start + len(txt)
                    blocks.append({
                        "id": f"hdr-{s_idx}-{p_idx}",
                        "type": "header",
                        "level": 0,
                        "text": txt,
                        "start": start,
                        "end": end,
                    })
                    text_offset = end + 2

    # 2. Body Paragraphs & Headings
    for p_idx, p in enumerate(doc.paragraphs):
        txt = p.text.strip()
        if not txt:
            continue

        style_name = (p.style.name or "").lower() if p.style else ""
        runs = []
        for r in p.runs:
            if r.text:
                runs.append({
                    "text": r.text,
                    "bold": bool(r.bold),
                    "italic": bool(r.italic),
                })

        heading_level = 0
        is_list = False

        if "heading" in style_name:
            heading_count += 1
            try:
                heading_level = int(style_name.replace("heading", "").strip())
            except ValueError:
                heading_level = 1

            start = text_offset
            end = start + len(txt)
            md_text = f"{'#' * heading_level} {txt}"
            blocks.append({
                "id": f"h-{p_idx}",
                "type": "heading",
                "level": heading_level,
                "text": txt,
                "md_text": md_text,
                "start": start,
                "end": end,
            })
            text_offset = end + 2
        elif "list" in style_name or txt.startswith("•") or txt.startswith("-") or (txt[:2].isdigit() and txt[2:4] in [". ", ") "]):
            list_item_count += 1
            is_list = True
            start = text_offset
            end = start + len(txt)
            clean_txt = txt if (txt.startswith("•") or txt.startswith("-")) else f"• {txt}"
            blocks.append({
                "id": f"li-{p_idx}",
                "type": "list_item",
                "level": 1,
                "text": txt,
                "md_text": clean_txt,
                "start": start,
                "end": end,
            })
            text_offset = end + 2
        else:
            paragraph_count += 1
            start = text_offset
            end = start + len(txt)
            blocks.append({
                "id": f"p-{p_idx}",
                "type": "paragraph",
                "level": 0,
                "text": txt,
                "md_text": txt,
                "start": start,
                "end": end,
            })
            text_offset = end + 2

        paragraphs_data.append({
            "index": p_idx,
            "style": style_name,
            "text": txt,
            "heading_level": heading_level,
            "is_list_item": is_list,
            "runs": runs,
        })

    # 3. Tables
    table_count = len(doc.tables)
    for t_idx, table in enumerate(doc.tables):
        table_rows: List[List[str]] = []
        md_table_lines = []
        for r_idx, row in enumerate(table.rows):
            cell_texts = [c.text.strip() for c in row.cells]
            table_rows.append(cell_texts)
            non_empty = [c for c in cell_texts if c]
            if non_empty:
                pipe_txt = " | ".join(non_empty)
                start = text_offset
                end = start + len(pipe_txt)
                blocks.append({
                    "id": f"t-{t_idx}-r{r_idx}",
                    "type": "table_row",
                    "level": 0,
                    "text": pipe_txt,
                    "start": start,
                    "end": end,
                })
                text_offset = end + 2
                md_table_lines.append(f"| {' | '.join(cell_texts)} |")
                if r_idx == 0:
                    md_table_lines.append(f"|{'---|' * len(cell_texts)}")

        tables_data.append({
            "index": t_idx,
            "rows": table_rows,
            "md": "\n".join(md_table_lines),
        })

    # 4. Section Footers
    for s_idx, section in enumerate(doc.sections):
        if section.footer:
            for p_idx, p in enumerate(section.footer.paragraphs):
                txt = p.text.strip()
                if txt:
                    start = text_offset
                    end = start + len(txt)
                    blocks.append({
                        "id": f"ftr-{s_idx}-{p_idx}",
                        "type": "footer",
                        "level": 0,
                        "text": txt,
                        "start": start,
                        "end": end,
                    })
                    text_offset = end + 2

    # Assemble full text
    full_text = "\n\n".join(b["text"] for b in blocks)
    if not full_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded .docx document contains no readable text, paragraphs, or table content.",
        )

    words = len(full_text.split())
    chars = len(full_text)

    stats = {
        "words": words,
        "chars": chars,
        "paragraphs": paragraph_count,
        "headings": heading_count,
        "lists": list_item_count,
        "tables": table_count,
    }

    return {
        "filename": filename,
        "size_bytes": len(content),
        "text": full_text,
        "char_count": chars,
        "word_count": words,
        "paragraph_count": paragraph_count,
        "heading_count": heading_count,
        "table_count": table_count,
        "page_estimate": max(1, round(words / 300)),
        "blocks": blocks,
        "paragraphs": paragraphs_data,
        "tables": tables_data,
        "stats": stats,
    }
