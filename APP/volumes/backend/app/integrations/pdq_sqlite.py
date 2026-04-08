import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class PDQError(Exception):
    """Base exception for PDQ integration errors."""


class PDQDatabaseUnavailableError(PDQError):
    """Raised when the configured SQLite database cannot be located."""


class PDQSchemaUnsupportedError(PDQError):
    """Raised when the SQLite schema cannot be mapped to the PDQ UI."""


MAC_FIELD_ALIASES = (
    "mac",
    "macaddress",
    "physicaladdress",
    "macaddr",
    "networkmac",
    "nicmac",
)

HOSTNAME_FIELD_ALIASES = (
    "hostname",
    "host",
    "computername",
    "devicename",
    "dnsname",
    "name",
)

DEVICE_FIELD_ALIASES = (
    "device",
    "computermodel",
    "model",
    "devicemodel",
    "systemmodel",
)

BRAND_FIELD_ALIASES = (
    "manufacturer",
    "manufactured",
    "vendor",
    "make",
    "brand",
)

OS_FIELD_ALIASES = (
    "osname",
    "operatingsystem",
    "oscaption",
    "os",
    "systemoperatingsystem",
)

USER_FIELD_ALIASES = (
    "currentuser",
    "currentusername",
    "loggedonuser",
    "username",
    "lastuser",
    "user",
)

USER_DISPLAY_ALIASES = (
    "displayname",
    "addisplayname",
    "fullname",
    "fullusername",
    "firstname",
    "lastname",
    "adfirstname",
    "adlastname",
)

IP_FIELD_ALIASES = (
    "ip",
    "ipaddress",
    "ipv4address",
    "address",
)

INTERFACE_NAME_ALIASES = (
    "name",
    "interfacename",
    "adaptername",
    "networkadapter",
    "description",
)

INTERFACE_STATUS_ALIASES = (
    "netconnectionstatus",
    "connectionstatus",
    "status",
    "connected",
    "isactive",
    "active",
    "online",
)

LAST_SEEN_ALIASES = (
    "lastseen",
    "lastscan",
    "lastscanned",
    "lastonline",
    "lastupdated",
    "updatedat",
    "scandate",
    "timestamp",
)

RAM_ALIASES = (
    "memoryram",
    "ram",
    "totalmemory",
    "physicalmemory",
)

DOMAIN_ALIASES = (
    "domain",
    "activedirectorydomain",
    "addomain",
)

AD_USER_ALIASES = (
    "aduser",
    "active_directory_user",
    "activedirectoryuser",
    "domainuser",
)

DESCRIPTION_ALIASES = (
    "descriptionad",
    "addescription",
    "description",
    "computerdescription",
)

PROCESSOR_ALIASES = (
    "processorsummary",
    "processor",
    "cpu",
    "cpuname",
)

PROCESSOR_DESCRIPTION_ALIASES = (
    "processordescription",
    "cpudescription",
)


@dataclass(frozen=True)
class PDQConfig:
    enabled: bool
    sqlite_dir: str
    sqlite_file_name: str
    sqlite_file_glob: str
    search_min_chars: int


def read_pdq_config() -> PDQConfig:
    return PDQConfig(
        enabled=_read_bool("PDQ_ENABLED", default=True),
        sqlite_dir=os.getenv("PDQ_SQLITE_DIR", "/app/data/pdq"),
        sqlite_file_name=os.getenv("PDQ_SQLITE_FILE_NAME", "").strip(),
        sqlite_file_glob=os.getenv("PDQ_SQLITE_FILE_GLOB", "*.db;*.sqlite;*.sqlite3").strip(),
        search_min_chars=_read_int("PDQ_SEARCH_MIN_CHARS", default=2),
    )


