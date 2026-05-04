from __future__ import annotations

import json
from typing import Any

from infrastructure.db import get_db_connection

_HANDOVER_TYPE_LABEL = {
    "initial_assignment": "Entrega",
    "return": "Devolucion",
    "laboratory": "Laboratorio",
    "reassignment": "Reasignacion",
    "replacement": "Reposicion",
    "normalization": "Normalizacion",
}

_STATUS_LABEL = {
    "draft": "Borrador",
    "issued": "Emitida",
    "signed": "Firmada",
    "confirmed": "Confirmada",
    "cancelled": "Cancelada",
    "in_lab": "En laboratorio",
    "pending_signature": "Pendiente de firma",
    "completed": "Completada",
    "derived_obsolete": "Derivada a obsoleto",
}

_LAB_REASON_LABEL = {
    "maintenance": "Mantenimiento",
    "cleaning": "Limpieza",
    "reinstallation": "Reinstalacion",
    "backup": "Respaldo",
    "diagnosis": "Diagnostico",
    "software_update": "Actualizacion de software",
    "verification": "Verificacion funcional",
    "hardware_repair": "Reparacion de hardware",
}

_LAB_OPEN_STATUSES = ("draft", "in_lab", "pending_signature", "signed")
_LAB_INCOMPLETE_STATUSES = ("draft", "in_lab", "pending_signature", "signed")


def _pagination_clause(pagination: dict) -> tuple[str, list]:
    page_size_raw = int(pagination.get("page_size", 50))
    if page_size_raw <= 0:
        return "", []
    page = max(1, int(pagination.get("page", 1)))
    page_size = min(5000, page_size_raw)
    offset = (page - 1) * page_size
    return "LIMIT %s OFFSET %s", [page_size, offset]


def _paginate_rows(rows: list[dict[str, Any]], pagination: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    total = len(rows)
    page_size_raw = int(pagination.get("page_size", 50))
    if page_size_raw <= 0:
        return rows, total
    page = max(1, int(pagination.get("page", 1)))
    page_size = min(5000, page_size_raw)
    offset = (page - 1) * page_size
    return rows[offset: offset + page_size], total


def _coerce_date_text(value: Any) -> str:
    return str(value)[:10] if value else "-"


def _coerce_text(value: Any, default: str = "-") -> str:
    text = str(value or "").strip()
    return text or default


def _normalize_status_label(status: Any) -> str:
    raw = str(status or "").strip()
    return _STATUS_LABEL.get(raw, raw or "-")


def _normalize_lab_reason(reason: Any) -> str:
    raw = str(reason or "").strip()
    return _LAB_REASON_LABEL.get(raw, raw or "-")


def _sort_rows_desc(rows: list[dict[str, Any]], date_field: str, tie_field: str) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            str(row.get(date_field) or ""),
            str(row.get(tie_field) or ""),
        ),
        reverse=True,
    )


def _collect_related_users(
    handover_type: str,
    receiver_name: str | None,
    additional_receivers_json: str | None,
) -> str:
    primary = (receiver_name or "").strip() or None
    add_recv: list[dict] = []
    if additional_receivers_json:
        try:
            parsed = json.loads(additional_receivers_json)
            if isinstance(parsed, list):
                add_recv = parsed
        except (json.JSONDecodeError, TypeError):
            pass

    if handover_type == "reassignment":
        origin = (add_recv[0].get("name") or "").strip() if add_recv else None
        if origin and primary:
            return f"{origin} → {primary}"
        return primary or origin or "-"

    names: list[str] = [primary] if primary else []
    for person in add_recv:
        name = (person.get("name") or "").strip()
        if name and name not in names:
            names.append(name)
    return ", ".join(names) if names else "-"


def _resolve_lab_phase(row: dict[str, Any]) -> str:
    if row.get("exit_date") or row.get("exit_observations") or row.get("work_performed"):
        return "Salida"
    if row.get("processing_date") or row.get("processing_observations"):
        return "Procesamiento"
    return "Entrada"


