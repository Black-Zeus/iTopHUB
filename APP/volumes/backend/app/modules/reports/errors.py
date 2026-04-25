from __future__ import annotations


class ReportError(Exception):
    def __init__(self, code: str, message: str, details: list | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or []

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "details": self.details}


class ReportNotFoundError(ReportError):
    def __init__(self, report_code: str) -> None:
        super().__init__(
            "REPORT_NOT_FOUND",
            f"El reporte '{report_code}' no existe en el catalogo.",
        )


class ReportInactiveError(ReportError):
    def __init__(self, report_code: str) -> None:
        super().__init__(
            "REPORT_INACTIVE",
            f"El reporte '{report_code}' no esta activo.",
        )


class ReportVersionNotFoundError(ReportError):
    def __init__(self) -> None:
        super().__init__(
            "REPORT_ACTIVE_VERSION_NOT_FOUND",
            "No se encontro una version activa para este reporte.",
        )


class ReportDefinitionInvalidError(ReportError):
    def __init__(self, detail: str = "") -> None:
        super().__init__(
            "REPORT_DEFINITION_INVALID",
            f"La definicion JSON del reporte es invalida. {detail}".strip(),
        )


class ReportFilterRequiredError(ReportError):
    def __init__(self, filter_name: str) -> None:
        super().__init__(
            "REPORT_FILTER_REQUIRED",
            f"El filtro requerido '{filter_name}' no fue proporcionado.",
        )


class ReportFilterTypeError(ReportError):
    def __init__(self, filter_name: str, expected: str) -> None:
        super().__init__(
            "REPORT_FILTER_TYPE_INVALID",
            f"El filtro '{filter_name}' debe ser de tipo {expected}.",
        )


class ReportFilterOperatorError(ReportError):
    def __init__(self, operator: str) -> None:
        super().__init__(
            "REPORT_FILTER_OPERATOR_NOT_ALLOWED",
            f"El operador '{operator}' no esta permitido.",
        )


class ReportFilterFieldError(ReportError):
    def __init__(self, field: str) -> None:
        super().__init__(
            "REPORT_FILTER_FIELD_NOT_ALLOWED",
            f"El campo '{field}' no esta permitido en este reporte.",
        )


class ReportITopConnectionError(ReportError):
    def __init__(self, detail: str = "") -> None:
        super().__init__(
            "REPORT_ITOP_CONNECTION_ERROR",
            f"Error de conexion con iTop. {detail}".strip(),
        )


class ReportOQLError(ReportError):
    def __init__(self, detail: str = "") -> None:
        super().__init__(
            "REPORT_OQL_ERROR",
            f"Error al ejecutar la consulta OQL en iTop. {detail}".strip(),
        )


class ReportLocalQueryError(ReportError):
    def __init__(self, detail: str = "") -> None:
        super().__init__(
            "REPORT_LOCAL_QUERY_ERROR",
            f"Error al ejecutar la consulta local. {detail}".strip(),
        )


class ReportExportError(ReportError):
    def __init__(self, detail: str = "") -> None:
        super().__init__(
            "REPORT_EXPORT_ERROR",
            f"Error durante la exportacion CSV. {detail}".strip(),
        )


class ReportEmptyResultError(ReportError):
    def __init__(self) -> None:
        super().__init__(
            "REPORT_EMPTY_RESULT",
            "El reporte no retorno resultados.",
        )


class ReportVersionRollbackError(ReportError):
    def __init__(self, version: int) -> None:
        super().__init__(
            "REPORT_ROLLBACK_VERSION_NOT_FOUND",
            f"La version {version} no existe o no puede ser restaurada.",
        )


class ReportVersionActivationError(ReportError):
    def __init__(self, version: int) -> None:
        super().__init__(
            "REPORT_VERSION_INVALID",
            f"La version {version} del reporte no es valida o no puede ser activada.",
        )


class ReportUnsupportedError(ReportError):
    def __init__(self, report_code: str, reason: str = "") -> None:
        super().__init__(
            "REPORT_SOURCE_UNSUPPORTED",
            f"El reporte '{report_code}' no puede ejecutarse en esta fase. {reason}".strip(),
        )