def get_pdq_status(config: PDQConfig | None = None) -> dict[str, Any]:
    config = config or read_pdq_config()
    sqlite_dir = Path(config.sqlite_dir)
    directory_exists = sqlite_dir.exists() and sqlite_dir.is_dir()
    candidate_files = _find_candidate_files(sqlite_dir, config)
    selected_file = candidate_files[0] if candidate_files else None

    return {
        "enabled": config.enabled,
        "sqlite_dir": str(sqlite_dir),
        "sqlite_file_name": config.sqlite_file_name,
        "sqlite_file_glob": config.sqlite_file_glob,
        "search_min_chars": config.search_min_chars,
        "search_modes": ["hostname", "mac", "user"],
        "directory_exists": directory_exists,
        "database_available": selected_file is not None,
        "selected_file": _serialize_file(selected_file),
        "candidate_files": [_serialize_file(candidate) for candidate in candidate_files[:5]],
    }


def search_devices(query: str, config: PDQConfig | None = None) -> dict[str, Any]:
    config = config or read_pdq_config()
    raw_query = query.strip()
    normalized_mac_query = normalize_mac(raw_query)
    normalized_hostname_query = raw_query.lower()
    status = get_pdq_status(config)

    if not config.enabled:
        raise PDQDatabaseUnavailableError("La integracion PDQ esta deshabilitada.")

    if max(len(normalized_mac_query), len(normalized_hostname_query)) < config.search_min_chars:
        raise PDQError(
            f"La busqueda requiere al menos {config.search_min_chars} caracteres utiles de nombre, MAC o usuario."
        )

    selected_file = status["selected_file"]
    if not selected_file:
        raise PDQDatabaseUnavailableError(
            "No se encontro una base SQLite de PDQ en la carpeta configurada."
        )

    db_path = selected_file["path"]
    connection = _open_readonly_connection(db_path)
    try:
        schema_results = _search_pdq_inventory_schema(
            connection,
            raw_query=raw_query,
            normalized_mac_query=normalized_mac_query,
            normalized_hostname_query=normalized_hostname_query,
        )
        if schema_results is not None:
            return {
                "database": selected_file,
                "query": raw_query,
                "normalized_mac_query": normalized_mac_query,
                "normalized_hostname_query": normalized_hostname_query,
                "results": schema_results,
                "warnings": [] if schema_results else ["No se encontraron equipos para el nombre, la MAC o el usuario consultado en la base detectada."],
            }

        sources = _discover_candidate_sources(connection)
        if not sources:
            raise PDQSchemaUnsupportedError(
                "La base fue detectada, pero no se encontro una tabla o vista con columnas compatibles para buscar por nombre, MAC o usuario."
            )

        warnings: list[str] = []
        grouped_results: dict[str, dict[str, Any]] = {}

        for source in sources:
            rows = _query_source(connection, source, normalized_mac_query, normalized_hostname_query)
            if not rows:
                continue

            for row in rows:
                mapped = _map_row(source["name"], source["column_names"], row)
                group_key = mapped["group_key"]
                current = grouped_results.get(group_key)

                if current is None:
                    grouped_results[group_key] = mapped
                    continue

                _merge_results(current, mapped)

        results = sorted(
            grouped_results.values(),
            key=lambda item: (
                item.get("lastSeenSortKey") or "",
                item.get("hostname") or "",
                item.get("matchedMac") or "",
            ),
            reverse=True,
        )

        for result in results:
            result.pop("group_key", None)
            result.pop("lastSeenSortKey", None)

        if not results:
            warnings.append("No se encontraron equipos para el nombre o la MAC consultada en la base detectada.")

        return {
            "database": selected_file,
            "query": raw_query,
            "normalized_mac_query": normalized_mac_query,
            "normalized_hostname_query": normalized_hostname_query,
            "results": results,
            "warnings": warnings,
        }
    finally:
        connection.close()


def normalize_mac(value: str) -> str:
    return "".join(char for char in value.upper() if char.isalnum())


