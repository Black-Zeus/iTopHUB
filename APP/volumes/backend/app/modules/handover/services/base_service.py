from __future__ import annotations

from base64 import b64decode
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException


def _helpers():
    from modules.handover import service as handover_helpers

    return handover_helpers


class BaseHandoverService:
    def __init__(self, type_definition):
        self.type_definition = type_definition

    def _validate_confirmation_documents(
        self,
        current_detail: dict[str, Any],
        attachments: list[dict[str, Any]],
    ) -> None:
        helpers = _helpers()

        available_kinds = {
            helpers._coerce_str(item.get("kind"))
            for item in current_detail.get("generatedDocuments") or []
            if helpers._coerce_str(item.get("kind")) in helpers.GENERATED_DOCUMENT_KINDS
            and helpers._coerce_str(item.get("storedName"))
        }
        available_kinds.update(
            helpers.EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND[document_type]
            for document_type in (
                helpers._normalize_evidence_document_type(item.get("documentType"))
                for item in attachments or []
            )
            if document_type in helpers.EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND
        )

        missing_kinds = sorted(helpers.GENERATED_DOCUMENT_KINDS.difference(available_kinds))
        if missing_kinds:
            raise HTTPException(
                status_code=422,
                detail="Debes generar correctamente el PDF principal y el detalle antes de confirmar el acta.",
            )

    def validate_assets(
        self,
        payload_or_detail: dict[str, Any],
        *,
        runtime_token: str,
        action_label: str,
        stage: str,
    ) -> None:
        helpers = _helpers()
        if stage == "draft":
            helpers._validate_draft_assets_ownership(
                payload_or_detail,
                runtime_token=runtime_token,
                type_definition=self.type_definition,
            )
            return
        if stage in {"emit", "confirm"}:
            helpers._validate_assets_match_receiver_assignment(
                payload_or_detail,
                runtime_token=runtime_token,
                type_definition=self.type_definition,
                action_label=action_label,
            )

    def get_target_asset_status(self, current_detail: dict[str, Any]) -> str:
        del current_detail
        return "production"

    def pre_emit(self, current_detail: dict[str, Any], runtime_token: str) -> None:
        del current_detail, runtime_token

    def pre_ticket_creation(self, current_detail: dict[str, Any], runtime_token: str) -> None:
        del current_detail, runtime_token

    def get_ticket_contact_ids(self, current_detail: dict[str, Any]) -> list[int]:
        helpers = _helpers()
        return helpers._get_handover_contact_ids(current_detail)

    def get_contacts_to_unlink(
        self,
        current_detail: dict[str, Any],
        connector: Any,
        asset_id: int,
        receiver_person_id: int,
    ) -> list[int]:
        del current_detail, connector, asset_id
        return [receiver_person_id] if receiver_person_id > 0 else []

    def handle_evidence_sync(
        self,
        current_detail: dict[str, Any],
        runtime_token: str,
        *,
        ticket_id: str = "",
    ) -> list[dict[str, Any]]:
        helpers = _helpers()
        person_id = helpers._validate_handover_receiver_rules(
            current_detail,
            type_definition=self.type_definition,
            action_label="sincronizar el acta",
        )
        contact_ids = helpers._get_handover_contact_ids(current_detail)
        target_status = self.get_target_asset_status(current_detail)
        connector = helpers._build_itop_connector(runtime_token)
        results: list[dict[str, Any]] = []

        try:
            for item in current_detail.get("items") or []:
                asset = item.get("asset") or {}
                try:
                    asset_id = int(asset.get("id") or 0)
                except (TypeError, ValueError):
                    asset_id = 0
                if asset_id <= 0:
                    continue

                asset_class = helpers._resolve_asset_itop_class(connector, asset_id)
                asset_result = {
                    "assetId": str(asset_id),
                    "assetClass": asset_class,
                    "contactLinked": False,
                    "contactUnlinked": False,
                    "statusUpdated": False,
                    "statusUpdateError": "",
                    "ticketLinked": False,
                }

                if self.type_definition.evidence_sync_mode == "assign_to_receiver":
                    link_response = connector.link_contacts_to_ci(
                        asset_class,
                        asset_id,
                        contact_ids,
                    )
                    if not link_response.ok:
                        raise HTTPException(
                            status_code=502,
                            detail=f"No fue posible relacionar el EC {asset_id} con los contactos del acta: {link_response.message}",
                        )
                    asset_result["contactLinked"] = True

                    status_response = connector.update_ci_status(
                        asset_class,
                        asset_id,
                        target_status,
                        comment=f"Asignado desde acta {current_detail.get('documentNumber') or ''}".strip(),
                    )
                    if status_response.ok:
                        asset_result["statusUpdated"] = True
                    else:
                        asset_result["statusUpdateError"] = status_response.message
                elif self.type_definition.evidence_sync_mode == "return_to_inventory":
                    contact_ids_to_unlink = sorted(
                        {
                            int(contact_id)
                            for contact_id in self.get_contacts_to_unlink(current_detail, connector, asset_id, person_id)
                            if int(contact_id) > 0
                        }
                    )
                    for contact_id in contact_ids_to_unlink:
                        unlink_response = connector.unlink_contact_from_ci(asset_id, contact_id)
                        if not unlink_response.ok:
                            raise HTTPException(
                                status_code=502,
                                detail=f"No fue posible desvincular el EC {asset_id} de sus contactos actuales: {unlink_response.message}",
                            )
                    asset_result["contactUnlinked"] = bool(contact_ids_to_unlink)

                    status_response = connector.update_ci_status(
                        asset_class,
                        asset_id,
                        target_status,
                        comment=f"Devuelto desde acta {current_detail.get('documentNumber') or ''}".strip(),
                    )
                    if not status_response.ok:
                        raise HTTPException(
                            status_code=502,
                            detail=f"No fue posible dejar el EC {asset_id} en estado '{target_status}': {status_response.message}",
                        )
                    asset_result["statusUpdated"] = True

                if helpers._normalize_ticket_id(ticket_id):
                    ticket_link_response = connector.create(
                        "lnkFunctionalCIToTicket",
                        {
                            "ticket_id": int(ticket_id),
                            "functionalci_id": asset_id,
                            "impact_code": "manual",
                        },
                        output_fields="id,ticket_id,functionalci_id,impact_code",
                        comment=f"EC asociado desde acta {current_detail.get('documentNumber') or ''}".strip(),
                    )
                    if ticket_link_response.ok:
                        asset_result["ticketLinked"] = True
                    else:
                        raise HTTPException(
                            status_code=502,
                            detail=f"No fue posible relacionar el EC {asset_id} con el ticket iTop: {ticket_link_response.message}",
                        )

                results.append(asset_result)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"No fue posible actualizar la asignacion en iTop: {exc}") from exc
        finally:
            connector.close()

        return results

    def post_confirm(
        self,
        updated_document: dict[str, Any],
        *,
        assignment_updates: list[dict[str, Any]],
        itop_ticket: dict[str, Any],
    ) -> dict[str, Any]:
        del assignment_updates, itop_ticket
        return updated_document

    def create_handover_document(
        self,
        payload: dict[str, Any],
        session_user: dict[str, Any],
        runtime_token: str | None = None,
    ) -> dict[str, Any]:
        helpers = _helpers()
        creation_at = helpers._normalize_generated_at(payload.get("creationDate") or payload.get("generatedAt"))
        if runtime_token:
            self.validate_assets(
                payload,
                runtime_token=runtime_token,
                action_label="guardar el borrador",
                stage="draft",
            )
        document_number = helpers._generate_document_number(creation_at, self.type_definition.code)
        document_payload, item_payloads = helpers._normalize_handover_payload(
            {
                **payload,
                "handoverType": self.type_definition.label,
                "handoverTypeCode": self.type_definition.code,
                "creationDate": creation_at.strftime("%Y-%m-%dT%H:%M"),
                "generatedAt": creation_at.strftime("%Y-%m-%dT%H:%M"),
            },
            session_user,
            document_number=document_number,
            existing_document=None,
        )
        saved_document_id = helpers.save_handover_document(None, document_payload, item_payloads)
        helpers._persist_handover_item_evidences(
            saved_document_id,
            item_payloads,
            previous_detail=None,
            handover_type=self.type_definition.code,
        )
        return helpers.get_handover_document_detail(saved_document_id)

    def update_handover_document(
        self,
        document_id: int,
        payload: dict[str, Any],
        session_user: dict[str, Any],
        runtime_token: str | None = None,
    ) -> dict[str, Any]:
        helpers = _helpers()
        existing_document = helpers.fetch_handover_document_row(document_id)
        if not existing_document:
            raise HTTPException(status_code=404, detail="Acta no encontrada.")
        previous_detail = helpers.get_handover_document_detail(document_id)

        if runtime_token:
            self.validate_assets(
                payload,
                runtime_token=runtime_token,
                action_label="guardar el borrador",
                stage="draft",
            )

        document_payload, item_payloads = helpers._normalize_handover_payload(
            {
                **payload,
                "handoverType": self.type_definition.label,
                "handoverTypeCode": self.type_definition.code,
            },
            session_user,
            document_number=existing_document["document_number"],
            existing_document=existing_document,
        )
        target_status = helpers._coerce_str(payload.get("status"))
        if target_status == "Anulada":
            document_payload["generated_documents"] = None
        helpers.save_handover_document(document_id, document_payload, item_payloads)
        helpers._persist_handover_item_evidences(
            document_id,
            item_payloads,
            previous_detail=previous_detail,
            handover_type=self.type_definition.code,
        )
        if target_status == "Anulada":
            helpers.remove_generated_handover_documents(document_id, self.type_definition.code)
        return helpers.get_handover_document_detail(document_id)

    def emit_handover_document(self, document_id: int, session_user: dict[str, Any], session_id: str) -> dict[str, Any]:
        helpers = _helpers()
        from modules.auth.service import get_runtime_token as get_session_runtime_token

        existing_document = helpers.fetch_handover_document_row(document_id)
        if not existing_document:
            raise HTTPException(status_code=404, detail="Acta no encontrada.")

        current_status = helpers.STATUS_DB_TO_UI.get(existing_document["status"], existing_document["status"])
        if current_status != "En creacion":
            raise HTTPException(status_code=422, detail="Solo se puede emitir un acta en estado En creacion.")

        current_detail = helpers.get_handover_document_detail(document_id)
        runtime_token = get_session_runtime_token(session_id)

        helpers._validate_handover_receiver_rules(
            current_detail,
            type_definition=self.type_definition,
            action_label="emitir el acta",
        )
        helpers._validate_handover_items_ready_for_workflow(
            current_detail,
            action_label="emitir el acta",
            type_definition=self.type_definition,
        )
        self.pre_emit(current_detail, runtime_token)
        self.validate_assets(
            current_detail,
            runtime_token=runtime_token,
            action_label="emitir el acta",
            stage="emit",
        )

        job_id = helpers.create_job(
            document_id,
            "handover_emit",
            {
                "document_id": document_id,
            },
            session_id=session_id,
            owner_user_id=int(session_user["id"]),
            owner_name=str(session_user["name"]),
            module_code="handover",
            resource_type="handover_document",
        )

        return {
            "jobId": job_id,
            "status": "pending",
        }

    def rollback_handover_document(self, document_id: int, session_user: dict[str, Any]) -> dict[str, Any]:
        del session_user
        helpers = _helpers()

        existing_document = helpers.fetch_handover_document_row(document_id)
        if not existing_document:
            raise HTTPException(status_code=404, detail="Acta no encontrada.")

        current_status = helpers.STATUS_DB_TO_UI.get(existing_document["status"], existing_document["status"])
        if current_status != "Emitida":
            raise HTTPException(status_code=422, detail="Solo se puede cancelar la emision de un acta en estado Emitida.")

        current_detail = helpers.get_handover_document_detail(document_id)
        payload = {
            "generatedAt": current_detail.get("generatedAt") or current_detail.get("creationDate") or "",
            "creationDate": current_detail.get("creationDate") or current_detail.get("generatedAt") or "",
            "assignmentDate": "",
            "evidenceDate": current_detail.get("evidenceDate") or "",
            "generatedDocuments": [],
            "evidenceAttachments": current_detail.get("evidenceAttachments") or [],
            "status": "En creacion",
            "handoverType": self.type_definition.label,
            "handoverTypeCode": self.type_definition.code,
            "reason": current_detail.get("reason") or "",
            "notes": current_detail.get("notes") or "",
            "receiver": current_detail.get("receiver") or {},
            "additionalReceivers": current_detail.get("additionalReceivers") or [],
            "items": current_detail.get("items") or [],
        }
        updated_document = self.update_handover_document(
            document_id,
            payload,
            {"id": existing_document["owner_user_id"], "name": existing_document["owner_name"]},
        )
        helpers.remove_generated_handover_documents(document_id, self.type_definition.code)
        return updated_document

    def confirm_handover_document(
        self,
        document_id: int,
        attachments: list[dict[str, Any]],
        session_user: dict[str, Any],
        runtime_token: str,
        ticket_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        del session_user
        helpers = _helpers()

        existing_document = helpers.fetch_handover_document_row(document_id)
        if not existing_document:
            raise HTTPException(status_code=404, detail="Acta no encontrada.")

        current_status = helpers.STATUS_DB_TO_UI.get(existing_document["status"], existing_document["status"])
        if current_status not in {"Emitida", "Confirmada"}:
            raise HTTPException(status_code=422, detail="Solo se puede cargar evidencia sobre actas emitidas o confirmadas.")
        if not attachments:
            raise HTTPException(status_code=422, detail="Debes adjuntar al menos una evidencia.")
        if len(attachments) > helpers.MAX_HANDOVER_DOCUMENT_FILES:
            raise HTTPException(
                status_code=422,
                detail=f"Solo se permiten {helpers.MAX_HANDOVER_DOCUMENT_FILES} archivos por carga entre Acta y Detalle.",
            )

        storage_directory = helpers.build_handover_storage_directory(
            "evidence",
            document_id,
            self.type_definition.code,
        )
        storage_directory.mkdir(parents=True, exist_ok=True)
        helpers.logger.info(
            "Usando directorio de evidencia para acta %s (%s): %s",
            document_id,
            self.type_definition.code,
            storage_directory,
        )

        created_paths: list[Path] = []
        current_detail = helpers.get_handover_document_detail(document_id)
        helpers._validate_handover_items_ready_for_workflow(
            current_detail,
            action_label="confirmar el acta",
            type_definition=self.type_definition,
        )
        docs_settings = helpers.get_settings_panel("docs")
        ticket_rules = helpers._resolve_handover_ticket_rules(docs_settings)
        helpers._validate_handover_receiver_rules(
            current_detail,
            type_definition=self.type_definition,
            action_label="confirmar el acta",
        )
        if current_status == "Emitida":
            self.validate_assets(
                current_detail,
                runtime_token=runtime_token,
                action_label="confirmar el acta",
                stage="confirm",
            )
            self._validate_confirmation_documents(current_detail, attachments)
        now = datetime.now()
        evidence_at = now.strftime("%Y-%m-%dT%H:%M")
        document_number = helpers._coerce_str(current_detail.get("documentNumber"))
        if not document_number:
            raise HTTPException(status_code=422, detail="El acta no tiene un numero documental valido.")

        next_generated_documents = list(current_detail.get("generatedDocuments") or [])
        next_evidence_attachments = list(current_detail.get("evidenceAttachments") or [])
        existing_ticket = helpers._extract_itop_ticket_from_attachments(next_evidence_attachments)
        ticket_required = ticket_rules["enabled"]
        if (
            ticket_required
            and not helpers._normalize_ticket_id(existing_ticket.get("id") if existing_ticket else "")
            and not helpers._normalize_itop_ticket_summary(ticket_payload)
        ):
            raise HTTPException(
                status_code=422,
                detail="La configuracion actual exige registrar un Ticket iTop antes de confirmar el acta.",
            )
        itop_ticket = existing_ticket
        if ticket_required and not helpers._normalize_ticket_id(itop_ticket.get("id") if itop_ticket else ""):
            self.pre_ticket_creation(current_detail, runtime_token)
            itop_ticket = helpers._create_itop_handover_ticket(
                current_detail,
                ticket_payload,
                runtime_token,
                contact_ids=self.get_ticket_contact_ids(current_detail),
            )
        if ticket_required and not helpers._normalize_ticket_id(itop_ticket.get("id") if itop_ticket else ""):
            raise HTTPException(status_code=422, detail="No fue posible determinar el ticket iTop para registrar los adjuntos del acta.")
        assignment_updates = (
            self.handle_evidence_sync(
                current_detail,
                runtime_token,
                ticket_id=helpers._coerce_str(itop_ticket.get("id") if itop_ticket else ""),
            )
            if self.type_definition.sync_assignment_on_evidence
            else []
        )
        pending_files: list[dict[str, Path]] = []
        evidence_stored_names_to_delete: list[str] = []
        generated_stored_names_to_delete: list[str] = []
        processed_document_types: set[str] = set()
        allowed_extensions = helpers._get_allowed_evidence_extensions()

        try:
            for attachment in attachments:
                document_type = helpers._normalize_evidence_document_type(attachment.get("documentType"))
                if document_type in processed_document_types:
                    raise HTTPException(
                        status_code=422,
                        detail="Solo puedes cargar un archivo por tipo de documento entre Acta y Detalle.",
                    )
                processed_document_types.add(document_type)

                original_name = helpers._sanitize_attachment_filename(attachment.get("name"))
                file_extension = Path(original_name).suffix.lower().lstrip(".")
                if file_extension not in allowed_extensions:
                    allowed_label = ", ".join(f".{item}" for item in sorted(allowed_extensions))
                    raise HTTPException(
                        status_code=422,
                        detail=f"El archivo '{original_name}' no es valido para evidencia. Tipos permitidos: {allowed_label}.",
                    )
                raw_content = helpers._coerce_str(attachment.get("contentBase64"))
                try:
                    content = b64decode(raw_content, validate=True) if raw_content else b""
                except Exception as exc:
                    raise HTTPException(status_code=422, detail="Una de las evidencias adjuntas no tiene un formato valido.") from exc
                if not content:
                    raise HTTPException(status_code=422, detail="Una de las evidencias adjuntas no contiene datos validos.")

                suffix = Path(original_name).suffix
                stored_name = f"{helpers._build_evidence_document_code(document_number, document_type)}{suffix}"
                temporary_path = storage_directory / f".upload_{uuid4().hex}{suffix}"
                temporary_path.write_bytes(bytes(content))
                created_paths.append(temporary_path)
                pending_files.append(
                    {
                        "temporary": temporary_path,
                        "final": storage_directory / stored_name,
                    }
                )

                replaced_generated_documents = [
                    item
                    for item in next_generated_documents
                    if helpers._coerce_str(item.get("kind")) == helpers.EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND[document_type]
                ]
                next_generated_documents = [
                    item
                    for item in next_generated_documents
                    if helpers._coerce_str(item.get("kind")) != helpers.EVIDENCE_DOCUMENT_TYPE_TO_GENERATED_KIND[document_type]
                ]
                generated_stored_names_to_delete.extend(
                    [
                        helpers._coerce_str(item.get("storedName"))
                        for item in replaced_generated_documents
                        if helpers._coerce_str(item.get("storedName"))
                    ]
                )

                replaced_evidence_attachments = [
                    item
                    for item in next_evidence_attachments
                    if helpers._normalize_evidence_document_type(item.get("documentType"), allow_blank=True) == document_type
                ]
                next_evidence_attachments = [
                    item
                    for item in next_evidence_attachments
                    if helpers._normalize_evidence_document_type(item.get("documentType"), allow_blank=True) != document_type
                ]
                evidence_stored_names_to_delete.extend(
                    [
                        helpers._coerce_str(item.get("storedName"))
                        for item in replaced_evidence_attachments
                        if helpers._coerce_str(item.get("storedName"))
                        and Path(helpers._coerce_str(item.get("storedName"))).name != stored_name
                    ]
                )

                next_evidence_attachments.append(
                    {
                        "name": stored_name,
                        "size": helpers._format_attachment_size(len(content)),
                        "mimeType": helpers._coerce_str(attachment.get("mimeType")) or "application/octet-stream",
                        "source": helpers.build_handover_storage_source(
                            helpers.settings.env_name,
                            "evidence",
                            document_id,
                            self.type_definition.code,
                            stored_name,
                        ),
                        "storedName": stored_name,
                        "uploadedAt": evidence_at,
                        "documentType": document_type,
                        "observation": "",
                        "itopTicket": itop_ticket,
                        "itopAssignment": assignment_updates,
                    }
                )

            if len(next_generated_documents) + len(next_evidence_attachments) > helpers.MAX_HANDOVER_DOCUMENT_FILES:
                raise HTTPException(
                    status_code=422,
                    detail="El acta solo puede conservar un maximo total de 2 documentos entre generados y adjuntos.",
                )

            itop_attachment_updates: dict[str, Any] = {}
            if self.type_definition.attach_documents_on_evidence:
                itop_documents = helpers._build_itop_handover_document_files(
                    document_id,
                    self.type_definition.code,
                    next_generated_documents,
                    next_evidence_attachments,
                    pending_files,
                )
                itop_attachment_updates = helpers._attach_handover_documents_to_itop_targets(
                    current_detail,
                    runtime_token,
                    itop_ticket,
                    itop_documents,
                )
            next_evidence_attachments = [
                {
                    **item,
                    "itopAttachments": itop_attachment_updates,
                }
                for item in next_evidence_attachments
            ]

            document_payload = helpers._build_document_payload_from_detail(
                current_detail,
                existing_document,
                status_ui="Confirmada",
                assignment_date=current_detail.get("assignmentDate") or evidence_at,
                evidence_date=evidence_at,
                generated_documents=next_generated_documents,
                evidence_attachments=next_evidence_attachments,
            )
            item_payloads = helpers._build_item_payloads_from_detail(current_detail.get("items") or [])
            helpers.save_handover_document(document_id, document_payload, item_payloads)
            helpers._persist_handover_item_evidences(
                document_id,
                item_payloads,
                previous_detail=current_detail,
                handover_type=self.type_definition.code,
            )

            for pending_file in pending_files:
                pending_file["temporary"].replace(pending_file["final"])

            helpers.remove_generated_handover_documents_by_names(
                document_id,
                generated_stored_names_to_delete,
                self.type_definition.code,
            )
            helpers._remove_evidence_attachment_files(
                document_id,
                evidence_stored_names_to_delete,
                handover_type=self.type_definition.code,
            )
        except Exception:
            for path in created_paths:
                try:
                    if path.exists():
                        path.unlink()
                except OSError:
                    continue
            raise

        updated_document = helpers.get_handover_document_detail(document_id)
        return self.post_confirm(
            updated_document,
            assignment_updates=assignment_updates,
            itop_ticket=itop_ticket if isinstance(itop_ticket, dict) else {},
        )


class AssignedReceiverHandoverService(BaseHandoverService):
    def validate_assets(
        self,
        payload_or_detail: dict[str, Any],
        *,
        runtime_token: str,
        action_label: str,
        stage: str,
    ) -> None:
        helpers = _helpers()
        if stage == "draft":
            helpers._validate_draft_assets_ownership(
                payload_or_detail,
                runtime_token=runtime_token,
                type_definition=self.type_definition,
            )
            return
        if stage in {"emit", "confirm"}:
            helpers._validate_assets_match_receiver_assignment(
                payload_or_detail,
                runtime_token=runtime_token,
                type_definition=self.type_definition,
                action_label=action_label,
            )
