import smtplib
from email.message import EmailMessage
from typing import Any

import requests
from fastapi import APIRouter, Cookie, HTTPException

from api.deps import build_itop_api_url, ensure_session, ensure_settings_access, model_to_dict, raise_auth_error
from modules.auth.service import AuthenticationError
from modules.settings.service import (
    create_settings_profile,
    create_settings_sync_task,
    list_settings_payload,
    list_settings_profiles,
    remove_settings_sync_task,
    update_settings_panel,
    update_settings_profile,
    update_settings_sync_task,
)
from integrations.pdq_sqlite import build_pdq_test_config, get_pdq_status
from schemas.settings import (
    ItopTestRequest,
    MailTestRequest,
    PdqTestRequest,
    ProfileRequest,
    SettingsPanelUpdateRequest,
    SyncTaskRequest,
)


router = APIRouter(prefix="/v1/settings", tags=["settings"])


@router.get("")
def settings_list(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id)
        return list_settings_payload()
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load settings: {exc}") from exc


@router.put("/{panel_code}")
def settings_update_panel(
    panel_code: str,
    payload: SettingsPanelUpdateRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id, write=True)
        item = update_settings_panel(panel_code, payload.config)
        return {"panel": panel_code, "config": item}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update settings panel: {exc}") from exc


@router.post("/sync/tasks")
def settings_create_sync_task(
    payload: SyncTaskRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id, write=True)
        return {"item": create_settings_sync_task(model_to_dict(payload))}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to create sync task: {exc}") from exc


@router.put("/sync/tasks/{task_id}")
def settings_update_sync_task(
    task_id: int,
    payload: SyncTaskRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id, write=True)
        return {"item": update_settings_sync_task(task_id, model_to_dict(payload))}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update sync task: {exc}") from exc


@router.delete("/sync/tasks/{task_id}")
def settings_delete_sync_task(
    task_id: int,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, bool]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id, write=True)
        remove_settings_sync_task(task_id)
        return {"ok": True}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to delete sync task: {exc}") from exc