def _read_bool(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _read_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _find_candidate_files(sqlite_dir: Path, config: PDQConfig) -> list[Path]:
    if not sqlite_dir.exists() or not sqlite_dir.is_dir():
        return []

    candidates: list[Path] = []

    if config.sqlite_file_name:
        exact_path = sqlite_dir / config.sqlite_file_name
        if exact_path.exists() and exact_path.is_file():
            candidates.append(exact_path)

    if not candidates:
        for pattern in [item.strip() for item in config.sqlite_file_glob.split(";") if item.strip()]:
            candidates.extend(path for path in sqlite_dir.glob(pattern) if path.is_file())

    unique_candidates = {candidate.resolve(): candidate for candidate in candidates}
    return sorted(
        unique_candidates.values(),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )


def _serialize_file(path: Path | None) -> dict[str, Any] | None:
    if path is None:
        return None

    stats = path.stat()
    created_at = datetime.fromtimestamp(stats.st_ctime, tz=timezone.utc)
    modified_at = datetime.fromtimestamp(stats.st_mtime, tz=timezone.utc)
    observed_at = created_at if created_at >= modified_at else modified_at
    return {
        "name": path.name,
        "path": str(path),
        "size_bytes": stats.st_size,
        "created_at": created_at.isoformat(),
        "modified_at": modified_at.isoformat(),
        "observed_at": observed_at.isoformat(),
    }


def _open_readonly_connection(path: str) -> sqlite3.Connection:
    # Windows bind mounts can reject SQLite locking semantics in containers.
    # The PDQ database is treated as a cloned, read-only snapshot, so immutable=1
    # avoids write/lock expectations while keeping the connection read-only.
    connection = sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def _discover_candidate_sources(connection: sqlite3.Connection) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    rows = connection.execute(
        """
        SELECT name, type
        FROM sqlite_master
        WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
        ORDER BY type, name
        """
    ).fetchall()

    for row in rows:
        source_name = row["name"]
        pragma_rows = connection.execute(f'PRAGMA table_info("{source_name}")').fetchall()
        column_names = [pragma_row["name"] for pragma_row in pragma_rows]
        normalized_columns = [_normalize_column_name(column_name) for column_name in column_names]

        mac_columns = [
            column_name
            for column_name, normalized_name in zip(column_names, normalized_columns)
            if _matches_alias(normalized_name, MAC_FIELD_ALIASES)
        ]

        hostname_columns = [
            column_name
            for column_name, normalized_name in zip(column_names, normalized_columns)
            if _matches_alias(normalized_name, HOSTNAME_FIELD_ALIASES)
        ]

        user_columns = [
            column_name
            for column_name, normalized_name in zip(column_names, normalized_columns)
            if _matches_alias(normalized_name, USER_FIELD_ALIASES + USER_DISPLAY_ALIASES)
        ]

        if not mac_columns and not hostname_columns and not user_columns:
            continue

        score = 0
        score += len(mac_columns) * 5
        score += len(hostname_columns) * 4
        score += len(user_columns) * 4
        score += _count_matches(normalized_columns, OS_FIELD_ALIASES) * 3
        score += _count_matches(normalized_columns, USER_FIELD_ALIASES) * 2
        score += _count_matches(normalized_columns, IP_FIELD_ALIASES) * 2
        score += _count_matches(normalized_columns, LAST_SEEN_ALIASES) * 2
        score += _count_matches(normalized_columns, INTERFACE_STATUS_ALIASES)

        sources.append(
            {
                "name": source_name,
                "type": row["type"],
                "column_names": column_names,
                "mac_columns": mac_columns,
                "hostname_columns": hostname_columns,
                "user_columns": user_columns,
                "score": score,
            }
        )

    return sorted(sources, key=lambda item: item["score"], reverse=True)[:8]


def _query_source(
    connection: sqlite3.Connection,
    source: dict[str, Any],
    normalized_mac_query: str,
    normalized_hostname_query: str,
) -> list[sqlite3.Row]:
    clauses: list[str] = []
    params: list[str] = []

    if normalized_mac_query:
        for column_name in source["mac_columns"]:
            expression = _build_normalized_sql(column_name)
            clauses.append(f"{expression} LIKE ?")
            params.append(f"%{normalized_mac_query}%")

    if normalized_hostname_query:
        for column_name in source["hostname_columns"]:
            clauses.append(f'lower(coalesce("{column_name}", \'\')) LIKE ?')
            params.append(f"%{normalized_hostname_query}%")

        for column_name in source.get("user_columns", []):
            clauses.append(f'lower(coalesce("{column_name}", \'\')) LIKE ?')
            params.append(f"%{normalized_hostname_query}%")

    if not clauses:
        return []

    statement = f'SELECT * FROM "{source["name"]}" WHERE {" OR ".join(clauses)} LIMIT 250'
    return connection.execute(statement, params).fetchall()


def _build_normalized_sql(column_name: str) -> str:
    quoted_column = f'"{column_name}"'
    return (
        "upper("
        f"replace(replace(replace(replace(replace(replace(coalesce({quoted_column}, ''), ':', ''), '-', ''), '.', ''), ' ', ''), '/', ''), '\\\\', '')"
        ")"
    )


def _map_row(source_name: str, column_names: list[str], row: sqlite3.Row) -> dict[str, Any]:
    record = {column_name: row[column_name] for column_name in column_names}
    hostname = _pick_value(record, HOSTNAME_FIELD_ALIASES)
    brand = _pick_value(record, BRAND_FIELD_ALIASES)
    model = _pick_value(record, DEVICE_FIELD_ALIASES)
    device_label = _compose_device_label(brand, model)
    current_user = _pick_value(record, USER_FIELD_ALIASES)
    current_user_common_name = _compose_ad_common_name(
        _pick_value(record, USER_DISPLAY_ALIASES),
        record.get("ADFirstName") or record.get("FirstName"),
        record.get("ADLastName") or record.get("LastName"),
    )
    mac_address = _pick_value(record, MAC_FIELD_ALIASES)
    ip_address = _pick_value(record, IP_FIELD_ALIASES)
    operating_system = _pick_value(record, OS_FIELD_ALIASES)
    last_seen = _pick_value(record, LAST_SEEN_ALIASES)
    interface_name = _pick_value(record, INTERFACE_NAME_ALIASES)
    interface_status = _format_connection_status(_pick_value(record, INTERFACE_STATUS_ALIASES))
    processor = _pick_value(record, PROCESSOR_ALIASES)
    processor_description = _pick_value(record, PROCESSOR_DESCRIPTION_ALIASES)

    interfaces = []
    if any([interface_name, mac_address, ip_address, interface_status]):
        interfaces.append(
            {
                "name": interface_name or "Interfaz detectada",
                "macAddress": mac_address or "N/D",
                "manufacturer": brand or "N/D",
                "netConnectionStatus": interface_status or "N/D",
                "ipAddress": ip_address or "N/D",
            }
        )

    return {
        "id": f"{source_name}:{hostname or mac_address or id(row)}",
        "group_key": f"{source_name}:{hostname or normalize_mac(str(mac_address or '')) or id(row)}",
        "source": source_name,
        "hostname": hostname or "Equipo sin nombre",
        "device": device_label or "Equipo detectado",
        "brand": brand or "N/D",
        "model": model or "N/D",
        "osName": operating_system or "N/D",
        "currentUser": current_user or "N/D",
        "currentUserCommonName": current_user_common_name,
        "matchedMac": mac_address or "N/D",
        "network": {
            "active": "Si" if interface_status and interface_status.lower() == "connected" else "No",
            "mac": mac_address or "N/D",
            "ip": ip_address or "N/D",
        },
        "descriptionAd": _pick_value(record, DESCRIPTION_ALIASES) or "N/D",
        "domain": _pick_value(record, DOMAIN_ALIASES) or "N/D",
        "adUser": _pick_value(record, AD_USER_ALIASES) or current_user or "N/D",
        "user": current_user or "N/D",
        "macActive": mac_address or "N/D",
        "ipAddress": ip_address or "N/D",
        "lastSeen": _stringify_value(last_seen) or "N/D",
        "lastSeenSortKey": _sortable_value(last_seen),
        "ram": _stringify_value(_pick_value(record, RAM_ALIASES)) or "N/D",
        "operatingSystem": operating_system or "N/D",
        "processor": processor or "N/D",
        "processorDescription": processor_description or "N/D",
        "adWhenCreated": "N/D",
        "pdqRegisteredAt": "N/D",
        "lastSuccessfulScan": "N/D",
        "lastScanAttempt": "N/D",
        "heartbeatDate": "N/D",
        "lastOnlineTime": "N/D",
        "lastOfflineTime": "N/D",
        "adLastLogon": "N/D",
        "ouPath": "N/D",
        "hostnameNamingType": _classify_hostname(hostname or ""),
        "interfaces": interfaces,
    }


def _merge_results(current: dict[str, Any], incoming: dict[str, Any]) -> None:
    for key in (
        "device",
        "brand",
        "model",
        "osName",
        "currentUser",
        "descriptionAd",
        "domain",
        "adUser",
        "user",
        "macActive",
        "ipAddress",
        "lastSeen",
        "operatingSystem",
        "processor",
        "processorDescription",
        "ram",
    ):
        if current.get(key) in {"", "N/D", None} and incoming.get(key) not in {"", "N/D", None}:
            current[key] = incoming[key]

    if not current.get("lastSeenSortKey") and incoming.get("lastSeenSortKey"):
        current["lastSeenSortKey"] = incoming["lastSeenSortKey"]

    if incoming["network"]["mac"] != "N/D":
        current["network"] = incoming["network"]
        current["matchedMac"] = incoming["matchedMac"]
        current["macActive"] = incoming["macActive"]
        current["ipAddress"] = incoming["ipAddress"]

    known_signatures = {
        (
            interface.get("name"),
            interface.get("macAddress"),
            interface.get("ipAddress"),
            interface.get("netConnectionStatus"),
        )
        for interface in current["interfaces"]
    }

    for interface in incoming["interfaces"]:
        signature = (
            interface.get("name"),
            interface.get("macAddress"),
            interface.get("ipAddress"),
            interface.get("netConnectionStatus"),
        )
        if signature not in known_signatures:
            current["interfaces"].append(interface)
            known_signatures.add(signature)


def _compose_device_label(brand: Any, model: Any) -> str:
    brand_text = _stringify_value(brand)
    model_text = _stringify_value(model)

    if brand_text and model_text:
        return f"Marca: {brand_text} / Modelo: {model_text}"
    if model_text:
        return model_text
    if brand_text:
        return brand_text
    return ""


def _format_connection_status(value: Any) -> str:
    if value is None:
        return ""

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "si", "connected", "up", "online"}:
        return "Connected"
    if normalized in {"0", "false", "no", "disconnected", "down", "offline"}:
        return "Disconnected"
    return _stringify_value(value)


