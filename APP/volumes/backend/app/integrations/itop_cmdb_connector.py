from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, ClassVar, Optional

import requests

logger = logging.getLogger(__name__)


class CIStatus(str, Enum):
    PRODUCTION = "production"
    IMPLEMENTATION = "implementation"
    OBSOLETE = "obsolete"
    STOCK = "stock"
    TEST = "test"
    INACTIVE = "inactive"
    ACTIVE = "active"


class PersonStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class Criticality(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class CIClass(str, Enum):
    SERVER = "Server"
    NETWORK_DEVICE = "NetworkDevice"
    PC = "PC"
    PRINTER = "Printer"
    PHONE = "Phone"
    VIRTUAL_MACHINE = "VirtualMachine"
    HYPERVISOR = "Hypervisor"
    FARM = "Farm"
    APPLICATION_SOLUTION = "ApplicationSolution"
    BUSINESS_PROCESS = "BusinessProcess"
    DB_SERVER = "DBServer"
    DATABASE_SCHEMA = "DatabaseSchema"
    MIDDLEWARE = "Middleware"
    WEB_SERVER = "WebServer"
    PERSON = "Person"
    TEAM = "Team"
    ORGANIZATION = "Organization"
    LOCATION = "Location"
    FUNCTIONAL_CI = "FunctionalCI"


@dataclass
class iTopObject:
    itop_class: str
    key: int
    fields: dict[str, Any]
    code: int = 0
    message: str = ""

    def __getitem__(self, attr: str) -> Any:
        return self.fields[attr]

    def get(self, attr: str, default: Any = None) -> Any:
        return self.fields.get(attr, default)

    @property
    def id(self) -> int:
        return self.key

    @property
    def name(self) -> str:
        return self.fields.get("name") or self.fields.get("friendlyname", "")

    def __repr__(self) -> str:
        return f"<iTopObject {self.itop_class}::{self.key} '{self.name}'>"


@dataclass
class iTopResponse:
    code: int
    message: str
    objects: dict[str, dict[str, Any]] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)

    ERROR_CODES: ClassVar[dict[int, str]] = {
        0: "OK",
        1: "UNAUTHORIZED",
        2: "MISSING_VERSION",
        3: "MISSING_JSON",
        4: "INVALID_JSON",
        5: "MISSING_AUTH_USER",
        6: "MISSING_AUTH_PWD",
        10: "UNSUPPORTED_VERSION",
        11: "UNKNOWN_OPERATION",
        12: "UNSAFE",
        100: "INTERNAL_ERROR",
    }

    @property
    def ok(self) -> bool:
        return self.code == 0

    @property
    def error_label(self) -> str:
        return self.ERROR_CODES.get(self.code, f"UNKNOWN_CODE_{self.code}")

    def items(self) -> list[iTopObject]:
        result: list[iTopObject] = []
        for raw_key, obj_data in (self.objects or {}).items():
            parts = str(raw_key).split("::")
            cls = parts[0] if len(parts) == 2 else obj_data.get("class", "Unknown")
            key = int(parts[1]) if len(parts) == 2 else int(obj_data.get("key", 0))
            result.append(
                iTopObject(
                    itop_class=obj_data.get("class", cls),
                    key=int(obj_data.get("key", key)),
                    fields=obj_data.get("fields", {}),
                    code=int(obj_data.get("code", 0)),
                    message=str(obj_data.get("message", "")),
                )
            )
        return result

    def first(self) -> Optional[iTopObject]:
        items = self.items()
        return items[0] if items else None

    def __len__(self) -> int:
        return len(self.objects or {})

    def __repr__(self) -> str:
        status = "OK" if self.ok else self.error_label
        return f"<iTopResponse [{status}] objects={len(self)} msg='{self.message}'>"


@dataclass
class AuthResult:
    authorized: bool
    has_token: bool
    token_valid: bool
    connector: Optional["iTopCMDBConnector"]
    username: str
    error: str = ""

    @property
    def ok(self) -> bool:
        return self.authorized and self.has_token and self.token_valid and self.connector is not None

    def __repr__(self) -> str:
        if self.ok:
            state = "READY"
        else:
            phases: list[str] = []
            if not self.authorized:
                phases.append("creds_fail")
            if not self.has_token:
                phases.append("no_token")
            if not self.token_valid:
                phases.append("token_invalid")
            state = f"FAILED({'+'.join(phases)})"
        return f"<AuthResult [{state}] user='{self.username}'>"


