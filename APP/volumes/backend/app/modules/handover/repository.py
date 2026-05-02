from __future__ import annotations

from typing import Any

from infrastructure.db import get_db_connection


def _is_unknown_usage_type_error(exc: Exception) -> bool:
    args = getattr(exc, "args", ()) or ()
    return bool(args and args[0] == 1054 and "usage_type" in str(args[-1]))


def _is_missing_item_evidence_table_error(exc: Exception) -> bool:
    args = getattr(exc, "args", ()) or ()
    return bool(args and args[0] == 1146 and "hub_handover_item_evidences" in str(args[-1]))


def fetch_handover_document_rows(
    query: str = "",
    status: str = "",
    handover_type: str = "",
) -> list[dict[str, Any]]:
    filters: list[str] = []
    params: list[Any] = []

    normalized_query = str(query or "").strip().lower()
    if normalized_query:
        like = f"%{normalized_query}%"
        filters.append(
            """
            (
                LOWER(d.document_number) LIKE %s
                OR LOWER(d.receiver_name) LIKE %s
                OR LOWER(COALESCE(d.additional_receivers, '')) LIKE %s
                OR EXISTS (
                    SELECT 1
                    FROM hub_handover_document_items search_item
                    WHERE search_item.document_id = d.id
                      AND (
                          LOWER(search_item.asset_code) LIKE %s
                          OR LOWER(search_item.asset_name) LIKE %s
                          OR LOWER(COALESCE(search_item.asset_serial, '')) LIKE %s
                      )
                )
            )
            """
        )
        params.extend([like, like, like, like, like, like])

    if status:
        filters.append("d.status = %s")
        params.append(status)

    if handover_type:
        filters.append("d.handover_type = %s")
        params.append(handover_type)

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    query_sql = f"""
        SELECT
            d.id,
            d.document_number,
            d.generated_at,
            d.creation_date,
            d.assignment_date,
            d.evidence_date,
            d.owner_user_id,
            d.owner_name,
            d.requester_admin_user_id,
            d.requester_admin_name,
            d.requester_admin_itop_person_key,
            d.status,
            d.handover_type,
            d.normalization_mode,
            d.normalization_params,
            d.reason,
            d.notes,
            d.signer_observation,
            d.receiver_person_id,
            d.receiver_code,
            d.receiver_name,
            d.receiver_email,
            d.receiver_phone,
            d.receiver_role,
            d.receiver_status,
            d.additional_receivers,
            d.generated_documents,
            d.evidence_attachments,
            d.signature_workflow,
            COUNT(i.id) AS asset_count,
            SUBSTRING_INDEX(
                GROUP_CONCAT(i.asset_name ORDER BY i.sort_order ASC SEPARATOR '||'),
                '||',
                1
            ) AS first_asset_name
        FROM hub_handover_documents d
        LEFT JOIN hub_handover_document_items i
            ON i.document_id = d.id
        {where_clause}
        GROUP BY
            d.id,
            d.document_number,
            d.generated_at,
            d.creation_date,
            d.assignment_date,
            d.evidence_date,
            d.owner_user_id,
            d.owner_name,
            d.requester_admin_user_id,
            d.requester_admin_name,
            d.requester_admin_itop_person_key,
            d.status,
            d.handover_type,
            d.normalization_mode,
            d.normalization_params,
            d.reason,
            d.notes,
            d.signer_observation,
            d.receiver_person_id,
            d.receiver_code,
            d.receiver_name,
            d.receiver_email,
            d.receiver_phone,
            d.receiver_role,
            d.receiver_status,
            d.additional_receivers,
            d.generated_documents,
            d.evidence_attachments,
            d.signature_workflow
        ORDER BY d.generated_at DESC, d.id DESC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query_sql, tuple(params))
            return cursor.fetchall()


def fetch_handover_document_row(document_id: int) -> dict[str, Any] | None:
    query = """
        SELECT
            id,
            document_number,
            generated_at,
            creation_date,
            assignment_date,
            evidence_date,
            owner_user_id,
            owner_name,
            requester_admin_user_id,
            requester_admin_name,
            requester_admin_itop_person_key,
            status,
            handover_type,
            normalization_mode,
            normalization_params,
            reason,
            notes,
            signer_observation,
            receiver_person_id,
            receiver_code,
            receiver_name,
            receiver_email,
            receiver_phone,
            receiver_role,
            receiver_status,
            additional_receivers,
            generated_documents,
            evidence_attachments,
            signature_workflow,
            created_at,
            updated_at
        FROM hub_handover_documents
        WHERE id = %s
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchone()