def _pick_value(record: dict[str, Any], aliases: tuple[str, ...]) -> Any:
    normalized_lookup = {
        _normalize_column_name(column_name): column_name for column_name in record.keys()
    }

    for alias in aliases:
        for normalized_name, original_name in normalized_lookup.items():
            if _matches_alias(normalized_name, (alias,)):
                value = record[original_name]
                if value not in (None, ""):
                    return value
    return None


def _normalize_column_name(column_name: str) -> str:
    return "".join(char for char in column_name.lower() if char.isalnum())


def _matches_alias(normalized_name: str, aliases: tuple[str, ...]) -> bool:
    return any(alias in normalized_name for alias in aliases)


def _count_matches(normalized_columns: list[str], aliases: tuple[str, ...]) -> int:
    return sum(1 for normalized_name in normalized_columns if _matches_alias(normalized_name, aliases))


def _stringify_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _compose_ad_common_name(display_name: Any, first_name: Any, last_name: Any) -> str:
    direct_value = _stringify_value(display_name)
    if direct_value:
        return direct_value

    composed_value = " ".join(
        part for part in (_stringify_value(first_name), _stringify_value(last_name)) if part
    )
    return composed_value or "N/D"


def _sortable_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def _search_pdq_inventory_schema(
    connection: sqlite3.Connection,
    raw_query: str,
    normalized_mac_query: str,
    normalized_hostname_query: str,
) -> list[dict[str, Any]] | None:
    if not _table_exists(connection, "Computers"):
        return None

    where_clauses: list[str] = []
    params: list[str] = []

    if normalized_hostname_query:
        for column_name in ("HostName", "Name"):
            if _column_exists(connection, "Computers", column_name):
                where_clauses.append(f'lower(coalesce(c."{column_name}", \'\')) LIKE ?')
                params.append(f"%{normalized_hostname_query}%")

        for column_name in ("CurrentUser", "ADDisplayName"):
            if _column_exists(connection, "Computers", column_name):
                where_clauses.append(f'lower(coalesce(c."{column_name}", \'\')) LIKE ?')
                params.append(f"%{normalized_hostname_query}%")

        if _column_exists(connection, "Computers", "ADFirstName") and _column_exists(connection, "Computers", "ADLastName"):
            where_clauses.append(
                'lower(trim(coalesce(c."ADFirstName", \'\') || \' \' || coalesce(c."ADLastName", \'\'))) LIKE ?'
            )
            params.append(f"%{normalized_hostname_query}%")

    if normalized_mac_query:
        if _column_exists(connection, "Computers", "MacAddress"):
            where_clauses.append(f"{_build_normalized_sql_for_alias('c', 'MacAddress')} LIKE ?")
            params.append(f"%{normalized_mac_query}%")

        if _table_exists(connection, "NetworkAdapters") and _column_exists(connection, "NetworkAdapters", "MacAddress"):
            where_clauses.append(
                """
                EXISTS (
                  SELECT 1
                  FROM "NetworkAdapters" na
                  WHERE na."ComputerId" = c."ComputerId"
                    AND """
                + f"{_build_normalized_sql_for_alias('na', 'MacAddress')} LIKE ?"
                + ")"
            )
            params.append(f"%{normalized_mac_query}%")

    if not where_clauses:
        return []

    computer_rows = connection.execute(
        """
        SELECT c.*
        FROM "Computers" c
        WHERE """
        + " OR ".join(where_clauses)
        + """
        ORDER BY coalesce(c."SuccessfulScanDate", c."AttemptedScanDate", c."Added") DESC
        LIMIT 50
        """,
        params,
    ).fetchall()

    return [_build_pdq_inventory_result(connection, row, raw_query, normalized_mac_query) for row in computer_rows]


