from __future__ import annotations

import os
from contextlib import asynccontextmanager

import requests
import uvicorn
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel


class RenderHtmlRequest(BaseModel):
    html: str
    header_html: str | None = None
    footer_html: str | None = None
    filename: str | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    print("[pdf-worker] api activa", flush=True)
    print(f"[pdf-worker] gotenberg_url={os.getenv('GOTENBERG_URL', '')}", flush=True)
    yield
    print("[pdf-worker] api detenida", flush=True)


app = FastAPI(title="pdf-worker", docs_url=None, redoc_url=None, lifespan=lifespan)


def _validate_internal_secret(header_value: str | None) -> None:
    expected_secret = os.getenv("INTERNAL_API_SECRET", "").strip()
    if not expected_secret:
        return
    if (header_value or "").strip() != expected_secret:
        raise HTTPException(status_code=403, detail="Credencial interna invalida.")


def _render_pdf(html: str, header_html: str | None = None, footer_html: str | None = None, filename: str | None = None) -> bytes:
    gotenberg_url = os.getenv("GOTENBERG_URL", "http://gotenberg:3000").rstrip("/")
    if not html.strip():
        raise HTTPException(status_code=422, detail="El HTML para renderizar esta vacio.")

    files = [
        # Gotenberg Chromium expects the main document to be uploaded specifically as index.html.
        ("files", ("index.html", html.encode("utf-8"), "text/html; charset=utf-8")),
    ]
    if (header_html or "").strip():
        files.append(("files", ("header.html", header_html.encode("utf-8"), "text/html; charset=utf-8")))
    if (footer_html or "").strip():
        files.append(("files", ("footer.html", footer_html.encode("utf-8"), "text/html; charset=utf-8")))

    try:
        data = {
            "printBackground": "true",
            "preferCssPageSize": "true",
        }
        if (header_html or "").strip() or (footer_html or "").strip():
            data["displayHeaderFooter"] = "true"

        response = requests.post(
            f"{gotenberg_url}/forms/chromium/convert/html",
            files=files,
            data=data,
            timeout=90,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"No fue posible conectar con gotenberg: {exc}") from exc

    if response.status_code >= 400:
        error_detail = response.text.strip()
        if error_detail:
            error_detail = error_detail[:300]
            raise HTTPException(
                status_code=502,
                detail=f"Gotenberg respondio con error {response.status_code}: {error_detail}",
            )
        raise HTTPException(status_code=502, detail=f"Gotenberg respondio con error {response.status_code}.")
    if not response.content:
        raise HTTPException(status_code=502, detail="Gotenberg no devolvio contenido PDF.")
    return response.content


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/render/html-to-pdf")
def render_html_to_pdf(
    payload: RenderHtmlRequest,
    x_internal_secret: str | None = Header(default=None),
) -> Response:
    _validate_internal_secret(x_internal_secret)
    pdf_bytes = _render_pdf(payload.html, payload.header_html, payload.footer_html, payload.filename)
    return Response(content=pdf_bytes, media_type="application/pdf")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("APP_PORT", "8000")),
        reload=False,
    )