def _resolve_lab_asset_label(row: dict[str, Any]) -> str:
    asset_code = _coerce_text(row.get("asset_code"), "")
    asset_name = _coerce_text(row.get("asset_name"), "")
    if asset_code and asset_name and asset_name.lower() != asset_code.lower():
        return f"{asset_code} - {asset_name}"
    return asset_code or asset_name or "-"


def _resolve_lab_related_person(row: dict[str, Any]) -> str:
    return _coerce_text(row.get("asset_assigned_user"))


def _resolve_lab_event_origin(row: dict[str, Any]) -> str:
    assigned_user = _coerce_text(row.get("asset_assigned_user"), "")
    if assigned_user:
        return assigned_user
    return _coerce_text(row.get("asset_location"), "Operacion")


def _fetch_all(sql: str, params: list[Any]) -> list[dict[str, Any]]:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall() or []


def _fetch_handover_document_rows(
    filters: dict[str, Any],
    *,
    status_in: tuple[str, ...] | None = None,
    status_not_in: tuple[str, ...] | None = None,
) -> list[dict[str, Any]]:
    handover_type = filters.get("handover_type")
    if handover_type == "laboratory":
        return []

    conditions: list[str] = ["LOWER(d.receiver_status) = 'active'"]
    params: list[Any] = []

    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    owner_name = filters.get("owner_name")

    if from_date:
        conditions.append("DATE(d.generated_at) >= %s")
        params.append(from_date)
    if to_date:
        conditions.append("DATE(d.generated_at) <= %s")
        params.append(to_date)
    if handover_type:
        conditions.append("d.handover_type = %s")
        params.append(handover_type)
    if owner_name:
        conditions.append("LOWER(d.owner_name) LIKE %s")
        params.append(f"%{str(owner_name).lower()}%")
    if status_in:
        conditions.append(f"d.status IN ({', '.join(['%s'] * len(status_in))})")
        params.extend(status_in)
    if status_not_in:
        conditions.append(f"d.status NOT IN ({', '.join(['%s'] * len(status_not_in))})")
        params.extend(status_not_in)

    where = f"WHERE {' AND '.join(conditions)}"
    sql = f"""
        SELECT
            d.id,
            d.document_number,
            d.handover_type,
            d.generated_at,
            d.owner_name,
            d.receiver_name,
            d.additional_receivers,
            d.status,
            d.reason,
            COALESCE(GROUP_CONCAT(i.asset_code ORDER BY i.sort_order SEPARATOR ', '), '-') AS activos_list
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at DESC, d.id DESC
    """
    return _fetch_all(sql, params)


def _fetch_handover_movement_rows(filters: dict[str, Any]) -> list[dict[str, Any]]:
    handover_type = filters.get("handover_type")
    if handover_type == "laboratory":
        return []

    conditions: list[str] = ["d.status != 'draft'", "LOWER(d.receiver_status) = 'active'"]
    params: list[Any] = []

    asset_code = filters.get("asset_code")
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")

    if asset_code:
        conditions.append("LOWER(i.asset_code) LIKE %s")
        params.append(f"%{str(asset_code).lower()}%")
    if from_date:
        conditions.append("DATE(d.generated_at) >= %s")
        params.append(from_date)
    if to_date:
        conditions.append("DATE(d.generated_at) <= %s")
        params.append(to_date)
    if handover_type:
        conditions.append("d.handover_type = %s")
        params.append(handover_type)

    where = f"WHERE {' AND '.join(conditions)}"
    sql = f"""
        SELECT
            d.generated_at,
            i.asset_code,
            d.handover_type,
            d.receiver_name,
            d.additional_receivers,
            d.owner_name,
            i.asset_status,
            d.document_number,
            COALESCE(i.notes, '') AS observacion_activo
        FROM hub_handover_documents d
        JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        ORDER BY d.generated_at DESC, d.id DESC, i.sort_order ASC
    """
    return _fetch_all(sql, params)