def _build_pdq_inventory_result(
    connection: sqlite3.Connection,
    computer_row: sqlite3.Row,
    raw_query: str,
    normalized_mac_query: str,
) -> dict[str, Any]:
    computer_id = computer_row["ComputerId"]
    adapters = _fetch_network_adapters(connection, computer_id)
    hostname = _first_present(computer_row["HostName"], computer_row["Name"], "Equipo sin nombre")
    matched_adapter = _find_matching_adapter(adapters, normalized_mac_query)
    primary_adapter = matched_adapter or _find_primary_adapter(adapters)

    ip_address = _first_present(
        _get_adapter_ip(primary_adapter),
        computer_row["IPAddress"],
        "N/D",
    )
    mac_address = _first_present(
        primary_adapter.get("macAddress") if primary_adapter else None,
        computer_row["MacAddress"],
        "N/D",
    )
    interface_status = primary_adapter.get("netConnectionStatus") if primary_adapter else ""
    is_online = _boolish(computer_row["IsOnline"])
    current_user = _stringify_value(computer_row["CurrentUser"]) or "N/D"
    current_user_common_name = _compose_ad_common_name(
        computer_row["ADDisplayName"],
        computer_row["ADFirstName"],
        computer_row["ADLastName"],
    )

    return {
        "id": f'Computers:{computer_id}',
        "source": "Computers",
        "hostname": hostname,
        "device": _compose_device_label(computer_row["Manufacturer"], computer_row["Model"]) or "Equipo detectado",
        "brand": _stringify_value(computer_row["Manufacturer"]) or "N/D",
        "model": _stringify_value(computer_row["Model"]) or "N/D",
        "osName": _stringify_value(computer_row["OSName"]) or "N/D",
        "currentUser": current_user,
        "currentUserCommonName": current_user_common_name,
        "matchedMac": mac_address,
        "network": {
            "active": "Si" if is_online or (interface_status and interface_status.lower() == "connected") else "No",
            "mac": mac_address,
            "ip": ip_address,
        },
        "descriptionAd": _stringify_value(computer_row["ADDescription"]) or _stringify_value(computer_row["Description"]) or "N/D",
        "domain": _stringify_value(computer_row["ADDomain"]) or _extract_domain_from_dn(computer_row["ADDistinguishedName"]) or "N/D",
        "adUser": current_user,
        "user": current_user,
        "macActive": mac_address,
        "ipAddress": ip_address,
        "lastSeen": _first_present(
            computer_row["SuccessfulScanDate"],
            computer_row["HeartbeatDate"],
            computer_row["AttemptedScanDate"],
            "N/D",
        ),
        "ram": _format_memory_value(computer_row["Memory"]),
        "operatingSystem": _stringify_value(computer_row["OSName"]) or "N/D",
        "processor": "N/D",
        "processorDescription": "N/D",
        "adWhenCreated": _stringify_value(computer_row["ADWhenCreated"]) or "N/D",
        "pdqRegisteredAt": _stringify_value(computer_row["Added"]) or "N/D",
        "lastSuccessfulScan": _stringify_value(computer_row["SuccessfulScanDate"]) or "N/D",
        "lastScanAttempt": _stringify_value(computer_row["AttemptedScanDate"]) or "N/D",
        "heartbeatDate": _stringify_value(computer_row["HeartbeatDate"]) or "N/D",
        "lastOnlineTime": _stringify_value(computer_row["LastIsOnlineTime"]) or "N/D",
        "lastOfflineTime": _stringify_value(computer_row["LastIsOfflineTime"]) or "N/D",
        "adLastLogon": _stringify_value(computer_row["ADLastLogon"]) or "N/D",
        "ouPath": _build_ou_label(computer_row["ADParentPath"], computer_row["ADPath"], computer_row["ADDistinguishedName"]),
        "hostnameNamingType": _classify_hostname(hostname),
        "interfaces": adapters,
    }


