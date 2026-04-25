from __future__ import annotations

from typing import Any

from infrastructure.db import get_db_connection

_HANDOVER_TYPE_LABEL = {
    "initial_assignment": "Entrega",
    "return": "Recepcion",
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
    page = max(1, int(pagination.get("page", 1)))
    page_size = max(1, min(500, int(pagination.get("page_size", 50))))
    offset = (page - 1) * page_size
    return "LIMIT %s OFFSET %s", [page_size, offset]


def handover_documents_by_period(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = []
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

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    count_sql = f"SELECT COUNT(*) AS total FROM hub_handover_documents d {where}"
    data_sql = f"""
        SELECT
            d.handover_type,
            d.document_number,
            d.generated_at,
            d.owner_name,
            COALESCE(GROUP_CONCAT(i.asset_code ORDER BY i.sort_order SEPARATOR ', '), '-') AS activos_list,
            d.receiver_name,
            d.status
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at DESC
    """
    limit_clause, limit_params = _pagination_clause(pagination)
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
            "usuario_relacionado": r["receiver_name"] or "-",
            "estado": _STATUS_LABEL.get(r["status"], r["status"]),
        }
        for r in rows_raw
    ]
    return rows, int(total)


def pending_delivery_confirmations(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["d.status = 'issued'"]
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
            d.owner_name,
            d.status
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at ASC
    """
    limit_clause, limit_params = _pagination_clause(pagination)
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
            "persona": r["receiver_name"] or "-",
            "responsable": r["owner_name"] or "-",
            "estado": _STATUS_LABEL.get(r["status"], r["status"]),
        }
        for r in rows_raw
    ]
    return rows, int(total)


def asset_movement_history(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["d.status != 'draft'"]
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
            CASE d.handover_type
                WHEN 'initial_assignment' THEN 'Stock TI'
                WHEN 'return' THEN d.receiver_name
                ELSE d.owner_name
            END AS origen,
            CASE d.handover_type
                WHEN 'initial_assignment' THEN d.receiver_name
                WHEN 'return' THEN 'Stock TI'
                ELSE d.receiver_name
            END AS destino,
            i.asset_status,
            d.document_number
        FROM hub_handover_documents d
        JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        ORDER BY d.generated_at DESC, i.sort_order ASC
    """
    limit_clause, limit_params = _pagination_clause(pagination)
    data_sql += f" {limit_clause}"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(count_sql, params)
            total = (cur.fetchone() or {}).get("total", 0)
            cur.execute(data_sql, params + limit_params)
            rows_raw = cur.fetchall()

    rows = [
        {
            "fecha": str(r["generated_at"])[:10] if r["generated_at"] else "-",
            "activo": r["asset_code"] or "-",
            "tipo_movimiento": _HANDOVER_TYPE_LABEL.get(r["handover_type"], r["handover_type"]),
            "origen": r["origen"] or "-",
            "destino": r["destino"] or "-",
            "estado_activo": r["asset_status"] or "-",
            "numero_acta": r["document_number"] or "-",
        }
        for r in rows_raw
    ]
    return rows, int(total)


def lab_equipment_current(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["d.handover_type = 'laboratory'"]
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
            d.generated_at
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at DESC
    """
    limit_clause, limit_params = _pagination_clause(pagination)
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
            "fecha_ingreso": str(r["generated_at"])[:10] if r["generated_at"] else "-",
        }
        for r in rows_raw
    ]
    return rows, int(total)


def incomplete_handover_documents(filters: dict[str, Any], pagination: dict) -> tuple[list[dict], int]:
    conditions: list[str] = ["d.status IN ('draft', 'issued')"]
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
            d.status
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        {where}
        GROUP BY d.id
        ORDER BY d.generated_at DESC
    """
    limit_clause, limit_params = _pagination_clause(pagination)
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
