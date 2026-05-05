from __future__ import annotations

from typing import Any

from infrastructure.db import get_db_connection


HANDOVER_TYPE_LABELS = {
    "initial_assignment": "Acta de entrega",
    "return": "Acta de devolucion",
    "reassignment": "Acta de reasignacion",
    "normalization": "Acta de normalizacion",
}

HANDOVER_TYPE_MODULES = {
    "initial_assignment": "handover",
    "return": "handover",
    "normalization": "handover",
    "reassignment": "reassignment",
}

HANDOVER_TYPE_PATHS = {
    "initial_assignment": "/handover",
    "return": "/returns",
    "normalization": "/normalization",
    "reassignment": "/reassignment",
}

STATUS_LABELS = {
    "active": "Activo",
    "inactive": "Inactivo",
    "blocked": "Bloqueado",
}


def _coerce_str(value: Any) -> str:
    return str(value or "").strip()


def _allowed_modules(session_user: dict[str, Any]) -> set[str]:
    return set(session_user.get("permissions", {}).get("viewModules", []) or [])


def _match_all_tokens(columns_sql: str, query: str) -> tuple[str, list[Any]]:
    tokens = [token for token in _coerce_str(query).lower().split() if token]
    if not tokens:
        return "", []
    filters = []
    params = []
    for token in tokens:
        filters.append(f"{columns_sql} LIKE %s")
        params.append(f"%{token}%")
    return " AND ".join(filters), params


def _search_handover_documents(query: str, allowed: set[str], limit: int) -> list[dict[str, Any]]:
    allowed_types = [
        handover_type
        for handover_type, module_code in HANDOVER_TYPE_MODULES.items()
        if module_code in allowed
    ]
    if not allowed_types:
        return []

    haystack_sql = """
        LOWER(CONCAT_WS(' ',
            d.document_number,
            COALESCE(d.receiver_name, ''),
            COALESCE(d.receiver_email, ''),
            COALESCE(d.owner_name, ''),
            COALESCE(d.reason, ''),
            COALESCE(d.notes, ''),
            COALESCE(d.signer_observation, ''),
            COALESCE(d.additional_receivers, ''),
            COALESCE(i.asset_code, ''),
            COALESCE(i.asset_name, ''),
            COALESCE(i.asset_serial, '')
        ))
    """
    token_filter, token_params = _match_all_tokens(haystack_sql, query)
    if not token_filter:
        return []

    placeholders = ", ".join(["%s"] * len(allowed_types))
    sql = f"""
        SELECT
            d.id,
            d.document_number,
            d.handover_type,
            d.status,
            d.receiver_name,
            d.owner_name,
            d.generated_at,
            COUNT(DISTINCT i.id) AS asset_count,
            SUBSTRING_INDEX(
                GROUP_CONCAT(DISTINCT COALESCE(i.asset_code, i.asset_name) ORDER BY i.sort_order ASC SEPARATOR '||'),
                '||',
                1
            ) AS first_asset
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i ON i.document_id = d.id
        WHERE d.handover_type IN ({placeholders})
          AND {token_filter}
        GROUP BY
            d.id,
            d.document_number,
            d.handover_type,
            d.status,
            d.receiver_name,
            d.owner_name,
            d.generated_at
        ORDER BY d.generated_at DESC, d.id DESC
        LIMIT %s
    """
    params = [*allowed_types, *token_params, limit]
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, tuple(params))
            rows = cursor.fetchall() or []

    results = []
    for row in rows:
        handover_type = _coerce_str(row.get("handover_type"))
        base_path = HANDOVER_TYPE_PATHS.get(handover_type, "/handover")
        asset_count = int(row.get("asset_count") or 0)
        first_asset = _coerce_str(row.get("first_asset")) or "Sin activo"
        asset_summary = f"{first_asset} +{asset_count - 1}" if asset_count > 1 else first_asset
        results.append({
            "id": f"handover-{row['id']}",
            "kind": "handover",
            "module": HANDOVER_TYPE_MODULES.get(handover_type, "handover"),
            "type": HANDOVER_TYPE_LABELS.get(handover_type, "Acta"),
            "title": _coerce_str(row.get("document_number")),
            "subtitle": asset_summary,
            "description": _coerce_str(row.get("receiver_name") or row.get("owner_name")),
            "status": _coerce_str(row.get("status")),
            "date": row.get("generated_at").isoformat() if row.get("generated_at") else "",
            "path": f"{base_path}/{row['id']}",
        })
    return results