def _fetch_network_adapters(connection: sqlite3.Connection, computer_id: Any) -> list[dict[str, Any]]:
    if not _table_exists(connection, "NetworkAdapters"):
        return []

    ip_rows: dict[str, list[str]] = {}
    if _table_exists(connection, "NetworkAdapterIPAddresses"):
        for ip_row in connection.execute(
            'SELECT "DeviceId", "Address" FROM "NetworkAdapterIPAddresses" WHERE "ComputerId" = ?',
            (computer_id,),
        ).fetchall():
            device_id = _stringify_value(ip_row["DeviceId"])
            ip_rows.setdefault(device_id, []).append(_stringify_value(ip_row["Address"]))

    adapters: list[dict[str, Any]] = []
    for adapter_row in connection.execute(
        'SELECT * FROM "NetworkAdapters" WHERE "ComputerId" = ? ORDER BY "Name"',
        (computer_id,),
    ).fetchall():
        device_id = _stringify_value(adapter_row["DeviceId"])
        addresses = [value for value in ip_rows.get(device_id, []) if value]
        adapters.append(
            {
                "name": _stringify_value(adapter_row["Name"]) or "Interfaz detectada",
                "macAddress": _stringify_value(adapter_row["MacAddress"]) or "N/D",
                "manufacturer": _stringify_value(adapter_row["Manufacturer"]) or "N/D",
                "netConnectionStatus": _normalize_adapter_status(adapter_row["NetConnectionStatus"]),
                "ipAddress": ", ".join(addresses) if addresses else "N/D",
                "adapterType": _stringify_value(adapter_row["AdapterType"]) or "N/D",
                "connectionSpeed": _format_connection_speed(adapter_row["ConnectionSpeed"]),
                "netConnectionId": _stringify_value(adapter_row["NetConnectionId"]) or "N/D",
            }
        )

    return sorted(adapters, key=_network_adapter_sort_key)