class AuthenticationError(Exception):
    pass


def build_env_token_store(default_token: str = "") -> Callable[[str], Optional[str]]:
    """
    Build a token resolver using environment variables.

    Resolution order:
    1. ITOP_AUTH_TOKEN_<USERNAME_UPPER>
    2. ITOP_AUTH_TOKEN
    3. default_token argument
    """

    def _token_store(username: str) -> Optional[str]:
        key = f"ITOP_AUTH_TOKEN_{username.upper().replace('-', '_').replace('.', '_')}"
        return os.getenv(key) or os.getenv("ITOP_AUTH_TOKEN") or default_token or None

    return _token_store


def _oql_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


class iTopCMDBConnector:
    API_VERSION = "1.3"
    REST_PATH = "/webservices/rest.php"

    def __init__(
        self,
        base_url: str,
        token: str,
        username: str = "",
        verify_ssl: bool = True,
        timeout: int = 30,
    ) -> None:
        if not token:
            raise ValueError("Token is required to instantiate iTopCMDBConnector.")
        if not base_url:
            raise ValueError("base_url is required.")

        self._url = base_url.rstrip("/") + self.REST_PATH
        self._token = token
        self._username = username
        self._verify = verify_ssl
        self._timeout = timeout
        self._session = requests.Session()

    @classmethod
    def from_env(cls) -> "iTopCMDBConnector":
        base_url = os.getenv("ITOP_URL", "")
        username = os.getenv("ITOP_REST_USER", "")
        password = os.getenv("ITOP_REST_PASSWORD", "")
        verify_ssl = os.getenv("ITOP_VERIFY_SSL", "1").lower() not in {"0", "false", "no"}
        timeout = int(os.getenv("ITOP_TIMEOUT_SECONDS", "30"))

        if not username or not password:
            raise AuthenticationError("ITOP_REST_USER and ITOP_REST_PASSWORD are required.")

        result = cls.authenticate(
            base_url=base_url,
            username=username,
            password=password,
            token_store=build_env_token_store(),
            verify_ssl=verify_ssl,
            timeout=timeout,
        )
        if not result.ok or result.connector is None:
            raise AuthenticationError(result.error or "Unable to authenticate against iTop.")
        return result.connector

    @classmethod
    def authenticate(
        cls,
        base_url: str,
        username: str,
        password: str,
        token_store: Callable[[str], Optional[str]],
        verify_ssl: bool = True,
        timeout: int = 30,
    ) -> AuthResult:
        if not base_url:
            return AuthResult(
                authorized=False,
                has_token=False,
                token_valid=False,
                connector=None,
                username=username,
                error="ITOP_URL/base_url is required.",
            )

        url = base_url.rstrip("/") + cls.REST_PATH

        logger.info("iTop auth phase 1: checking credentials for '%s'", username)
        try:
            response = requests.post(
                url,
                params={"version": cls.API_VERSION},
                data={
                    "auth_user": username,
                    "auth_pwd": password,
                    "json_data": json.dumps(
                        {
                            "operation": "core/check_credentials",
                            "user": username,
                            "password": password,
                        }
                    ),
                },
                verify=verify_ssl,
                timeout=timeout,
            )
            response.raise_for_status()
        except requests.exceptions.SSLError as exc:
            raise ConnectionError(
                f"SSL error while checking credentials: {exc}. "
                "Use verify_ssl=False for self-signed certificates."
            ) from exc
        except requests.exceptions.Timeout as exc:
            raise ConnectionError(f"iTop did not respond in {timeout}s while checking credentials.") from exc
        except requests.exceptions.RequestException as exc:
            raise ConnectionError(f"Network error while checking credentials: {exc}") from exc

        try:
            raw = response.json()
        except ValueError as exc:
            raise ConnectionError("iTop returned a non-JSON response during check_credentials.") from exc

        if raw.get("code", -1) != 0:
            error_codes = {
                1: "User has no REST profile or account is inactive.",
                5: "auth_user missing",
                6: "auth_pwd missing",
            }
            code = raw.get("code", -1)
            label = error_codes.get(code, str(raw.get("message", f"code {code}")))
            logger.warning("iTop check_credentials failed for '%s': %s", username, label)
            return AuthResult(
                authorized=False,
                has_token=False,
                token_valid=False,
                connector=None,
                username=username,
                error=f"iTop credential verification failed: {label}",
            )

        if not raw.get("authorized", False):
            logger.warning("Invalid credentials for '%s'", username)
            return AuthResult(
                authorized=False,
                has_token=False,
                token_valid=False,
                connector=None,
                username=username,
                error="Invalid credentials (username/password).",
            )

        logger.info("iTop auth phase 1 OK for '%s'", username)

        logger.info("iTop auth phase 2: resolving token for '%s'", username)
        try:
            token = token_store(username)
        except Exception as exc:
            logger.exception("Token store failed for '%s': %s", username, exc)
            return AuthResult(
                authorized=True,
                has_token=False,
                token_valid=False,
                connector=None,
                username=username,
                error=f"Token store failed: {exc}",
            )

        if not token:
            logger.warning("No token found for '%s'", username)
            return AuthResult(
                authorized=True,
                has_token=False,
                token_valid=False,
                connector=None,
                username=username,
                error=f"No token found for user '{username}'.",
            )

        logger.info("iTop auth phase 2 OK for '%s'", username)

        logger.info("iTop auth phase 3: validating token for '%s'", username)
        connector = cls(
            base_url=base_url,
            token=token,
            username=username,
            verify_ssl=verify_ssl,
            timeout=timeout,
        )

        if not connector.ping():
            logger.warning("Token rejected by iTop for '%s'", username)
            return AuthResult(
                authorized=True,
                has_token=True,
                token_valid=False,
                connector=None,
                username=username,
                error=(
                    f"Token found for '{username}' but iTop rejected it. "
                    "The token may be revoked/expired or the user has no REST profile."
                ),
            )

        logger.info("iTop auth phase 3 OK for '%s'", username)
        return AuthResult(
            authorized=True,
            has_token=True,
            token_valid=True,
            connector=connector,
            username=username,
        )

    def close(self) -> None:
        self._session.close()

    def __enter__(self) -> "iTopCMDBConnector":
        return self

    def __exit__(self, _exc_type: Any, _exc_val: Any, _exc_tb: Any) -> None:
        self.close()

    def _request(self, payload: dict[str, Any]) -> iTopResponse:
        try:
            response = self._session.post(
                self._url,
                params={"version": self.API_VERSION},
                data={"json_data": json.dumps(payload, ensure_ascii=False)},
                headers={"Auth-Token": self._token},
                verify=self._verify,
                timeout=self._timeout,
            )
            response.raise_for_status()
        except requests.exceptions.SSLError as exc:
            raise ConnectionError(f"SSL error while calling iTop: {exc}") from exc
        except requests.exceptions.Timeout as exc:
            raise TimeoutError(f"iTop did not respond in {self._timeout}s") from exc
        except requests.exceptions.RequestException as exc:
            raise ConnectionError(f"Network error while calling iTop: {exc}") from exc

        try:
            raw = response.json()
        except ValueError as exc:
            raise ConnectionError("iTop returned a non-JSON response.") from exc

        if not isinstance(raw, dict):
            raise ConnectionError("Unexpected iTop response format.")

        result = iTopResponse(
            code=int(raw.get("code", -1)),
            message=str(raw.get("message", "")),
            objects=raw.get("objects") or {},
            raw=raw,
        )

        if not result.ok:
            logger.warning(
                "[%s] iTop API error %s (%s): %s",
                self._username,
                result.code,
                result.error_label,
                result.message,
            )
        return result

    def get(self, itop_class: str | CIClass, key: int | str | dict[str, Any], output_fields: str = "*") -> iTopResponse:
        return self._request(
            {
                "operation": "core/get",
                "class": str(itop_class.value if isinstance(itop_class, CIClass) else itop_class),
                "key": key,
                "output_fields": output_fields,
            }
        )

    def create(
        self,
        itop_class: str | CIClass,
        fields: dict[str, Any],
        output_fields: str = "id,friendlyname",
        comment: str = "Created via iTopCMDBConnector",
    ) -> iTopResponse:
        return self._request(
            {
                "operation": "core/create",
                "class": str(itop_class.value if isinstance(itop_class, CIClass) else itop_class),
                "fields": fields,
                "output_fields": output_fields,
                "comment": comment,
            }
        )

    def update(
        self,
        itop_class: str | CIClass,
        key: int | str | dict[str, Any],
        fields: dict[str, Any],
        output_fields: str = "id,friendlyname",
        comment: str = "Updated via iTopCMDBConnector",
    ) -> iTopResponse:
        return self._request(
            {
                "operation": "core/update",
                "class": str(itop_class.value if isinstance(itop_class, CIClass) else itop_class),
                "key": key,
                "fields": fields,
                "output_fields": output_fields,
                "comment": comment,
            }
        )

    def delete(
        self,
        itop_class: str | CIClass,
        key: int | str | dict[str, Any],
        simulate: bool = True,
        comment: str = "Deleted via iTopCMDBConnector",
    ) -> iTopResponse:
        return self._request(
            {
                "operation": "core/delete",
                "class": str(itop_class.value if isinstance(itop_class, CIClass) else itop_class),
                "key": key,
                "simulate": simulate,
                "comment": comment,
            }
        )

    def apply_stimulus(
        self,
        itop_class: str | CIClass,
        key: int | str,
        stimulus: str,
        fields: Optional[dict[str, Any]] = None,
        output_fields: str = "id,friendlyname,status",
        comment: str = "Stimulus via iTopCMDBConnector",
    ) -> iTopResponse:
        payload: dict[str, Any] = {
            "operation": "core/apply_stimulus",
            "class": str(itop_class.value if isinstance(itop_class, CIClass) else itop_class),
            "key": key,
            "stimulus": stimulus,
            "output_fields": output_fields,
            "comment": comment,
        }
        if fields:
            payload["fields"] = fields
        return self._request(payload)

    def get_related(
        self,
        itop_class: str | CIClass,
        key: int | str,
        relation: str = "impacts",
        depth: int = 10,
        direction: str = "down",
        redundancy: bool = True,
    ) -> iTopResponse:
        return self._request(
            {
                "operation": "core/get_related",
                "class": str(itop_class.value if isinstance(itop_class, CIClass) else itop_class),
                "key": key,
                "relation": relation,
                "depth": depth,
                "direction": direction,
                "redundancy": redundancy,
            }
        )

    def list_cis(
        self,
        ci_class: str | CIClass = CIClass.FUNCTIONAL_CI,
        status: Optional[CIStatus] = None,
        org_id: Optional[int] = None,
        output_fields: str = "id,name,finalclass,org_id,friendlyname",
    ) -> list[iTopObject]:
        cls_str = ci_class.value if isinstance(ci_class, CIClass) else ci_class
        conditions: list[str] = []
        if status and cls_str != CIClass.FUNCTIONAL_CI.value:
            conditions.append(f"status = '{status.value if isinstance(status, CIStatus) else status}'")
        if org_id:
            conditions.append(f"org_id = {org_id}")
        where = " AND ".join(conditions)
        oql = f"SELECT {cls_str}" + (f" WHERE {where}" if where else "")
        return self.get(cls_str, oql, output_fields).items()

    def get_ci(self, ci_class: str | CIClass, ci_id: int, output_fields: str = "*") -> Optional[iTopObject]:
        return self.get(ci_class, ci_id, output_fields).first()

    def find_ci_by_name(self, ci_class: str | CIClass, name: str, output_fields: str = "*") -> list[iTopObject]:
        escaped_name = _oql_escape(name)
        cls_str = ci_class.value if isinstance(ci_class, CIClass) else ci_class
        return self.get(cls_str, f"SELECT {cls_str} WHERE name = '{escaped_name}'", output_fields).items()

    def create_server(
        self,
        name: str,
        org_id: int | str,
        status: CIStatus = CIStatus.PRODUCTION,
        criticality: Criticality = Criticality.MEDIUM,
        description: str = "",
        location_id: Optional[int | str] = None,
        extra_fields: Optional[dict[str, Any]] = None,
    ) -> iTopResponse:
        fields: dict[str, Any] = {
            "name": name,
            "org_id": org_id,
            "status": status.value,
            "business_criticity": criticality.value,
            "description": description,
        }
        if location_id:
            fields["location_id"] = location_id
        if extra_fields:
            fields.update(extra_fields)
        return self.create(CIClass.SERVER, fields)

    def create_virtual_machine(
        self,
        name: str,
        org_id: int | str,
        hypervisor_id: Optional[int | str] = None,
        status: CIStatus = CIStatus.PRODUCTION,
        criticality: Criticality = Criticality.MEDIUM,
        description: str = "",
        extra_fields: Optional[dict[str, Any]] = None,
    ) -> iTopResponse:
        fields: dict[str, Any] = {
            "name": name,
            "org_id": org_id,
            "status": status.value,
            "business_criticity": criticality.value,
            "description": description,
        }
        if hypervisor_id:
            fields["hypervisor_id"] = hypervisor_id
        if extra_fields:
            fields.update(extra_fields)
        return self.create(CIClass.VIRTUAL_MACHINE, fields)

    def update_ci_status(
        self,
        ci_class: str | CIClass,
        ci_id: int,
        status: CIStatus | str,
        comment: str = "Status changed via iTopCMDBConnector",
    ) -> iTopResponse:
        val = status.value if isinstance(status, CIStatus) else status
        return self.update(ci_class, ci_id, {"status": val}, comment=comment)

    def get_ci_impact(self, ci_class: str | CIClass, ci_id: int, depth: int = 5) -> dict[str, list[iTopObject]]:
        resp = self.get_related(ci_class, ci_id, "impacts", depth=depth, direction="down")
        grouped: dict[str, list[iTopObject]] = {}
        for obj in resp.items():
            grouped.setdefault(obj.itop_class, []).append(obj)
        return grouped

    def link_contact_to_ci(self, ci_class: str | CIClass, ci_id: int, contact_id: int) -> iTopResponse:
        contacts_list: list[dict[str, Any]] = [{"contact_id": contact_id}]
        return self.update(
            ci_class,
            ci_id,
            {"contacts_list": contacts_list},
            comment="Contact linked via iTopCMDBConnector",
        )

    def list_persons(
        self,
        org_id: Optional[int] = None,
        status: PersonStatus = PersonStatus.ACTIVE,
        output_fields: str = "id,name,first_name,email,phone,function,org_id,status",
    ) -> list[iTopObject]:
        conditions = [f"status = '{status.value}'"]
        if org_id:
            conditions.append(f"org_id = {org_id}")
        oql = f"SELECT Person WHERE {' AND '.join(conditions)}"
        return self.get(CIClass.PERSON, oql, output_fields).items()

    def get_person(self, person_id: int, output_fields: str = "*") -> Optional[iTopObject]:
        return self.get(CIClass.PERSON, person_id, output_fields).first()

    def find_person(
        self,
        name: Optional[str] = None,
        first_name: Optional[str] = None,
        email: Optional[str] = None,
        output_fields: str = "id,name,first_name,email,phone,function,org_id",
    ) -> list[iTopObject]:
        conditions: list[str] = []
        if name:
            conditions.append(f"name LIKE '%{_oql_escape(name)}%'")
        if first_name:
            conditions.append(f"first_name LIKE '%{_oql_escape(first_name)}%'")
        if email:
            conditions.append(f"email = '{_oql_escape(email)}'")
        if not conditions:
            raise ValueError("Provide at least one criterion: name, first_name, or email.")
        return self.get(CIClass.PERSON, f"SELECT Person WHERE {' AND '.join(conditions)}", output_fields).items()

    def create_person(
        self,
        name: str,
        first_name: str,
        org_id: int | str,
        email: str = "",
        phone: str = "",
        mobile: str = "",
        function: str = "",
        employee_number: str = "",
        manager_id: Optional[int | str] = None,
        location_id: Optional[int | str] = None,
        status: PersonStatus = PersonStatus.ACTIVE,
        notification: str = "no",
        extra_fields: Optional[dict[str, Any]] = None,
    ) -> iTopResponse:
        fields: dict[str, Any] = {
            "name": name,
            "first_name": first_name,
            "org_id": org_id,
            "status": status.value,
            "notification": notification,
        }
        if email:
            fields["email"] = email
        if phone:
            fields["phone"] = phone
        if mobile:
            fields["mobile"] = mobile
        if function:
            fields["function"] = function
        if employee_number:
            fields["employee_number"] = employee_number
        if manager_id:
            fields["manager_id"] = manager_id
        if location_id:
            fields["location_id"] = location_id
        if extra_fields:
            fields.update(extra_fields)
        return self.create(CIClass.PERSON, fields)

    def update_person(self, person_id: int, fields: dict[str, Any], comment: str = "Updated via iTopCMDBConnector") -> iTopResponse:
        return self.update(CIClass.PERSON, person_id, fields, comment=comment)

    def deactivate_person(self, person_id: int) -> iTopResponse:
        return self.update(
            CIClass.PERSON,
            person_id,
            {"status": PersonStatus.INACTIVE.value},
            comment="Deactivated via iTopCMDBConnector",
        )

    def get_person_cis(self, person_id: int, output_fields: str = "id,name,status,finalclass") -> list[iTopObject]:
        oql = (
            "SELECT FunctionalCI AS f "
            "JOIN lnkContactToFunctionalCI AS l ON l.functionalci_id = f.id "
            f"WHERE l.contact_id = {person_id}"
        )
        return self.get(CIClass.FUNCTIONAL_CI, oql, output_fields).items()

    def get_person_tickets(
        self,
        person_id: int,
        ticket_class: str = "UserRequest",
        output_fields: str = "id,ref,title,status,start_date",
    ) -> list[iTopObject]:
        return self.get(ticket_class, f"SELECT {ticket_class} WHERE caller_id = {person_id}", output_fields).items()

    def list_teams(self, org_id: Optional[int] = None, output_fields: str = "id,name,email,phone,function,org_id,status") -> list[iTopObject]:
        oql = "SELECT Team" + (f" WHERE org_id = {org_id}" if org_id else "")
        return self.get(CIClass.TEAM, oql, output_fields).items()

    def create_team(
        self,
        name: str,
        org_id: int | str,
        email: str = "",
        phone: str = "",
        function: str = "",
        extra_fields: Optional[dict[str, Any]] = None,
    ) -> iTopResponse:
        fields: dict[str, Any] = {"name": name, "org_id": org_id, "status": "active"}
        if email:
            fields["email"] = email
        if phone:
            fields["phone"] = phone
        if function:
            fields["function"] = function
        if extra_fields:
            fields.update(extra_fields)
        return self.create(CIClass.TEAM, fields)

    def add_person_to_team(self, team_id: int, person_id: int, role: str = "") -> iTopResponse:
        member_entry: dict[str, Any] = {"person_id": person_id}
        if role:
            member_entry["role"] = role
        return self.update(
            CIClass.TEAM,
            team_id,
            {"persons_list": [member_entry]},
            comment="Member added via iTopCMDBConnector",
        )

    def list_organizations(self, output_fields: str = "id,name,code,status") -> list[iTopObject]:
        return self.get(CIClass.ORGANIZATION, "SELECT Organization", output_fields).items()

    def list_locations(
        self,
        org_id: Optional[int] = None,
        output_fields: str = "id,name,org_id,address,city,country",
    ) -> list[iTopObject]:
        oql = "SELECT Location" + (f" WHERE org_id = {org_id}" if org_id else "")
        return self.get(CIClass.LOCATION, oql, output_fields).items()

    def oql(self, query: str, output_fields: str = "*") -> list[iTopObject]:
        tokens = query.strip().split()
        if len(tokens) < 2 or tokens[0].upper() != "SELECT":
            raise ValueError("OQL query must start with: SELECT ClassName ...")
        ci_class = tokens[1].rstrip(",")
        return self.get(ci_class, query, output_fields).items()

    def list_operations(self) -> iTopResponse:
        return self._request({"operation": "list_operations"})

    def ping(self) -> bool:
        try:
            return self.list_operations().ok
        except Exception as exc:
            logger.error("[%s] iTop ping failed: %s", self._username, exc)
            return False

    def whoami(self) -> str:
        return self._username

    def rotate_token(self, new_token: str) -> None:
        if not new_token:
            raise ValueError("new_token cannot be empty.")
        self._token = new_token
        logger.info("[%s] token rotated successfully", self._username)
