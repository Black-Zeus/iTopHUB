ERROR_MESSAGES = {
    "DOCUMENT_NOT_FOUND": "El documento no existe o fue eliminado.",
    "INVALID_STATUS": "El documento no puede ser procesado en su estado actual.",
    "NO_RECEIVER": "Debe seleccionar una persona destino antes de emitir.",
    "NO_ITEMS": "Debe agregar al menos un activo al acta.",
    "INCOMPLETE_CHECKLIST": "Debe completar todos los elementos del checklist antes de continuar.",
    "PDF_GENERATION_FAILED": "Error al generar el documento PDF. Intente nuevamente.",
    "PDF_RENDER_FAILED": "Error al renderizar el documento. Contacte al administrador.",
    "GOTENBERG_UNAVAILABLE": "El servicio de generación de PDFs no está disponible. Intente más tarde.",
    "GOTENBERG_TIMEOUT": "El servicio de generación de PDFs tardó demasiado. Intente nuevamente.",
    "DATABASE_ERROR": "Error al guardar los datos. Intente nuevamente.",
    "VALIDATION_ERROR": "Los datos proporcionados no son válidos.",
    "UNAUTHORIZED": "No tiene permiso para realizar esta acción.",
    "SESSION_EXPIRED": "Su sesión ha expirado. Inicie sesión nuevamente.",
    "INTERNAL_ERROR": "Ocurrió un error interno. Contacte al administrador.",
    "NETWORK_ERROR": "Error de conexión. Verifique su red e intente nuevamente.",
}

ERROR_CODES = list(ERROR_MESSAGES.keys())


def get_user_error(code: str) -> str:
    return ERROR_MESSAGES.get(code, ERROR_MESSAGES["INTERNAL_ERROR"])


def is_known_error(code: str) -> bool:
    return code in ERROR_MESSAGES