def _fetch_lab_rows(
    filters: dict[str, Any],
    *,
    status_in: tuple[str, ...] | None = None,
    marked_obsolete_only: bool = False,
) -> list[dict[str, Any]]:
    handover_type = filters.get("handover_type")
    if handover_type and handover_type != "laboratory":
        return []

    conditions: list[str] = []
    params: list[Any] = []

    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    owner_name = filters.get("owner_name")
    asset_code = filters.get("asset_code")
    status = filters.get("status")
    reason = filters.get("reason")

    if from_date:
        conditions.append("DATE(COALESCE(r.entry_date, DATE(r.created_at))) >= %s")
        params.append(from_date)
    if to_date:
        conditions.append("DATE(COALESCE(r.entry_date, DATE(r.created_at))) <= %s")
        params.append(to_date)
    if owner_name:
        conditions.append("LOWER(COALESCE(r.owner_name, '')) LIKE %s")
        params.append(f"%{str(owner_name).lower()}%")
    if asset_code:
        conditions.append("LOWER(COALESCE(r.asset_code, '')) LIKE %s")
        params.append(f"%{str(asset_code).lower()}%")
    if reason:
        conditions.append("r.reason = %s")
        params.append(reason)
    if status:
        conditions.append("r.status = %s")
        params.append(status)
    elif status_in:
        conditions.append(f"r.status IN ({', '.join(['%s'] * len(status_in))})")
        params.extend(status_in)
    if marked_obsolete_only:
        conditions.append("(r.marked_obsolete = 1 OR r.status = 'derived_obsolete')")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    sql = f"""
        SELECT
            r.id,
            r.document_number,
            r.reason,
            r.status,
            r.asset_code,
            r.asset_name,
            r.asset_status,
            r.asset_location,
            r.asset_assigned_user,
            r.owner_name,
            r.entry_date,
            r.entry_observations,
            r.processing_date,
            r.processing_observations,
            r.exit_date,
            r.exit_observations,
            r.work_performed,
            r.marked_obsolete,
            r.normalization_act_code,
            r.created_at
        FROM hub_lab_records r
        {where}
        ORDER BY COALESCE(r.entry_date, DATE(r.created_at)) DESC, r.id DESC
    """
    return _fetch_all(sql, params)