def _find_matching_adapter(adapters: list[dict[str, Any]], normalized_mac_query: str) -> dict[str, Any] | None:
    if not normalized_mac_query:
        return None

    for adapter in adapters:
        if normalized_mac_query in normalize_mac(adapter.get("macAddress", "")):
            return adapter
    return None


def _find_primary_adapter(adapters: list[dict[str, Any]]) -> dict[str, Any] | None:
    for adapter in adapters:
        if adapter.get("netConnectionStatus") == "Connected":
            return adapter

    for adapter in adapters:
        if adapter.get("macAddress") not in {"", "N/D"}:
            return adapter

    return adapters[0] if adapters else None


def _get_adapter_ip(adapter: dict[str, Any] | None) -> str | None:
    if not adapter:
        return None

    ip_address = adapter.get("ipAddress")
    if not ip_address or ip_address == "N/D":
        return None
    return ip_address


def _normalize_adapter_status(value: Any) -> str:
    normalized = _stringify_value(value)
    normalized_lower = normalized.lower()

    if normalized_lower == "connected":
        return "Connected"
    if normalized_lower in {"disconnected", "mediadisconnected"}:
        return "Disconnected"
    return normalized or "N/D"


def _format_memory_value(value: Any) -> str:
    if value in (None, ""):
        return "N/D"

    try:
        total_bytes = int(value)
    except (TypeError, ValueError):
        return _stringify_value(value) or "N/D"

    total_gb = total_bytes / (1024 ** 3)
    return f"{round(total_gb)} GB"


