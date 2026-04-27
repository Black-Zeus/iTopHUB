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
    "confirmed": "Confirmada",
    "cancelled": "Cancelada",
}


def _pagination_clause(pagination: dict) -> tuple[str, list]:
    page_size_raw = int(pagination.get("page_size", 50))
    if page_size_raw <= 0:
        return "", []
    page = max(1, int(pagination.get("page", 1)))
    page_size = min(5000, page_size_raw)
    offset = (page - 1) * page_size
    return "LIMIT %s OFFSET %s", [page_size, offset]


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


def handover_documents_by_period(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["LOWER(d.receiver_status) = 'active'"]
    params: list[Any] = []

    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    handover_type = filters.get("handover_type")
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
        params.append(f"%{owner_name.lower()}%")

    where = f"WHERE {' AND '.join(conditions)}"
    count_sql = f"SELECT COUNT(*) AS total FROM hub_handover_documents d {where}"
    data_sql = f"""
        SELECT
            d.handover_type,
            d.document_number,
            d.generated_at,
            d.owner_name,
            COALESCE(GROUP_CONCAT(i.asset_code ORDER BY i.sort_order SEPARATOR ', '), '-') AS activos_list,
            d.receiver_name,
            d.additional_receivers,
            d.status
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at DESC
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
            "tipo": _HANDOVER_TYPE_LABEL.get(r["handover_type"], r["handover_type"]),
            "numero": r["document_number"],
            "fecha": str(r["generated_at"])[:10] if r["generated_at"] else "-",
            "responsable": r["owner_name"] or "-",
            "activos": r["activos_list"] or "-",
            "usuario_relacionado": _collect_related_users(
                r["handover_type"],
                r.get("receiver_name"),
                r.get("additional_receivers"),
            ),
            "estado": _STATUS_LABEL.get(r["status"], r["status"]),
        }
        for r in rows_raw
    ]
    return rows, int(total)


def pending_delivery_confirmations(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["d.status = 'issued'", "LOWER(d.receiver_status) = 'active'"]
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
        params.append(f"%{owner_name.lower()}%")

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
        ORDER BY d.generated_at ASC
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
            "fecha": str(r["generated_at"])[:10] if r["generated_at"] else "-",
            "activos": r["activos_list"] or "-",
            "persona": _collect_related_users(
                "initial_assignment",
                r.get("receiver_name"),
                r.get("additional_receivers"),
            ),
            "responsable": r["owner_name"] or "-",
            "estado": _STATUS_LABEL.get(r["status"], r["status"]),
        }
        for r in rows_raw
    ]
    return rows, int(total)


def asset_movement_history(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["d.status != 'draft'", "LOWER(d.receiver_status) = 'active'"]
    params: list[Any] = []

    asset_code = filters.get("asset_code")
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    handover_type = filters.get("handover_type")

    if asset_code:
        conditions.append("LOWER(i.asset_code) LIKE %s")
        params.append(f"%{asset_code.lower()}%")
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
    count_sql = f"""
        SELECT COUNT(*) AS total
        FROM hub_handover_documents d
        JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
    """
    data_sql = f"""
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
        ORDER BY d.generated_at DESC, i.sort_order ASC
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

    rows = []
    for r in rows_raw:
        ht = r["handover_type"]
        add_recv_json = r.get("additional_receivers")
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
            destino = r["receiver_name"] or "-"
        elif ht == "return":
            origen = r["receiver_name"] or "-"
            destino = "Stock TI"
        elif ht == "reassignment":
            origin_person = (add_recv[0].get("name") or "").strip() if add_recv else r["owner_name"]
            origen = origin_person or "-"
            destino = r["receiver_name"] or "-"
        else:
            origen = r["owner_name"] or "-"
            destino = r["receiver_name"] or "-"

        rows.append({
            "fecha": str(r["generated_at"])[:10] if r["generated_at"] else "-",
            "activo": r["asset_code"] or "-",
            "tipo_movimiento": _HANDOVER_TYPE_LABEL.get(ht, ht),
            "origen": origen,
            "destino": destino,
            "estado_activo": r["asset_status"] or "-",
            "numero_acta": r["document_number"] or "-",
            "observacion_activo": r.get("observacion_activo") or "-",
        })
    return rows, int(total)


def lab_equipment_current(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["d.handover_type = 'laboratory'", "LOWER(d.receiver_status) = 'active'"]
    params: list[Any] = []

    status = filters.get("status")
    if status:
        conditions.append("d.status = %s")
        params.append(status)

    where = f"WHERE {' AND '.join(conditions)}"
    count_sql = f"SELECT COUNT(*) AS total FROM hub_handover_documents d {where}"
    data_sql = f"""
        SELECT
            d.document_number,
            COALESCE(GROUP_CONCAT(i.asset_code ORDER BY i.sort_order SEPARATOR ', '), '-') AS activos_list,
            d.reason,
            d.status,
            d.owner_name,
            d.receiver_name,
            d.generated_at
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at DESC
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
            "numero_acta": r["document_number"],
            "activos": r["activos_list"] or "-",
            "motivo": r["reason"] or "-",
            "estado": _STATUS_LABEL.get(r["status"], r["status"]),
            "responsable": r["owner_name"] or "-",
            "receptor": r["receiver_name"] or "-",
            "fecha_ingreso": str(r["generated_at"])[:10] if r["generated_at"] else "-",
        }
        for r in rows_raw
    ]
    return rows, int(total)


def incomplete_handover_documents(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["d.status IN ('draft', 'issued')", "LOWER(d.receiver_status) = 'active'"]
    params: list[Any] = []

    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    handover_type = filters.get("handover_type")

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
    count_sql = f"SELECT COUNT(*) AS total FROM hub_handover_documents d {where}"
    data_sql = f"""
        SELECT
            d.document_number,
            d.handover_type,
            d.generated_at,
            COALESCE(GROUP_CONCAT(i.asset_code ORDER BY i.sort_order SEPARATOR ', '), '-') AS activos_list,
            d.owner_name,
            d.receiver_name,
            d.additional_receivers,
            d.status
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at DESC
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
            "documento": r["document_number"],
            "tipo": _HANDOVER_TYPE_LABEL.get(r["handover_type"], r["handover_type"]),
            "fecha": str(r["generated_at"])[:10] if r["generated_at"] else "-",
            "activos": r["activos_list"] or "-",
            "responsable": r["owner_name"] or "-",
            "persona": _collect_related_users(
                r["handover_type"],
                r.get("receiver_name"),
                r.get("additional_receivers"),
            ),
            "faltante": "Pendiente de confirmacion" if r["status"] == "issued" else "Borrador sin emitir",
            "estado": _STATUS_LABEL.get(r["status"], r["status"]),
        }
        for r in rows_raw
    ]
    return rows, int(total)


QUERY_REGISTRY: dict[str, Any] = {
    "handover_documents_by_period": handover_documents_by_period,
    "pending_delivery_confirmations": pending_delivery_confirmations,
    "asset_movement_history": asset_movement_history,
    "lab_equipment_current": lab_equipment_current,
    "incomplete_handover_documents": incomplete_handover_documents,
}