def fetch_handover_document_row_by_signature_token(signature_token: str) -> dict[str, Any] | None:
    query = """
        SELECT
            id,
            document_number,
            generated_at,
            creation_date,
            assignment_date,
            evidence_date,
            owner_user_id,
            owner_name,
            requester_admin_user_id,
            requester_admin_name,
            requester_admin_itop_person_key,
            status,
            handover_type,
            normalization_mode,
            normalization_params,
            reason,
            notes,
            signer_observation,
            receiver_person_id,
            receiver_code,
            receiver_name,
            receiver_email,
            receiver_phone,
            receiver_role,
            receiver_status,
            additional_receivers,
            generated_documents,
            evidence_attachments,
            signature_workflow,
            created_at,
            updated_at
        FROM hub_handover_documents
        WHERE signature_workflow LIKE %s
        ORDER BY id DESC
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (f'%"{str(signature_token or "").strip()}"%',))
            return cursor.fetchone()


def fetch_handover_item_rows(document_id: int) -> list[dict[str, Any]]:
    query = """
        SELECT
            id,
            document_id,
            asset_itop_id,
            asset_code,
            asset_name,
            asset_class_name,
            asset_brand,
            asset_model,
            asset_serial,
            asset_status,
            assigned_user_name,
            notes,
            sort_order,
            created_at,
            updated_at
        FROM hub_handover_document_items
        WHERE document_id = %s
        ORDER BY sort_order ASC, id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchall()


def fetch_latest_handover_mobile_signature_session(document_id: int) -> dict[str, Any] | None:
    query = """
        SELECT
            id,
            document_id,
            signature_token,
            channel,
            session_status,
            requested_at,
            claimed_at,
            signed_at,
            signer_name,
            signer_role,
            client_ip,
            user_agent,
            device_platform,
            device_language,
            device_timezone,
            screen_width,
            screen_height,
            viewport_width,
            viewport_height,
            device_pixel_ratio,
            created_at,
            updated_at
        FROM hub_handover_mobile_signature_sessions
        WHERE document_id = %s
        ORDER BY COALESCE(signed_at, claimed_at, requested_at) DESC, id DESC
        LIMIT 1
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchone()


def upsert_handover_mobile_signature_session(session_data: dict[str, Any]) -> None:
    query = """
        INSERT INTO hub_handover_mobile_signature_sessions (
            document_id,
            signature_token,
            channel,
            session_status,
            requested_at,
            claimed_at,
            signed_at,
            signer_name,
            signer_role,
            client_ip,
            user_agent,
            device_platform,
            device_language,
            device_timezone,
            screen_width,
            screen_height,
            viewport_width,
            viewport_height,
            device_pixel_ratio
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            session_status = VALUES(session_status),
            requested_at = COALESCE(VALUES(requested_at), requested_at),
            claimed_at = COALESCE(VALUES(claimed_at), claimed_at),
            signed_at = COALESCE(VALUES(signed_at), signed_at),
            signer_name = COALESCE(VALUES(signer_name), signer_name),
            signer_role = COALESCE(VALUES(signer_role), signer_role),
            client_ip = COALESCE(VALUES(client_ip), client_ip),
            user_agent = COALESCE(VALUES(user_agent), user_agent),
            device_platform = COALESCE(VALUES(device_platform), device_platform),
            device_language = COALESCE(VALUES(device_language), device_language),
            device_timezone = COALESCE(VALUES(device_timezone), device_timezone),
            screen_width = COALESCE(VALUES(screen_width), screen_width),
            screen_height = COALESCE(VALUES(screen_height), screen_height),
            viewport_width = COALESCE(VALUES(viewport_width), viewport_width),
            viewport_height = COALESCE(VALUES(viewport_height), viewport_height),
            device_pixel_ratio = COALESCE(VALUES(device_pixel_ratio), device_pixel_ratio)
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                query,
                (
                    session_data.get("document_id"),
                    session_data.get("signature_token"),
                    session_data.get("channel"),
                    session_data.get("session_status"),
                    session_data.get("requested_at"),
                    session_data.get("claimed_at"),
                    session_data.get("signed_at"),
                    session_data.get("signer_name"),
                    session_data.get("signer_role"),
                    session_data.get("client_ip"),
                    session_data.get("user_agent"),
                    session_data.get("device_platform"),
                    session_data.get("device_language"),
                    session_data.get("device_timezone"),
                    session_data.get("screen_width"),
                    session_data.get("screen_height"),
                    session_data.get("viewport_width"),
                    session_data.get("viewport_height"),
                    session_data.get("device_pixel_ratio"),
                ),
            )