def _format_connection_speed(value: Any) -> str:
    if value in (None, "", 0, "0"):
        return "N/D"

    try:
        speed = int(value)
    except (TypeError, ValueError):
        return _stringify_value(value) or "N/D"

    return f"{speed} Mbps"


def _network_adapter_sort_key(adapter: dict[str, Any]) -> tuple[int, int, str]:
    status = _stringify_value(adapter.get("netConnectionStatus")).lower()
    name = _stringify_value(adapter.get("name")).lower()
    is_virtual = 1 if any(token in name for token in ("miniport", "virtual", "vpn", "bluetooth")) else 0

    if status == "connected":
        status_rank = 0
    elif status == "disconnected":
        status_rank = 1
    else:
        status_rank = 2

    return (status_rank, is_virtual, name)


def _build_ou_label(ad_parent_path: Any, ad_path: Any, ad_dn: Any) -> str:
    parent_path = _stringify_value(ad_parent_path)
    if parent_path:
        return parent_path.replace("/", " / ")

    full_path = _stringify_value(ad_path)
    if full_path:
        parts = [part for part in full_path.split("/") if part]
        if len(parts) > 1:
            return " / ".join(parts[:-1])
        return " / ".join(parts)

    distinguished_name = _stringify_value(ad_dn)
    if distinguished_name:
        ous = [segment[3:] for segment in distinguished_name.split(",") if segment.startswith("OU=")]
        return " / ".join(reversed(ous)) if ous else "N/D"

    return "N/D"


def _extract_domain_from_dn(value: Any) -> str:
    distinguished_name = _stringify_value(value)
    if not distinguished_name:
        return ""

    domain_parts = [segment[3:] for segment in distinguished_name.split(",") if segment.startswith("DC=")]
    return ".".join(domain_parts)


def _classify_hostname(value: str) -> str:
    normalized = _stringify_value(value).upper()
    short_name = normalized.split(".")[0]

    if short_name.startswith("GFPE"):
        return "Servidor"
    if short_name.startswith("GF0"):
        if short_name.endswith("-T"):
            return "Tablet"
        if "-L" in short_name:
            return "Laptop"
        if "-D" in short_name:
            return "Desktop"
        if "-V" in short_name:
            return "Virtual"
    return "Sin clasificacion"


def _first_present(*values: Any) -> str:
    for value in values:
        text = _stringify_value(value)
        if text:
            return text
    return ""


def _boolish(value: Any) -> bool:
    return _stringify_value(value).lower() in {"1", "true", "yes", "si"}


def _table_exists(connection: sqlite3.Connection, table_name: str) -> bool:
    row = connection.execute(
        'SELECT 1 FROM sqlite_master WHERE type IN ("table", "view") AND name = ? LIMIT 1',
        (table_name,),
    ).fetchone()
    return row is not None


def _column_exists(connection: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    rows = connection.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    return any(row["name"] == column_name for row in rows)


def _build_normalized_sql_for_alias(alias: str, column_name: str) -> str:
    quoted_column = f'{alias}."{column_name}"'
    return (
        "upper("
        f"replace(replace(replace(replace(replace(replace(coalesce({quoted_column}, ''), ':', ''), '-', ''), '.', ''), ' ', ''), '/', ''), '\\\\', '')"
        ")"
    )