@router.post("/mail/test")
def settings_test_mail(
    payload: MailTestRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        session_user = ensure_settings_access(session_id, write=True)
        config = payload.config or {}
        smtp_host = str(config.get("smtpHost") or "").strip()
        smtp_port = int(str(config.get("smtpPort") or "0").strip() or "0")
        sender_name = str(config.get("senderName") or "iTop Hub").strip()
        sender_email = str(config.get("senderEmail") or "").strip()
        smtp_security = str(config.get("smtpSecurity") or "none").strip().lower()
        mail_format = str(config.get("mailFormat") or "html").strip().lower()
        footer_note = str(config.get("footerNote") or "").strip()

        if not smtp_host:
            raise HTTPException(status_code=422, detail="El servidor SMTP es obligatorio.")
        if smtp_port <= 0:
            raise HTTPException(status_code=422, detail="El puerto SMTP es obligatorio.")
        if not sender_email:
            raise HTTPException(status_code=422, detail="El correo remitente es obligatorio.")
        if mail_format not in {"html", "txt"}:
            raise HTTPException(status_code=422, detail="El formato de correo no es valido.")

        message = EmailMessage()
        message["Subject"] = "Prueba SMTP iTop Hub"
        message["From"] = f"{sender_name} <{sender_email}>"
        message["To"] = sender_email
        text_body = (
            "Prueba de correo enviada desde iTop Hub.\n\n"
            f"Usuario: {session_user.get('username')}\n"
            f"Servidor: {smtp_host}:{smtp_port}\n"
            f"Seguridad: {smtp_security}\n"
            f"Formato: {'HTML' if mail_format == 'html' else 'Texto plano'}\n"
        )
        if footer_note:
            text_body = f"{text_body}\n{footer_note}\n"

        if mail_format == "html":
            message.set_content(text_body)
            html_parts = [
                "<html><body style=\"font-family:Arial,sans-serif;font-size:14px;color:#1f2933;\">",
                "<h2>Prueba de correo enviada desde iTop Hub</h2>",
                f"<p><strong>Usuario:</strong> {session_user.get('username')}</p>",
                f"<p><strong>Servidor:</strong> {smtp_host}:{smtp_port}</p>",
                f"<p><strong>Seguridad:</strong> {smtp_security}</p>",
                "<p><strong>Formato:</strong> HTML</p>",
            ]
            if footer_note:
                html_parts.append(f"<p>{footer_note}</p>")
            html_parts.append("</body></html>")
            message.add_alternative("".join(html_parts), subtype="html")
        else:
            message.set_content(text_body)

        if smtp_security == "ssl_tls":
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                if smtp_security == "starttls":
                    server.starttls()
                server.send_message(message)

        return {
            "ok": True,
            "message": f"Correo de prueba enviado a {sender_email}.",
        }
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible enviar el correo de prueba: {exc}") from exc


@router.post("/itop/test")
def settings_test_itop(
    payload: ItopTestRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id)
        config = payload.config or {}
        integration_url = str(config.get("integrationUrl") or "").strip()
        verify_ssl = str(config.get("verifySsl")).strip().lower() not in {"false", "0", "no", "off"} if "verifySsl" in config else True
        timeout_seconds = int(str(config.get("timeoutSeconds") or "30").strip() or "30")
        api_url = build_itop_api_url(integration_url)

        if not integration_url:
            raise HTTPException(status_code=422, detail="La URL de iTop es obligatoria.")
        if timeout_seconds <= 0:
            raise HTTPException(status_code=422, detail="El timeout debe ser mayor que cero.")

        response = requests.post(
            api_url,
            params={"version": "1.3"},
            data={"json_data": "{}"},
            verify=verify_ssl,
            timeout=timeout_seconds,
            allow_redirects=True,
        )

        if response.status_code == 404:
            raise HTTPException(
                status_code=422,
                detail=f"La ruta API no fue encontrada en {api_url}. Revisa la URL base de iTop.",
            )
        if response.status_code >= 500:
            raise HTTPException(
                status_code=502,
                detail=f"iTop respondio con error {response.status_code} al intentar acceder a {api_url}.",
            )

        return {
            "ok": True,
            "message": (
                f"Conexion validada correctamente con iTop. "
                f"URL base detectada: {integration_url}. "
                f"Respuesta HTTP {response.status_code} con verificacion SSL "
                f"{'habilitada' if verify_ssl else 'deshabilitada'}."
            ),
            "apiUrl": api_url,
            "statusCode": response.status_code,
            "verifySsl": verify_ssl,
        }
    except requests.exceptions.SSLError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Fallo de SSL al conectar con iTop: {exc}",
        ) from exc
    except requests.exceptions.Timeout as exc:
        raise HTTPException(
            status_code=504,
            detail=f"iTop no respondio dentro de {timeout_seconds} segundos.",
        ) from exc
    except requests.exceptions.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"No fue posible conectar con iTop: {exc}",
        ) from exc
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible validar la conexion con iTop: {exc}") from exc


@router.post("/pdq/test")
def settings_test_pdq(
    payload: PdqTestRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id)
        config = payload.config or {}
        pdq_config = build_pdq_test_config(config)
        status = get_pdq_status(pdq_config)

        if not status.get("directory_exists"):
            raise HTTPException(
                status_code=422,
                detail=f"La carpeta configurada no existe o no es accesible: {status.get('sqlite_dir')}.",
            )

        if not status.get("database_available"):
            configured_file_path = str(status.get("configured_file_path") or "").strip()
            detail = (
                f"No se encontro la base de datos PDQ en la ruta configurada: {configured_file_path}."
                if configured_file_path
                else f"No se encontro una base de datos PDQ valida en la carpeta configurada: {status.get('sqlite_dir')}."
            )
            raise HTTPException(status_code=422, detail=detail)

        selected_file = status.get("selected_file") or {}
        return {
            "ok": True,
            "message": f"Base PDQ disponible en {selected_file.get('path')}.",
            "status": status,
        }
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No fue posible validar la base PDQ: {exc}") from exc


@router.get("/profiles")
def settings_profiles_list(hub_session_id: str | None = Cookie(default=None)) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id)
        return {"items": list_settings_profiles()}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load profiles: {exc}") from exc


@router.post("/profiles")
def settings_profiles_create(
    payload: ProfileRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id, write=True)
        return {"item": create_settings_profile(model_to_dict(payload))}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to create profile: {exc}") from exc


@router.put("/profiles/{role_code}")
def settings_profiles_update(
    role_code: str,
    payload: ProfileRequest,
    hub_session_id: str | None = Cookie(default=None),
) -> dict[str, Any]:
    session_id = ensure_session(hub_session_id)
    try:
        ensure_settings_access(session_id, write=True)
        return {"item": update_settings_profile(role_code, model_to_dict(payload))}
    except AuthenticationError as exc:
        raise_auth_error(exc)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to update profile: {exc}") from exc