def fetch_handover_item_checklist_rows(document_id: int) -> list[dict[str, Any]]:
    query = """
        SELECT
            c.id,
            c.item_id,
            c.template_id,
            c.template_name,
            c.template_description,
            c.sort_order,
            i.document_id
        FROM hub_handover_item_checklists c
        INNER JOIN hub_handover_document_items i
            ON i.id = c.item_id
        WHERE i.document_id = %s
        ORDER BY i.sort_order ASC, c.sort_order ASC, c.id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                cursor.execute(query, (document_id,))
            except Exception as exc:
                if not _is_missing_item_evidence_table_error(exc):
                    raise
                return []
            return cursor.fetchall()


def fetch_handover_item_evidence_rows(document_id: int) -> list[dict[str, Any]]:
    query = """
        SELECT
            e.id,
            e.item_id,
            e.original_name,
            e.stored_name,
            e.mime_type,
            e.file_size,
            e.caption,
            e.source,
            e.sort_order,
            i.document_id,
            i.asset_itop_id
        FROM hub_handover_item_evidences e
        INNER JOIN hub_handover_document_items i
            ON i.id = e.item_id
        WHERE i.document_id = %s
        ORDER BY i.sort_order ASC, e.sort_order ASC, e.id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchall()


def fetch_handover_checklist_answer_rows(document_id: int) -> list[dict[str, Any]]:
    query = """
        SELECT
            a.id,
            a.item_checklist_id,
            a.checklist_item_id,
            a.check_name,
            a.check_description,
            a.input_type,
            a.option_a,
            a.option_b,
            a.response_value,
            a.sort_order,
            c.item_id,
            c.template_id
        FROM hub_handover_checklist_answers a
        INNER JOIN hub_handover_item_checklists c
            ON c.id = a.item_checklist_id
        INNER JOIN hub_handover_document_items i
            ON i.id = c.item_id
        WHERE i.document_id = %s
        ORDER BY i.sort_order ASC, c.sort_order ASC, a.sort_order ASC, a.id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (document_id,))
            return cursor.fetchall()


def fetch_handover_template_rows(
    include_inactive: bool = False,
    usage_types: list[str] | None = None,
) -> list[dict[str, Any]]:
    filters = ["module_code = 'handover'"]
    params: list[object] = []
    if not include_inactive:
        filters.append("status = 'active'")
    if usage_types:
        placeholders = ", ".join(["%s"] * len(usage_types))
        filters.append(f"(usage_type IN ({placeholders}) OR usage_type IS NULL OR usage_type = '')")
        params.extend(usage_types)

    query = f"""
        SELECT
            id,
            module_code,
            usage_type,
            name,
            description,
            status,
            cmdb_class_label,
            sort_order
        FROM hub_checklist_templates
        WHERE {' AND '.join(filters)}
        ORDER BY sort_order ASC, id ASC
    """
    legacy_query = f"""
        SELECT
            id,
            module_code,
            '' AS usage_type,
            name,
            description,
            status,
            cmdb_class_label,
            sort_order
        FROM hub_checklist_templates
        WHERE {' AND '.join(filter_value for filter_value in filters if 'usage_type' not in filter_value)}
        ORDER BY sort_order ASC, id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            try:
                cursor.execute(query, params)
            except Exception as exc:
                if not _is_unknown_usage_type_error(exc):
                    raise
                cursor.execute(legacy_query, params[:0])
            return cursor.fetchall()