def handover_documents_by_period(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    rows: list[dict[str, Any]] = []

    for record in _fetch_handover_document_rows(filters):
        rows.append({
            "tipo": _HANDOVER_TYPE_LABEL.get(record["handover_type"], record["handover_type"]),
            "numero": record["document_number"],
            "fecha": _coerce_date_text(record["generated_at"]),
            "responsable": _coerce_text(record["owner_name"]),
            "activos": _coerce_text(record["activos_list"]),
            "usuario_relacionado": _collect_related_users(
                record["handover_type"],
                record.get("receiver_name"),
                record.get("additional_receivers"),
            ),
            "estado": _normalize_status_label(record["status"]),
        })

    for record in _fetch_lab_rows(filters):
        rows.append({
            "tipo": "Laboratorio",
            "numero": record["document_number"],
            "fecha": _coerce_date_text(record["entry_date"] or record["created_at"]),
            "responsable": _coerce_text(record["owner_name"]),
            "activos": _resolve_lab_asset_label(record),
            "usuario_relacionado": _resolve_lab_related_person(record),
            "estado": _normalize_status_label(record["status"]),
        })

    paged_rows, total = _paginate_rows(_sort_rows_desc(rows, "fecha", "numero"), pagination)
    return paged_rows, total


def pending_delivery_confirmations(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = [
        "d.handover_type = 'initial_assignment'",
        "d.status IN ('issued', 'signed')",
        "LOWER(d.receiver_status) = 'active'",
    ]
    params: list[Any] = []

    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    owner_name = filters.get("owner_name")

    if from_date:
        conditions.append("DATE(d.generated_at) >= %s")
        params.append(from_date)
    if to_date:
        conditions.append("DATE(d.generated_at) <= %s")
        params.append(to_date)
    if owner_name:
        conditions.append("LOWER(d.owner_name) LIKE %s")
        params.append(f"%{str(owner_name).lower()}%")

    where = f"WHERE {' AND '.join(conditions)}"
    count_sql = f"SELECT COUNT(*) AS total FROM hub_handover_documents d {where}"
    data_sql = f"""
        SELECT
            d.document_number,
            d.generated_at,
            COALESCE(GROUP_CONCAT(i.asset_code ORDER BY i.sort_order SEPARATOR ', '), '-') AS activos_list,
            d.receiver_name,
            d.additional_receivers,
            d.owner_name,
            d.status
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at ASC, d.id ASC
    """
    limit_clause, limit_params = _pagination_clause(pagination)
    if limit_clause:
        data_sql += f" {limit_clause}"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(count_sql, params)
            total = (cur.fetchone() or {}).get("total", 0)
            cur.execute(data_sql, params + limit_params)
            rows_raw = cur.fetchall()

    rows = [
        {
            "acta": r["document_number"],
            "fecha": _coerce_date_text(r["generated_at"]),
            "activos": _coerce_text(r["activos_list"]),
            "persona": _collect_related_users(
                "initial_assignment",
                r.get("receiver_name"),
                r.get("additional_receivers"),
            ),
            "responsable": _coerce_text(r["owner_name"]),
            "estado": _normalize_status_label(r["status"]),
        }
        for r in rows_raw
    ]
    return rows, int(total)


def asset_movement_history(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    rows: list[dict[str, Any]] = []

    for record in _fetch_handover_movement_rows(filters):
        ht = record["handover_type"]
        add_recv_json = record.get("additional_receivers")
        add_recv: list[dict] = []
        if add_recv_json:
            try:
                parsed = json.loads(add_recv_json)
                if isinstance(parsed, list):
                    add_recv = parsed
            except (json.JSONDecodeError, TypeError):
                pass

        if ht == "initial_assignment":
            origen = "Stock TI"
            destino = record["receiver_name"] or "-"
        elif ht == "return":
            origen = record["receiver_name"] or "-"
            destino = "Stock TI"
        elif ht == "reassignment":
            origin_person = (add_recv[0].get("name") or "").strip() if add_recv else record["owner_name"]
            origen = origin_person or "-"
            destino = record["receiver_name"] or "-"
        else:
            origen = record["owner_name"] or "-"
            destino = record["receiver_name"] or "-"

        rows.append({
            "fecha": _coerce_date_text(record["generated_at"]),
            "activo": _coerce_text(record["asset_code"]),
            "tipo_movimiento": _HANDOVER_TYPE_LABEL.get(ht, ht),
            "origen": origen,
            "destino": destino,
            "estado_activo": _coerce_text(record["asset_status"]),
            "numero_acta": _coerce_text(record["document_number"]),
            "observacion_activo": _coerce_text(record.get("observacion_activo")),
        })

    if not filters.get("handover_type") or filters.get("handover_type") == "laboratory":
        for record in _fetch_lab_rows(filters):
            rows.append({
                "fecha": _coerce_date_text(record["entry_date"] or record["created_at"]),
                "activo": _resolve_lab_asset_label(record),
                "tipo_movimiento": "Ingreso a laboratorio",
                "origen": _resolve_lab_event_origin(record),
                "destino": "Laboratorio",
                "estado_activo": _coerce_text(record["asset_status"]),
                "numero_acta": _coerce_text(record["document_number"]),
                "observacion_activo": _coerce_text(
                    record.get("entry_observations")
                    or record.get("processing_observations")
                    or record.get("exit_observations")
                    or record.get("work_performed")
                ),
            })

    paged_rows, total = _paginate_rows(_sort_rows_desc(rows, "fecha", "numero_acta"), pagination)
    return paged_rows, total


def lab_equipment_current(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    rows_raw = _fetch_lab_rows(filters, status_in=_LAB_OPEN_STATUSES)
    rows = [
        {
            "numero_acta": record["document_number"],
            "activos": _resolve_lab_asset_label(record),
            "motivo": _normalize_lab_reason(record["reason"]),
            "fase_actual": _resolve_lab_phase(record),
            "estado": _normalize_status_label(record["status"]),
            "responsable": _coerce_text(record["owner_name"]),
            "receptor": _resolve_lab_related_person(record),
            "fecha_ingreso": _coerce_date_text(record["entry_date"] or record["created_at"]),
        }
        for record in rows_raw
    ]
    paged_rows, total = _paginate_rows(_sort_rows_desc(rows, "fecha_ingreso", "numero_acta"), pagination)
    return paged_rows, total


def incomplete_handover_documents(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    rows: list[dict[str, Any]] = []

    for record in _fetch_handover_document_rows(filters, status_in=("draft", "issued", "signed")):
        rows.append({
            "documento": record["document_number"],
            "tipo": _HANDOVER_TYPE_LABEL.get(record["handover_type"], record["handover_type"]),
            "fecha": _coerce_date_text(record["generated_at"]),
            "activos": _coerce_text(record["activos_list"]),
            "responsable": _coerce_text(record["owner_name"]),
            "persona": _collect_related_users(
                record["handover_type"],
                record.get("receiver_name"),
                record.get("additional_receivers"),
            ),
            "faltante": "Pendiente de confirmacion" if record["status"] in {"issued", "signed"} else "Borrador sin emitir",
            "estado": _normalize_status_label(record["status"]),
        })

    for record in _fetch_lab_rows(filters, status_in=_LAB_INCOMPLETE_STATUSES):
        if record["status"] in {"pending_signature", "signed"}:
            faltante = "Pendiente de cierre final"
        elif record["status"] == "in_lab":
            faltante = "Pendiente de cierre tecnico"
        else:
            faltante = "Borrador sin emitir"

        rows.append({
            "documento": record["document_number"],
            "tipo": "Laboratorio",
            "fecha": _coerce_date_text(record["entry_date"] or record["created_at"]),
            "activos": _resolve_lab_asset_label(record),
            "responsable": _coerce_text(record["owner_name"]),
            "persona": _resolve_lab_related_person(record),
            "faltante": faltante,
            "estado": _normalize_status_label(record["status"]),
        })

    paged_rows, total = _paginate_rows(_sort_rows_desc(rows, "fecha", "documento"), pagination)
    return paged_rows, total


def lab_records_by_period(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    phase_filter = str(filters.get("phase") or "").strip().lower()
    rows_raw = _fetch_lab_rows(filters)
    rows: list[dict[str, Any]] = []

    for record in rows_raw:
        phase = _resolve_lab_phase(record)
        phase_key = phase.lower()
        if phase_filter and phase_key != phase_filter:
            continue
        rows.append({
            "numero_acta": record["document_number"],
            "fecha_ingreso": _coerce_date_text(record["entry_date"] or record["created_at"]),
            "activo": _resolve_lab_asset_label(record),
            "motivo": _normalize_lab_reason(record["reason"]),
            "fase_actual": phase,
            "estado": _normalize_status_label(record["status"]),
            "responsable": _coerce_text(record["owner_name"]),
            "usuario_relacionado": _resolve_lab_related_person(record),
        })

    paged_rows, total = _paginate_rows(_sort_rows_desc(rows, "fecha_ingreso", "numero_acta"), pagination)
    return paged_rows, total


def lab_obsolete_derivations(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    rows_raw = _fetch_lab_rows(filters, marked_obsolete_only=True)
    rows = [
        {
            "numero_acta": record["document_number"],
            "fecha_salida": _coerce_date_text(record["exit_date"] or record["entry_date"] or record["created_at"]),
            "activo": _resolve_lab_asset_label(record),
            "motivo": _normalize_lab_reason(record["reason"]),
            "responsable": _coerce_text(record["owner_name"]),
            "trabajo_realizado": _coerce_text(record.get("work_performed") or record.get("exit_observations")),
            "acta_normalizacion": _coerce_text(record.get("normalization_act_code")),
            "estado": _normalize_status_label(record["status"]),
        }
        for record in rows_raw
    ]
    paged_rows, total = _paginate_rows(_sort_rows_desc(rows, "fecha_salida", "numero_acta"), pagination)
    return paged_rows, total


QUERY_REGISTRY: dict[str, Any] = {
    "handover_documents_by_period": handover_documents_by_period,
    "pending_delivery_confirmations": pending_delivery_confirmations,
    "asset_movement_history": asset_movement_history,
    "lab_equipment_current": lab_equipment_current,
    "incomplete_handover_documents": incomplete_handover_documents,
    "lab_records_by_period": lab_records_by_period,
    "lab_obsolete_derivations": lab_obsolete_derivations,
}