def _search_lab_records(query: str, allowed: set[str], limit: int) -> list[dict[str, Any]]:
    if "lab" not in allowed:
        return []

    haystack_sql = """
        LOWER(CONCAT_WS(' ',
            r.document_number,
            COALESCE(r.asset_code, ''),
            COALESCE(r.asset_name, ''),
            COALESCE(r.asset_serial, ''),
            COALESCE(r.asset_assigned_user, ''),
            COALESCE(r.owner_name, ''),
            COALESCE(r.requester_admin_name, ''),
            COALESCE(r.reason, ''),
            COALESCE(r.requested_actions, ''),
            COALESCE(r.entry_observations, ''),
            COALESCE(r.processing_observations, ''),
            COALESCE(r.exit_observations, ''),
            COALESCE(r.work_performed, ''),
            COALESCE(r.normalization_act_code, '')
        ))
    """
    token_filter, token_params = _match_all_tokens(haystack_sql, query)
    if not token_filter:
        return []

    sql = f"""
        SELECT
            r.id,
            r.document_number,
            r.status,
            r.asset_code,
            r.asset_name,
            r.asset_serial,
            r.asset_assigned_user,
            r.owner_name,
            r.entry_date,
            r.exit_date,
            r.created_at
        FROM hub_lab_records r
        WHERE {token_filter}
        ORDER BY COALESCE(r.exit_date, r.entry_date, r.created_at) DESC, r.id DESC
        LIMIT %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, tuple([*token_params, limit]))
            rows = cursor.fetchall() or []

    results = []
    for row in rows:
        asset = " / ".join(
            value for value in [_coerce_str(row.get("asset_code")), _coerce_str(row.get("asset_name"))] if value
        ) or "Sin activo"
        date_value = row.get("exit_date") or row.get("entry_date") or row.get("created_at")
        results.append({
            "id": f"lab-{row['id']}",
            "kind": "lab",
            "module": "lab",
            "type": "Acta de laboratorio",
            "title": _coerce_str(row.get("document_number")),
            "subtitle": asset,
            "description": _coerce_str(row.get("asset_assigned_user") or row.get("owner_name")),
            "status": _coerce_str(row.get("status")),
            "date": date_value.isoformat() if hasattr(date_value, "isoformat") else _coerce_str(date_value),
            "path": f"/lab/{row['id']}",
        })
    return results


def _search_hub_users(query: str, allowed: set[str], limit: int) -> list[dict[str, Any]]:
    if "users" not in allowed:
        return []

    haystack_sql = """
        LOWER(CONCAT_WS(' ',
            u.username,
            COALESCE(u.full_name, ''),
            COALESCE(u.email, ''),
            COALESCE(r.name, ''),
            COALESCE(u.itop_person_key, '')
        ))
    """
    token_filter, token_params = _match_all_tokens(haystack_sql, query)
    if not token_filter:
        return []

    sql = f"""
        SELECT
            u.id,
            u.username,
            u.full_name,
            u.email,
            u.status,
            u.updated_at,
            r.name AS role_name
        FROM hub_users u
        INNER JOIN hub_roles r ON r.id = u.role_id
        WHERE {token_filter}
        ORDER BY u.updated_at DESC, u.full_name ASC, u.username ASC
        LIMIT %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, tuple([*token_params, limit]))
            rows = cursor.fetchall() or []

    return [
        {
            "id": f"user-{row['id']}",
            "kind": "user",
            "module": "users",
            "type": "Usuario Hub",
            "title": _coerce_str(row.get("full_name") or row.get("username")),
            "subtitle": _coerce_str(row.get("email") or row.get("username")),
            "description": _coerce_str(row.get("role_name")),
            "status": STATUS_LABELS.get(_coerce_str(row.get("status")), _coerce_str(row.get("status"))),
            "date": row.get("updated_at").isoformat() if row.get("updated_at") else "",
            "path": "/users",
        }
        for row in rows
    ]


def search_hub(query: str, session_user: dict[str, Any], limit: int = 50) -> dict[str, Any]:
    normalized_query = _coerce_str(query)
    if len(normalized_query) < 2:
        return {"query": normalized_query, "items": [], "total": 0}

    bounded_limit = max(1, min(int(limit or 50), 100))
    per_source_limit = max(10, bounded_limit)
    allowed = _allowed_modules(session_user)
    items = [
        *_search_handover_documents(normalized_query, allowed, per_source_limit),
        *_search_lab_records(normalized_query, allowed, per_source_limit),
        *_search_hub_users(normalized_query, allowed, 10),
    ]
    items.sort(key=lambda item: item.get("date") or "", reverse=True)
    items = items[:bounded_limit]
    return {
        "query": normalized_query,
        "items": items,
        "total": len(items),
        "sources": {
            "handover": sum(1 for item in items if item.get("kind") == "handover"),
            "lab": sum(1 for item in items if item.get("kind") == "lab"),
            "users": sum(1 for item in items if item.get("kind") == "user"),
        },
    }