def fetch_handover_template_item_rows(template_ids: list[int]) -> list[dict[str, Any]]:
    if not template_ids:
        return []

    placeholders = ", ".join(["%s"] * len(template_ids))
    query = f"""
        SELECT
            id,
            template_id,
            name,
            description,
            input_type,
            option_a,
            option_b,
            sort_order
        FROM hub_checklist_items
        WHERE template_id IN ({placeholders})
        ORDER BY template_id ASC, sort_order ASC, id ASC
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, tuple(template_ids))
            return cursor.fetchall()


def get_next_handover_sequence(prefix: str, year: int) -> int:
    query = """
        SELECT
            COALESCE(
                MAX(
                    CAST(SUBSTRING_INDEX(document_number, '-', -1) AS UNSIGNED)
                ),
                0
            ) + 1 AS next_sequence
        FROM hub_handover_documents
        WHERE document_number LIKE %s
    """
    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, (f"{prefix}-{year}-%",))
            row = cursor.fetchone() or {}
    return int(row.get("next_sequence") or 1)


def save_handover_document(
    document_id: int | None,
    document: dict[str, Any],
    items: list[dict[str, Any]],
) -> int:
    insert_document_query = """
        INSERT INTO hub_handover_documents (
            document_number,
            generated_at,
            creation_date,
            assignment_date,
            evidence_date,
            owner_user_id,
            owner_name,
            requester_admin_user_id,
            requester_admin_name,
            requester_admin_itop_person_key,
            status,
            handover_type,
            normalization_mode,
            normalization_params,
            reason,
            notes,
            signer_observation,
            receiver_person_id,
            receiver_code,
            receiver_name,
            receiver_email,
            receiver_phone,
            receiver_role,
            receiver_status,
            additional_receivers,
            generated_documents,
            evidence_attachments,
            signature_workflow
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    update_document_query = """
        UPDATE hub_handover_documents
        SET
            generated_at = %s,
            creation_date = %s,
            assignment_date = %s,
            evidence_date = %s,
            status = %s,
            requester_admin_user_id = %s,
            requester_admin_name = %s,
            requester_admin_itop_person_key = %s,
            handover_type = %s,
            normalization_mode = %s,
            normalization_params = %s,
            reason = %s,
            notes = %s,
            signer_observation = %s,
            receiver_person_id = %s,
            receiver_code = %s,
            receiver_name = %s,
            receiver_email = %s,
            receiver_phone = %s,
            receiver_role = %s,
            receiver_status = %s,
            additional_receivers = %s,
            generated_documents = %s,
            evidence_attachments = %s,
            signature_workflow = %s
        WHERE id = %s
    """
    delete_items_query = "DELETE FROM hub_handover_document_items WHERE document_id = %s"
    insert_item_query = """
        INSERT INTO hub_handover_document_items (
            document_id,
            asset_itop_id,
            asset_code,
            asset_name,
            asset_class_name,
            asset_brand,
            asset_model,
            asset_serial,
            asset_status,
            assigned_user_name,
            notes,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    insert_item_checklist_query = """
        INSERT INTO hub_handover_item_checklists (
            item_id,
            template_id,
            template_name,
            template_description,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s)
    """
    insert_answer_query = """
        INSERT INTO hub_handover_checklist_answers (
            item_checklist_id,
            checklist_item_id,
            check_name,
            check_description,
            input_type,
            option_a,
            option_b,
            response_value,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    with get_db_connection() as connection:
        connection.autocommit(False)
        try:
            with connection.cursor() as cursor:
                if document_id is None:
                    cursor.execute(
                        insert_document_query,
                        (
                            document["document_number"],
                            document["generated_at"],
                            document["creation_date"],
                            document["assignment_date"],
                            document["evidence_date"],
                            document["owner_user_id"],
                            document["owner_name"],
                            document.get("requester_admin_user_id"),
                            document.get("requester_admin_name"),
                            document.get("requester_admin_itop_person_key"),
                            document["status"],
                            document["handover_type"],
                            document.get("normalization_mode"),
                            document.get("normalization_params"),
                            document["reason"],
                            document["notes"],
                            document["signer_observation"],
                            document["receiver_person_id"],
                            document["receiver_code"],
                            document["receiver_name"],
                            document["receiver_email"],
                            document["receiver_phone"],
                            document["receiver_role"],
                            document["receiver_status"],
                            document["additional_receivers"],
                            document["generated_documents"],
                            document["evidence_attachments"],
                            document["signature_workflow"],
                        ),
                    )
                    saved_document_id = int(cursor.lastrowid)
                else:
                    cursor.execute(
                        update_document_query,
                        (
                            document["generated_at"],
                            document["creation_date"],
                            document["assignment_date"],
                            document["evidence_date"],
                            document["status"],
                            document.get("requester_admin_user_id"),
                            document.get("requester_admin_name"),
                            document.get("requester_admin_itop_person_key"),
                            document["handover_type"],
                            document.get("normalization_mode"),
                            document.get("normalization_params"),
                            document["reason"],
                            document["notes"],
                            document["signer_observation"],
                            document["receiver_person_id"],
                            document["receiver_code"],
                            document["receiver_name"],
                            document["receiver_email"],
                            document["receiver_phone"],
                            document["receiver_role"],
                            document["receiver_status"],
                            document["additional_receivers"],
                            document["generated_documents"],
                            document["evidence_attachments"],
                            document["signature_workflow"],
                            document_id,
                        ),
                    )
                    saved_document_id = document_id
                    cursor.execute(delete_items_query, (saved_document_id,))

                for item_index, item in enumerate(items):
                    cursor.execute(
                        insert_item_query,
                        (
                            saved_document_id,
                            item["asset_itop_id"],
                            item["asset_code"],
                            item["asset_name"],
                            item["asset_class_name"],
                            item["asset_brand"],
                            item["asset_model"],
                            item["asset_serial"],
                            item["asset_status"],
                            item["assigned_user_name"],
                            item["notes"],
                            (item_index + 1) * 10,
                        ),
                    )
                    saved_item_id = int(cursor.lastrowid)

                    for checklist_index, checklist in enumerate(item["checklists"]):
                        cursor.execute(
                            insert_item_checklist_query,
                            (
                                saved_item_id,
                                checklist["template_id"],
                                checklist["template_name"],
                                checklist["template_description"],
                                (checklist_index + 1) * 10,
                            ),
                        )
                        saved_item_checklist_id = int(cursor.lastrowid)

                        for answer_index, answer in enumerate(checklist["answers"]):
                            cursor.execute(
                                insert_answer_query,
                                (
                                    saved_item_checklist_id,
                                    answer["checklist_item_id"],
                                    answer["check_name"],
                                    answer["check_description"],
                                    answer["input_type"],
                                    answer["option_a"],
                                    answer["option_b"],
                                    answer["response_value"],
                                    (answer_index + 1) * 10,
                                ),
                            )

            connection.commit()
            return saved_document_id
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.autocommit(True)


def replace_handover_item_evidences(
    document_id: int,
    evidences_by_asset: dict[int, list[dict[str, Any]]],
) -> None:
    has_any_evidence = any(evidences for evidences in (evidences_by_asset or {}).values())
    delete_query = """
        DELETE e
        FROM hub_handover_item_evidences e
        INNER JOIN hub_handover_document_items i
            ON i.id = e.item_id
        WHERE i.document_id = %s
    """
    select_item_query = """
        SELECT id, asset_itop_id
        FROM hub_handover_document_items
        WHERE document_id = %s
    """
    insert_query = """
        INSERT INTO hub_handover_item_evidences (
            item_id,
            original_name,
            stored_name,
            mime_type,
            file_size,
            caption,
            source,
            sort_order
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """

    with get_db_connection() as connection:
        connection.autocommit(False)
        try:
            with connection.cursor() as cursor:
                try:
                    cursor.execute(delete_query, (document_id,))
                except Exception as exc:
                    if _is_missing_item_evidence_table_error(exc):
                        if has_any_evidence:
                            raise
                        connection.rollback()
                        return
                    raise
                cursor.execute(select_item_query, (document_id,))
                item_rows = cursor.fetchall() or []
                item_ids_by_asset = {
                    int(row["asset_itop_id"]): int(row["id"])
                    for row in item_rows
                    if int(row.get("asset_itop_id") or 0) > 0 and int(row.get("id") or 0) > 0
                }

                for asset_id, evidences in (evidences_by_asset or {}).items():
                    item_id = item_ids_by_asset.get(int(asset_id))
                    if not item_id:
                        continue
                    for index, evidence in enumerate(evidences or [], start=1):
                        cursor.execute(
                            insert_query,
                            (
                                item_id,
                                evidence.get("original_name"),
                                evidence.get("stored_name"),
                                evidence.get("mime_type"),
                                evidence.get("file_size"),
                                evidence.get("caption"),
                                evidence.get("source"),
                                index * 10,
                            ),
                        )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.autocommit(True)
