#!/bin/bash

# ==================================================
# Docker Tools - Versión Windows (Git Bash)
# Compatible con: Git Bash, MSYS2, Cygwin
# ==================================================

# ==================================================
# DETECCIÓN DE ENTORNO WINDOWS
# ==================================================

detect_windows_env() {
    IS_WINDOWS=false
    IS_GITBASH=false
    IS_MSYS=false

    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
        IS_WINDOWS=true
        [[ -n "$MSYSTEM" ]] && IS_GITBASH=true
        [[ "$OSTYPE" == "msys" ]] && IS_MSYS=true
    fi

    # winpty: necesario para TTY interactivo en Git Bash (docker exec -it, etc.)
    if $IS_WINDOWS && command -v winpty &>/dev/null; then
        HAS_WINPTY=true
    else
        HAS_WINPTY=false
    fi
}

# ==================================================
# CONFIGURACIÓN DE COLORES
# ==================================================

setup_colors() {
    if [[ -t 1 ]]; then
        if command -v tput &>/dev/null && tput colors &>/dev/null 2>&1; then
            RED=$(tput setaf 1)
            GREEN=$(tput setaf 2)
            YELLOW=$(tput setaf 3)
            BLUE=$(tput setaf 4)
            MAGENTA=$(tput setaf 5)
            CYAN=$(tput setaf 6)
            WHITE=$(tput setaf 7)
            BOLD=$(tput bold)
            NC=$(tput sgr0)
        else
            RED='\033[0;31m'
            GREEN='\033[0;32m'
            YELLOW='\033[1;33m'
            BLUE='\033[0;34m'
            MAGENTA='\033[0;35m'
            CYAN='\033[0;36m'
            WHITE='\033[0;37m'
            BOLD='\033[1m'
            NC='\033[0m'
        fi
    else
        RED=""; GREEN=""; YELLOW=""; BLUE=""; MAGENTA=""
        CYAN=""; WHITE=""; BOLD=""; NC=""
    fi

    ICON_SUCCESS="[OK]"
    ICON_ERROR="[ERR]"
    ICON_WARNING="[WARN]"
    ICON_INFO="[INFO]"
    ICON_QUESTION="[?]"
    ICON_CONTAINER="[CTN]"
    ICON_DOCKER="[DCK]"
    ICON_MENU="[MNU]"
    ICON_SETTINGS="[CFG]"
}

# ==================================================
# LECTURA DE ARCHIVOS .ENV
# ==================================================

read_project_name() {
    local env_file=".env"
    if [[ -f "$env_file" ]]; then
        local project_line
        project_line=$(grep "^PROJECT_NAME=" "$env_file" 2>/dev/null)
        if [[ -n "$project_line" ]]; then
            echo "$project_line" | cut -d'=' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//' | tr -d '\r'
        else
            echo ""
        fi
    else
        echo ""
    fi
}

define_compose_file() {
    case "$ENV" in
        "dev") COMPOSE_FILE="docker-compose-dev.yml" ;;
        "qa")  COMPOSE_FILE="docker-compose-qa.yml" ;;
        "prd") COMPOSE_FILE="docker-compose.yml" ;;
        *)
            echo "Entorno no valido. Se usara docker-compose-dev.yml"
            COMPOSE_FILE="docker-compose-dev.yml"
            ;;
    esac
}

read_env_value() {
    local key="$1"
    local default_value="${2:-}"
    local value=""
    local env_files=(".env" ".env.$ENV")

    for env_file in "${env_files[@]}"; do
        if [[ -f "$env_file" ]]; then
            local line
            line=$(grep -E "^${key}=" "$env_file" 2>/dev/null | tail -n 1)
            if [[ -n "$line" ]]; then
                value=$(echo "$line" | cut -d'=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//' | tr -d '\r')
            fi
        fi
    done

    if [[ -n "$value" ]]; then
        echo "$value"
    else
        echo "$default_value"
    fi
}

get_runtime_data_root()    { read_env_value "DATA_ROOT"    "./APP/data/${ENV}"; }
get_runtime_logs_root()    { read_env_value "LOGS_ROOT"    "./APP/logs/${ENV}"; }
get_runtime_volumes_root() { read_env_value "VOLUMES_ROOT" "./APP/volumes"; }

build_compose_cmd() {
    local action="$1"
    local profile_args="${2:-}"
    local service_args="${3:-}"
    echo "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV ${profile_args} ${action} ${service_args}"
}

# ==================================================
# UTILIDADES WINDOWS
# ==================================================

# Convierte ruta Unix a Windows nativa (para docker -v en Git Bash)
to_win_path() {
    local path="$1"
    if $IS_WINDOWS; then
        # Git Bash: /c/Users/... → C:/Users/...
        echo "$path" | sed 's|^/\([a-zA-Z]\)/|\1:/|'
    else
        echo "$path"
    fi
}

# Versión del pwd compatible con Docker en Windows
pwd_docker() {
    if $IS_WINDOWS; then
        pwd | sed 's|^/\([a-zA-Z]\)/|\1:/|'
    else
        pwd
    fi
}

# Obtener IP actual - Windows compatible
get_current_ip() {
    local ip=""

    if $IS_WINDOWS; then
        # Preferir ipconfig en Windows
        if command -v ipconfig &>/dev/null; then
            ip=$(ipconfig 2>/dev/null \
                | grep -A4 "Adaptador de Ethernet\|Ethernet adapter\|Wi-Fi\|Wireless" \
                | grep -i "IPv4\|Direcci" \
                | grep -v "169\.254\|127\.0\.0" \
                | head -1 \
                | sed 's/.*: //' \
                | tr -d '\r ')
        fi
        # Fallback: route
        if [[ -z "$ip" ]] && command -v route &>/dev/null; then
            ip=$(route print 2>/dev/null \
                | grep "0.0.0.0.*0.0.0.0" \
                | awk '{print $4}' \
                | grep -v "0\.0\.0\.0" \
                | head -1 \
                | tr -d '\r ')
        fi
    else
        if command -v ip &>/dev/null; then
            ip=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
        fi
        if [[ -z "$ip" ]] && command -v hostname &>/dev/null; then
            ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        fi
    fi

    echo "$ip"
}

# Abrir URL en navegador - Windows compatible
open_browser() {
    local url="$1"
    if $IS_WINDOWS; then
        start "" "$url" 2>/dev/null || cmd /c start "$url" 2>/dev/null \
            || echo -e "${YELLOW}Abra manualmente: $url${NC}"
    elif command -v xdg-open &>/dev/null; then
        xdg-open "$url" 2>/dev/null
    elif command -v open &>/dev/null; then
        open "$url" 2>/dev/null
    else
        echo -e "${YELLOW}Abra manualmente: $url${NC}"
    fi
}

# sed -i compatible Linux y Windows/MSYS
sed_in_place() {
    local file="$1"
    local pattern="$2"

    if [[ "$3" == "--backup" ]]; then
        local backup_file="${file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$file" "$backup_file"
        echo -e "${BLUE}Backup creado: $backup_file${NC}"
    fi

    # En MSYS/Git Bash sed -i funciona bien (usa la versión GNU de Git Bash)
    sed -i "$pattern" "$file"
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        echo -e "${RED}[ERR] Error al modificar $file${NC}"
        return 1
    fi
    return 0
}

# Pausa - evita cls/clear en Windows si TERM no está definido
pause() {
    echo ""
    read -rp "$(echo -e "${CYAN}Presione Enter para continuar...${NC}")"
}

# ==================================================
# VERIFICACIÓN DE DEPENDENCIAS
# ==================================================

check_dependencies() {
    local has_errors=false
    local missing_deps=()

    echo -e "${CYAN}${BOLD}============================================================${NC}"
    echo -e "${CYAN}${BOLD}  VERIFICANDO DEPENDENCIAS DEL SISTEMA${NC}"
    if $IS_WINDOWS; then
        echo -e "${CYAN}${BOLD}  Entorno: Windows / Git Bash${NC}"
    fi
    echo -e "${CYAN}${BOLD}============================================================${NC}"
    echo ""

    # Docker CLI
    if ! command -v docker &>/dev/null; then
        missing_deps+=("docker")
        has_errors=true
        echo -e "${RED}[ERR] Docker CLI: No encontrado${NC}"
    else
        echo -e "${GREEN}[OK]  Docker CLI: Encontrado${NC}"

        # Docker daemon - en Windows puede tardar en responder
        local docker_check_output
        docker_check_output=$(docker info 2>&1)
        if [[ $? -ne 0 ]]; then
            echo -e "${RED}[ERR] Docker daemon: No esta en ejecucion${NC}"
            if $IS_WINDOWS; then
                echo -e "${YELLOW}      Soluciones:${NC}"
                echo -e "${YELLOW}      1) Inicie Docker Desktop desde el menu de inicio${NC}"
                echo -e "${YELLOW}      2) Espere a que el icono de la bandeja muestre 'running'${NC}"
                echo -e "${YELLOW}      3) Si usa WSL2, abra Docker Desktop y habilite integracion WSL${NC}"
            else
                echo -e "${YELLOW}      Ejecute: sudo systemctl start docker${NC}"
            fi
            has_errors=true
        else
            echo -e "${GREEN}[OK]  Docker daemon: En ejecucion${NC}"
        fi
    fi

    # Docker Compose
    if docker compose version &>/dev/null; then
        echo -e "${GREEN}[OK]  Docker Compose (plugin): Encontrado${NC}"
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &>/dev/null; then
        echo -e "${GREEN}[OK]  Docker Compose (standalone): Encontrado${NC}"
        COMPOSE_CMD="docker-compose"
    else
        missing_deps+=("docker-compose")
        has_errors=true
        echo -e "${RED}[ERR] Docker Compose: No encontrado${NC}"
    fi

    # winpty (Git Bash - necesario para sesiones TTY interactivas)
    if $IS_WINDOWS; then
        if $HAS_WINPTY; then
            echo -e "${GREEN}[OK]  winpty: Encontrado (sesiones interactivas habilitadas)${NC}"
        else
            echo -e "${YELLOW}[WARN] winpty: No encontrado${NC}"
            echo -e "${YELLOW}       docker exec -it puede no funcionar correctamente${NC}"
            echo -e "${YELLOW}       Instale Git for Windows (incluye winpty) o use: winpty docker exec -it ...${NC}"
        fi
    fi

    # Comandos Unix esenciales (disponibles en Git Bash)
    local essential_commands=("grep" "cut" "sed" "awk" "find" "mktemp" "date")
    for cmd in "${essential_commands[@]}"; do
        if ! command -v "$cmd" &>/dev/null; then
            missing_deps+=("$cmd")
            has_errors=true
            echo -e "${RED}[ERR] $cmd: No encontrado${NC}"
        else
            echo -e "${GREEN}[OK]  $cmd: Encontrado${NC}"
        fi
    done

    echo ""

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo -e "${RED}${BOLD}[ERR] Dependencias criticas faltantes:${NC}"
        for dep in "${missing_deps[@]}"; do
            echo -e "${RED}      - $dep${NC}"
        done
        echo ""
        echo -e "${YELLOW}Instale las dependencias e intente nuevamente.${NC}"
        exit 1
    fi

    echo -e "${GREEN}${BOLD}[OK]  Verificacion de dependencias completada${NC}"
    echo -e "${CYAN}============================================================${NC}"
    echo ""
    sleep 2
}

# ==================================================
# FUNCIONES DE UTILIDAD
# ==================================================

run_cmd() {
    local cmd="$1"
    local error_msg="${2:-Error al ejecutar el comando}"
    local success_msg="${3:-Comando ejecutado exitosamente}"
    local exit_code

    echo -e "${CYAN}> Ejecutando: $cmd${NC}"
    echo -e "${CYAN}------------------------------------------------${NC}"

    eval "$cmd"
    exit_code=$?

    echo -e "${CYAN}------------------------------------------------${NC}"

    if [[ $exit_code -ne 0 ]]; then
        echo -e "${RED}[ERR] $error_msg (codigo: $exit_code)${NC}"
        return $exit_code
    fi

    echo -e "${GREEN}[OK]  $success_msg${NC}"
    return 0
}

check_file_exists() {
    local file="$1"
    local purpose="${2:-operacion}"
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}[ERR] Archivo no encontrado: $file${NC}"
        echo -e "${YELLOW}      Necesario para: $purpose${NC}"
        return 1
    fi
    return 0
}

check_stack_containers() {
    local count
    count=$(docker ps --filter "label=$LABEL_FILTER" -q 2>/dev/null | wc -l | tr -d '[:space:]')
    if [[ "$count" -eq 0 ]]; then
        echo -e "${YELLOW}[WARN] No hay contenedores activos con etiqueta: $LABEL_FILTER${NC}"
        echo -e "${BLUE}       Use la opcion 1 del menu principal para iniciarlos${NC}"
        return 1
    fi
    return 0
}

confirm_action() {
    local message="$1"
    local default="${2:-no}"
    local response

    echo ""
    echo -e "${YELLOW}${BOLD}[!] CONFIRMACION REQUERIDA${NC}"
    echo -e "${YELLOW}------------------------------------------------${NC}"
    echo -e "${YELLOW}$message${NC}"
    echo ""

    if [[ "$default" == "si" ]]; then
        read -rp "$(echo -e "${CYAN}Continuar? [S/n]: ${NC}")" response
        response=${response:-S}
    else
        read -rp "$(echo -e "${CYAN}Continuar? [s/N]: ${NC}")" response
        response=${response:-N}
    fi

    if [[ "$response" =~ ^[Ss]$ ]]; then
        echo -e "${BLUE}Procediendo...${NC}"
        return 0
    else
        echo -e "${BLUE}Operacion cancelada${NC}"
        return 1
    fi
}

# ==================================================
# FUNCIONES DE COMPOSE Y SERVICIOS
# ==================================================

get_service_block_from_compose() {
    local compose_file="$1"
    local service_name="$2"

    awk -v target="$service_name" '
        BEGIN { in_services=0; in_target=0 }
        /^services:/ { in_services=1; next }
        in_services && /^[^[:space:]]/ {
            if (in_target) exit
            in_services=0
        }
        in_services && $0 ~ ("^  " target ":$") { in_target=1; print; next }
        in_target && /^  [a-zA-Z0-9_-]+:/ { exit }
        in_target { print }
    ' "$compose_file"
}

list_services_by_group() {
    local target_group="${1:-all}"
    local services=()
    local service_name service_block group_value

    while IFS= read -r service_name; do
        [[ -z "$service_name" ]] && continue
        service_block="$(get_service_block_from_compose "$COMPOSE_FILE" "$service_name")"
        group_value="$(echo "$service_block" | sed -n 's/^[[:space:]]*service\.group: //p' | head -1 | tr -d '\r')"

        if [[ "$target_group" == "all" || "$group_value" == "$target_group" ]]; then
            services+=("$service_name")
        fi
    done < <(eval "$(build_compose_cmd "config --services" "--profile tools")" 2>/dev/null)

    [[ ${#services[@]} -gt 0 ]] && printf '%s\n' "${services[@]}"
}

validate_compose_env_files() {
    local missing_files=()

    for env_file in ".env" ".env.$ENV"; do
        [[ ! -f "$env_file" ]] && missing_files+=("$env_file")
    done

    if [[ ${#missing_files[@]} -gt 0 ]]; then
        echo -e "${RED}${BOLD}[ERR] Faltan archivos de entorno requeridos:${NC}"
        for env_file in "${missing_files[@]}"; do
            echo -e "${RED}      - ${env_file}${NC}"
        done
        echo ""
        echo -e "${YELLOW}Cree los archivos desde .env.example y genere .env.${ENV} con los overrides.${NC}"
        return 1
    fi

    local required_vars=()
    while IFS= read -r var_name; do
        [[ -n "$var_name" ]] && required_vars+=("$var_name")
    done < <(grep -oE '\$\{[A-Z0-9_]+(:-[^}]*)?\}' "$COMPOSE_FILE" 2>/dev/null \
        | sed -E 's/^\$\{([A-Z0-9_]+).*/\1/' | sort -u)

    local optional_empty_vars=("ITOP_PACKAGE_URL")
    local missing_vars=()

    for var_name in "${required_vars[@]}"; do
        [[ " ${optional_empty_vars[*]} " == *" ${var_name} "* ]] && continue
        if [[ -z "$(read_env_value "$var_name")" ]]; then
            missing_vars+=("$var_name")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        echo -e "${RED}${BOLD}[ERR] Variables requeridas sin valor para ${COMPOSE_FILE}:${NC}"
        for var_name in "${missing_vars[@]}"; do
            echo -e "${RED}      - ${var_name}${NC}"
        done
        echo ""
        echo -e "${YELLOW}Revise .env y .env.${ENV} o regenerelos desde los archivos *.example.${NC}"
        return 1
    fi

    return 0
}

ask_service_groups() {
    local response
    local core_services=() dependency_services=() tools_services=() selected_services=()
    local service_name

    SELECTED_PROFILE_ARGS=""
    SELECTED_SERVICE_ARGS=""

    while IFS= read -r service_name; do
        [[ -n "$service_name" ]] && core_services+=("$service_name")
    done < <(list_services_by_group "core")

    while IFS= read -r service_name; do
        [[ -n "$service_name" ]] && dependency_services+=("$service_name")
    done < <(list_services_by_group "dependency")

    while IFS= read -r service_name; do
        [[ -n "$service_name" ]] && tools_services+=("$service_name")
    done < <(list_services_by_group "tools")

    selected_services=("${core_services[@]}")

    echo ""
    echo -e "${CYAN}${BOLD}[*] ALCANCE DEL LEVANTE${NC}"
    echo -e "${CYAN}----------------------------------------${NC}"
    echo -e "El grupo base para el entorno ${BOLD}${ENV}${NC} sera siempre ${BOLD}core${NC}."
    echo ""

    if [[ ${#dependency_services[@]} -gt 0 ]]; then
        echo -e "Dependencias disponibles:"
        for service_name in "${dependency_services[@]}"; do
            echo -e "   * ${service_name}"
        done
        echo ""
        read -rp "$(echo -e "${CYAN}Desea anexar dependency? [s/N]: ${NC}")" response
        [[ "$response" =~ ^[Ss]$ ]] && selected_services+=("${dependency_services[@]}")
    fi

    if [[ ${#tools_services[@]} -gt 0 ]]; then
        echo ""
        echo -e "Herramientas disponibles:"
        for service_name in "${tools_services[@]}"; do
            echo -e "   * ${service_name}"
        done
        echo ""
        read -rp "$(echo -e "${CYAN}Desea anexar tools? [s/N]: ${NC}")" response
        if [[ "$response" =~ ^[Ss]$ ]]; then
            SELECTED_PROFILE_ARGS="--profile tools"
            selected_services+=("${tools_services[@]}")
        fi
    fi

    echo ""
    echo -e "${YELLOW}Nota:${NC} Docker Compose puede iniciar dependencias tecnicas adicionales."

    [[ ${#selected_services[@]} -gt 0 ]] && SELECTED_SERVICE_ARGS="${selected_services[*]}"
}

# ==================================================
# LIMPIEZA - COMPATIBLE WINDOWS
# ==================================================

remove_directory_contents() {
    local target_dir="$1"
    local label="$2"

    if [[ ! -d "$target_dir" ]]; then
        echo -e "${YELLOW}[WARN] No existe el directorio ${target_dir}${NC}"
        return 0
    fi

    local found=false
    shopt -s dotglob nullglob
    for item in "$target_dir"/*; do
        local base_name
        base_name=$(basename "$item")
        [[ "$base_name" == ".gitkeep" ]] && continue

        found=true
        rm -rf "$item" 2>/dev/null \
            && echo -e "${GREEN}[OK]  Eliminado: $item${NC}" \
            || echo -e "${RED}[ERR] Error al eliminar $item${NC}"
    done
    shopt -u dotglob nullglob

    [[ "$found" == false ]] && echo -e "${YELLOW}[WARN] ${label} ya esta vacio${NC}"
}

clean_runtime_artifacts() {
    local volumes_root
    volumes_root="$(get_runtime_volumes_root)"

    echo -e "${BLUE}Buscando artefactos de runtime en ${volumes_root}...${NC}"

    if [[ ! -d "$volumes_root" ]]; then
        echo -e "${YELLOW}[WARN] No existe el directorio ${volumes_root}${NC}"
        return 0
    fi

    local targets=("node_modules" "__pycache__" ".pytest_cache" ".mypy_cache"
                   ".ruff_cache" ".venv" "venv" "dist" "build" "coverage")
    local removed_any=false

    for target_name in "${targets[@]}"; do
        while IFS= read -r matched_path; do
            [[ -z "$matched_path" ]] && continue
            removed_any=true
            rm -rf "$matched_path" 2>/dev/null \
                && echo -e "${GREEN}[OK]  Eliminado: $matched_path${NC}" \
                || echo -e "${RED}[ERR] Error al eliminar $matched_path${NC}"
        done < <(find "$volumes_root" -path "*/.git/*" -prune -o -name "$target_name" -print 2>/dev/null)
    done

    while IFS= read -r matched_file; do
        [[ -z "$matched_file" ]] && continue
        removed_any=true
        rm -f "$matched_file" 2>/dev/null \
            && echo -e "${GREEN}[OK]  Eliminado: $matched_file${NC}" \
            || echo -e "${RED}[ERR] Error al eliminar $matched_file${NC}"
    done < <(find "$volumes_root" -path "*/.git/*" -prune -o \( -name "*.pyc" -o -name "*.pyo" \) -print 2>/dev/null)

    [[ "$removed_any" == false ]] && echo -e "${YELLOW}[WARN] No se encontraron artefactos de runtime${NC}"
}

list_project_named_volumes() {
    docker volume ls --format "{{.Name}}" 2>/dev/null | grep -E "^${PROJECT_NAME}_" || true
}

get_volume_name_from_backup() {
    local backup_filename="$1"
    local base_name="${backup_filename%.tar.gz}"
    base_name="${base_name%_[0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]}"
    echo "$base_name"
}

# Ajuste de permisos - en Windows chown no aplica de la misma forma
ensure_path_writable() {
    local target_dir="$1"
    local label="$2"

    if [[ ! -d "$target_dir" ]]; then
        return 0
    fi

    if $IS_WINDOWS; then
        # En Windows/Git Bash chown no funciona sobre NTFS de la misma manera.
        # Intentamos chmod recursivo como alternativa.
        if chmod -R u+rw "$target_dir" 2>/dev/null; then
            echo -e "${GREEN}[OK]  Permisos actualizados: ${target_dir}${NC}"
            return 0
        else
            echo -e "${YELLOW}[WARN] No se pudieron ajustar permisos en ${target_dir}${NC}"
            echo -e "${YELLOW}       En Windows puede requerir ejecutar Git Bash como Administrador${NC}"
            return 1
        fi
    else
        local current_user current_group
        current_user="$(id -un 2>/dev/null)"
        current_group="$(id -gn 2>/dev/null)"

        if chown -R "$current_user:$current_group" "$target_dir" 2>/dev/null; then
            echo -e "${GREEN}[OK]  Permisos actualizados: ${target_dir}${NC}"
            return 0
        fi

        if command -v sudo >/dev/null 2>&1; then
            echo -e "${YELLOW}[WARN] Se intentara con sudo para ${label}${NC}"
            if sudo chown -R "$current_user:$current_group" "$target_dir"; then
                echo -e "${GREEN}[OK]  Permisos actualizados con sudo: ${target_dir}${NC}"
                return 0
            fi
        fi

        echo -e "${RED}[ERR] No se pudieron corregir permisos en ${target_dir}${NC}"
        return 1
    fi
}

# ==================================================
# CONTENEDORES - LISTADO Y SELECCIÓN
# ==================================================

list_stack_containers() {
    local format="${1:-simple}"
    local include_all="${2:-false}"
    local docker_cmd="docker ps"

    [[ "$include_all" == "true" ]] && docker_cmd="docker ps -a"

    STACK_CONTAINERS=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && STACK_CONTAINERS+=("$line")
    done < <($docker_cmd --filter "label=$LABEL_FILTER" \
        --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}" 2>/dev/null)

    STACK_CONTAINER_COUNT=${#STACK_CONTAINERS[@]}

    if [[ $STACK_CONTAINER_COUNT -eq 0 ]]; then
        echo -e "${YELLOW}[WARN] No se encontraron contenedores con etiqueta: $LABEL_FILTER${NC}"
        return 1
    fi

    echo ""
    case "$format" in
        "simple")
            printf "${BOLD}%-4s %-30s %-20s${NC}\n" "#" "NOMBRE" "ESTADO"
            echo "--------------------------------------------------------------"
            for i in "${!STACK_CONTAINERS[@]}"; do
                IFS='|' read -r id name image status ports <<< "${STACK_CONTAINERS[$i]}"
                local status_color="${GREEN}"
                [[ "$status" == *"Exited"* ]] && status_color="${RED}"
                [[ "$status" == *"Paused"* ]] && status_color="${YELLOW}"
                printf "%-4d %-30.30s ${status_color}%-20.20s${NC}\n" $((i+1)) "$name" "$status"
            done
            ;;
        "detailed")
            printf "${BOLD}%-4s %-25s %-28s %-18s %-20s${NC}\n" "#" "NOMBRE" "IMAGEN" "ESTADO" "PUERTOS"
            echo "--------------------------------------------------------------------------------------------"
            for i in "${!STACK_CONTAINERS[@]}"; do
                IFS='|' read -r id name image status ports <<< "${STACK_CONTAINERS[$i]}"
                local status_color="${GREEN}"
                [[ "$status" == *"Exited"* ]] && status_color="${RED}"
                [[ "$status" == *"Paused"* ]] && status_color="${YELLOW}"
                printf "%-4d %-25.25s %-28.28s ${status_color}%-18.18s${NC} %-20.20s\n" \
                    $((i+1)) "$name" "$image" "$status" "$ports"
            done
            ;;
    esac

    return 0
}

select_container_from_stack() {
    local prompt="${1:-Seleccione el numero del contenedor}"
    local allow_exit="${2:-true}"
    local show_all="${3:-false}"
    local index

    echo -e "\n${CYAN}${BOLD}[*] CONTENEDORES DISPONIBLES:${NC}"

    if ! list_stack_containers "detailed" "$show_all"; then
        return 1
    fi

    local exit_index=$(( STACK_CONTAINER_COUNT + 1 ))
    echo ""
    [[ "$allow_exit" == "true" ]] && echo -e "${YELLOW}${exit_index}) Volver al menu anterior${NC}"
    echo ""

    read -rp "$(echo -e "${CYAN}$prompt: ${NC}")" index

    if [[ "$allow_exit" == "true" ]] && [[ "$index" == "$exit_index" || "$index" == "0" ]]; then
        return 2
    fi

    if ! [[ "$index" =~ ^[0-9]+$ ]] || [[ "$index" -lt 1 ]] || [[ "$index" -gt $STACK_CONTAINER_COUNT ]]; then
        echo -e "${RED}[ERR] Indice invalido. Debe ser entre 1 y $STACK_CONTAINER_COUNT${NC}"
        sleep 2
        return 1
    fi

    IFS='|' read -r SELECTED_CONTAINER_ID SELECTED_CONTAINER_NAME _ <<< "${STACK_CONTAINERS[$((index-1))]}"
    echo -e "${GREEN}[OK]  Seleccionado: $SELECTED_CONTAINER_NAME${NC}"
    return 0
}

# ==================================================
# BANNER Y COLORES DE ENTORNO
# ==================================================

get_env_color() {
    case "$ENV" in
        "dev") echo -e "${GREEN}dev${NC}" ;;
        "qa")  echo -e "${YELLOW}qa${NC}" ;;
        "prd") echo -e "${RED}prd${NC}" ;;
        *)     echo -e "$ENV" ;;
    esac
}

banner_principal() {
    local title="$1"
    # En Git Bash 'clear' funciona correctamente
    clear

    echo -e "${CYAN}${BOLD}+===========================================================+${NC}"
    printf "${CYAN}${BOLD}|         DOCKER TOOLS - %-30s|${NC}\n" "$title"
    echo -e "${CYAN}${BOLD}+===========================================================+${NC}"

    local current_ip=""
    if [[ -n "$CURRENT_IP" ]]; then
        current_ip="$CURRENT_IP"
    else
        current_ip=$(get_current_ip 2>/dev/null || echo "No detectada")
    fi

    local git_info=""
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git_info="${GREEN}$(git rev-parse --abbrev-ref HEAD 2>/dev/null)${NC}"
    else
        git_info="${YELLOW}No es repositorio Git${NC}"
    fi

    echo -e "${BLUE}${BOLD}[INFO] ENTORNO:${NC}"
    echo -e "   ${CYAN}Archivo:${NC}  $COMPOSE_FILE"
    echo -e "   ${CYAN}Stack:${NC}    $STACK"
    echo -e "   ${CYAN}Entorno:${NC}  $(get_env_color)"
    echo -e "   ${CYAN}IP Actual:${NC} $current_ip"
    echo -e "   ${CYAN}Rama Git:${NC} $git_info"
    if $IS_WINDOWS; then
        echo -e "   ${CYAN}Sistema:${NC}  Windows / Git Bash"
    fi
    echo ""
}

# ==================================================
# MENÚS
# ==================================================

menu() {
    banner_principal "MENU PRINCIPAL"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} MANEJADOR DE CONTENEDORES"
    echo -e "  ${CYAN}2)${NC} MONITOREO Y DIAGNOSTICO"
    echo -e "  ${CYAN}3)${NC} LIMPIEZA Y MANTENIMIENTO"
    echo -e "  ${CYAN}4)${NC} CONFIGURACION DEL SISTEMA"
    echo -e "  ${CYAN}5)${NC} HERRAMIENTAS EXPO"
    echo -e "  ${CYAN}6)${NC} GESTION DE TEMPLATES .ENV"
    echo -e "  ${CYAN}7)${NC} ESTADO Y SERVICIOS DOCKER"
    echo -e "  ${CYAN}8)${NC} PORTAINER"
    echo -e "  ${CYAN}9)${NC} BACKUP Y RESTORE"
    echo ""
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1) menu_contenedores ;;
        2) menu_monitoreo ;;
        3) menu_limpieza ;;
        4) menu_configuracion ;;
        5) menu_expo ;;
        6) menu_templates ;;
        7) menu_docker_services ;;
        8) menu_portainer ;;
        9) menu_backup ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu
            ;;
    esac
}

menu_contenedores() {
    banner_principal "MANEJADOR DE CONTENEDORES"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Iniciar contenedores y construir imagenes"
    echo -e "  ${CYAN}2)${NC} Detener y eliminar contenedores"
    echo -e "  ${CYAN}3)${NC} Reiniciar contenedores"
    echo -e "  ${CYAN}4)${NC} Reiniciar contenedor unico"
    echo -e "  ${CYAN}5)${NC} Construir imagenes"
    echo -e "  ${CYAN}6)${NC} Validar Docker Compose"
    echo -e "  ${CYAN}7)${NC} Validar reglas del proyecto"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1) up ;;
        2) down ;;
        3) restart ;;
        4) restart_single_container ;;
        5) build ;;
        6) validate_compose ;;
        7) validate_compose_rules ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_contenedores
            ;;
    esac
}

menu_monitoreo() {
    banner_principal "MONITOREO Y DIAGNOSTICO"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Ver logs"
    echo -e "  ${CYAN}2)${NC} Ver logs de un contenedor"
    echo -e "  ${CYAN}3)${NC} Estado de los contenedores"
    echo -e "  ${CYAN}4)${NC} Listar contenedores de stack"
    echo -e "  ${CYAN}5)${NC} Abrir terminal en contenedor"
    echo -e "  ${CYAN}6)${NC} Monitoreo de recursos"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1) logs ;;
        2) logs_single_container ;;
        3) ps_stack ;;
        4) list_stack ;;
        5) exec_stack ;;
        6) monitor_resources ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_monitoreo
            ;;
    esac
}

menu_limpieza() {
    banner_principal "LIMPIEZA Y MANTENIMIENTO"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Limpiar contenedores, redes y volumenes"
    echo -e "  ${CYAN}2)${NC} Limpiar imagenes no utilizadas"
    echo -e "  ${CYAN}3)${NC} Limpiar volumenes no utilizados"
    echo -e "  ${CYAN}4)${NC} Limpiar todo"
    echo -e "  ${CYAN}5)${NC} Eliminar Persistencias"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1) clean ;;
        2) clean_images_enhanced ;;
        3) clean_volumes ;;
        4) clean_all ;;
        5) drop_persistence ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_limpieza
            ;;
    esac
}

menu_configuracion() {
    banner_principal "CONFIGURACION DEL SISTEMA"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Cambiar entorno (dev, qa, prd)"
    echo -e "  ${CYAN}2)${NC} Actualizar IP para Expo / Android"
    echo -e "  ${CYAN}3)${NC} Verificar IP de Expo / Android"
    echo -e "  ${CYAN}4)${NC} Listar variables de entorno"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1) change_env ;;
        2) update_ip_menu ;;
        3) check_ip_menu ;;
        4) validate_container_env ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_configuracion
            ;;
    esac
}

menu_backup() {
    banner_principal "BACKUP Y RESTORE"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Backup de volumenes"
    echo -e "  ${CYAN}2)${NC} Restaurar volumen"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1) backup_volumes ;;
        2) restore_volume ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_backup
            ;;
    esac
}

menu_templates() {
    banner_principal "GESTION DE TEMPLATES .ENV"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Generar .env.template"
    echo -e "  ${CYAN}2)${NC} Generar archivos .env desde template"
    echo -e "  ${CYAN}3)${NC} Verificar archivos .env"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1|2|3)
            echo -e "${YELLOW}[WARN] Funcion en desarrollo${NC}"
            sleep 2
            menu_templates
            ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_templates
            ;;
    esac
}

menu_expo() {
    banner_principal "HERRAMIENTAS EXPO"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Iniciar Expo Development Server"
    echo -e "  ${CYAN}2)${NC} EAS Build"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1|2)
            echo -e "${YELLOW}[WARN] Funcion en desarrollo${NC}"
            sleep 2
            menu_expo
            ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_expo
            ;;
    esac
}

menu_docker_services() {
    banner_principal "ESTADO Y SERVICIOS DOCKER"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Estado Docker Engine"
    echo -e "  ${CYAN}2)${NC} Estado Docker Desktop"
    echo -e "  ${CYAN}3)${NC} Reiniciar Docker Engine"
    echo -e "  ${CYAN}4)${NC} Reiniciar Docker Desktop"
    echo -e "  ${CYAN}5)${NC} Reiniciar Ambos"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    case "$choice" in
        1)
            docker info
            pause
            menu_docker_services
            ;;
        2)
            if $IS_WINDOWS; then
                echo -e "${CYAN}Estado de Docker Desktop:${NC}"
                # Verifica si el proceso está corriendo
                tasklist 2>/dev/null | grep -i "Docker Desktop" \
                    && echo -e "${GREEN}[OK]  Docker Desktop esta en ejecucion${NC}" \
                    || echo -e "${YELLOW}[WARN] Docker Desktop no parece estar en ejecucion${NC}"
            else
                echo -e "${YELLOW}[WARN] Verifique Docker Desktop manualmente${NC}"
            fi
            pause
            menu_docker_services
            ;;
        3)
            if confirm_action "Reiniciar Docker Engine?" "no"; then
                if $IS_WINDOWS; then
                    echo -e "${YELLOW}[INFO] En Windows el engine se maneja via Docker Desktop.${NC}"
                    echo -e "${YELLOW}       Use la opcion 4 para reiniciar Docker Desktop.${NC}"
                else
                    sudo systemctl restart docker 2>/dev/null \
                        || echo -e "${RED}[ERR] No se pudo reiniciar Docker Engine${NC}"
                fi
            fi
            pause
            menu_docker_services
            ;;
        4)
            if confirm_action "Reiniciar Docker Desktop?" "no"; then
                if $IS_WINDOWS; then
                    echo -e "${YELLOW}Cerrando Docker Desktop...${NC}"
                    # Cierra Docker Desktop y lo reinicia
                    taskkill //F //IM "Docker Desktop.exe" 2>/dev/null || true
                    sleep 3
                    echo -e "${YELLOW}Iniciando Docker Desktop...${NC}"
                    # Ruta típica de instalación
                    local docker_desktop_paths=(
                        "$PROGRAMFILES/Docker/Docker/Docker Desktop.exe"
                        "$LOCALAPPDATA/Programs/Docker/Docker/Docker Desktop.exe"
                    )
                    local started=false
                    for path in "${docker_desktop_paths[@]}"; do
                        if [[ -f "$path" ]]; then
                            start "" "$path" 2>/dev/null && started=true && break
                        fi
                    done
                    $started && echo -e "${GREEN}[OK]  Docker Desktop iniciado${NC}" \
                             || echo -e "${YELLOW}[WARN] Inicie Docker Desktop manualmente${NC}"
                else
                    echo -e "${YELLOW}[WARN] Reinicie Docker Desktop manualmente${NC}"
                fi
            fi
            pause
            menu_docker_services
            ;;
        5)
            echo -e "${YELLOW}[WARN] Reinicie Docker Desktop manualmente desde Windows${NC}"
            pause
            menu_docker_services
            ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_docker_services
            ;;
    esac
}

menu_portainer() {
    banner_principal "PORTAINER"

    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} Iniciar Portainer"
    echo -e "  ${CYAN}2)${NC} Detener Portainer"
    echo -e "  ${CYAN}3)${NC} Reiniciar Portainer"
    echo -e "  ${CYAN}4)${NC} Abrir en navegador"
    echo -e "  ${CYAN}5)${NC} Ver logs"
    echo -e "  ${CYAN}6)${NC} Recrear Portainer"
    echo ""
    echo -e "  ${CYAN}V)${NC} Volver"
    echo -e "  ${CYAN}S)${NC} Salir"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione una opcion: ${NC}")" choice

    # Socket Docker en Windows: //var/run/docker.sock (Git Bash) o npipe:////./pipe/docker_engine
    local docker_socket="//var/run/docker.sock"
    $IS_WINDOWS && docker_socket="//var/run/docker.sock"

    case "$choice" in
        1)
            if ! docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
                docker run -d \
                    --name "$PORTAINER_NAME" \
                    --restart unless-stopped \
                    -p 9000:9000 \
                    -v "$docker_socket":/var/run/docker.sock \
                    -v portainer_data:/data \
                    "$PORTAINER_IMAGE" >/dev/null 2>&1 \
                    && echo -e "${GREEN}[OK]  Portainer iniciado en http://localhost:9000${NC}" \
                    || echo -e "${RED}[ERR] Error al iniciar Portainer${NC}"
            else
                docker start "$PORTAINER_NAME" >/dev/null 2>&1 \
                    && echo -e "${GREEN}[OK]  Portainer iniciado${NC}" \
                    || echo -e "${RED}[ERR] Error al iniciar${NC}"
            fi
            pause
            menu_portainer
            ;;
        2)
            docker stop "$PORTAINER_NAME" >/dev/null 2>&1 \
                && echo -e "${GREEN}[OK]  Portainer detenido${NC}" \
                || echo -e "${RED}[ERR] Error al detener${NC}"
            pause
            menu_portainer
            ;;
        3)
            docker restart "$PORTAINER_NAME" >/dev/null 2>&1 \
                && echo -e "${GREEN}[OK]  Portainer reiniciado${NC}" \
                || echo -e "${RED}[ERR] Error al reiniciar${NC}"
            pause
            menu_portainer
            ;;
        4)
            open_browser "http://localhost:9000"
            pause
            menu_portainer
            ;;
        5)
            docker logs "$PORTAINER_NAME" --tail 50
            pause
            menu_portainer
            ;;
        6)
            if confirm_action "Recrear contenedor Portainer?" "no"; then
                docker stop "$PORTAINER_NAME" >/dev/null 2>&1
                docker rm "$PORTAINER_NAME" >/dev/null 2>&1
                docker volume create portainer_data >/dev/null 2>&1 || true
                docker run -d \
                    --name "$PORTAINER_NAME" \
                    --restart unless-stopped \
                    -p 9000:9000 \
                    -v "$docker_socket":/var/run/docker.sock \
                    -v portainer_data:/data \
                    "$PORTAINER_IMAGE" \
                    && echo -e "${GREEN}[OK]  Portainer iniciado en http://localhost:9000${NC}" \
                    || echo -e "${RED}[ERR] Error al iniciar Portainer${NC}"
            fi
            pause
            menu_portainer
            ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_portainer
            ;;
    esac
}

# ==================================================
# ACCIONES - CONTENEDORES
# ==================================================

up() {
    banner_principal "INICIAR CONTENEDORES"
    if ! validate_compose_env_files; then pause; menu_contenedores; return; fi
    ask_service_groups
    run_cmd "$(build_compose_cmd "up -d --build" "$SELECTED_PROFILE_ARGS" "$SELECTED_SERVICE_ARGS")" \
        "Error al iniciar contenedores" "Contenedores iniciados exitosamente"
    pause
    menu_contenedores
}

down() {
    banner_principal "DETENER CONTENEDORES"
    if ! validate_compose_env_files; then pause; menu_contenedores; return; fi
    if confirm_action "Detener y eliminar todos los contenedores del stack?" "no"; then
        run_cmd "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV down" \
            "Error al detener contenedores" "Contenedores detenidos exitosamente"
    fi
    pause
    menu_contenedores
}

restart() {
    banner_principal "REINICIAR CONTENEDORES"
    if ! validate_compose_env_files; then pause; menu_contenedores; return; fi
    if confirm_action "Reiniciar todos los contenedores del stack?" "no"; then
        ask_service_groups
        run_cmd "$(build_compose_cmd "down")" "Error al detener contenedores"
        run_cmd "$(build_compose_cmd "up -d --build" "$SELECTED_PROFILE_ARGS" "$SELECTED_SERVICE_ARGS")" \
            "Error al iniciar contenedores" "Contenedores reiniciados exitosamente"
    fi
    pause
    menu_contenedores
}

restart_single_container() {
    banner_principal "REINICIAR CONTENEDOR UNICO"
    local result
    select_container_from_stack "Seleccione contenedor a reiniciar" true false
    result=$?
    [[ $result -ne 0 ]] && { menu_contenedores; return; }

    if confirm_action "Reiniciar contenedor $SELECTED_CONTAINER_NAME?" "no"; then
        run_cmd "docker restart $SELECTED_CONTAINER_ID" \
            "Error al reiniciar contenedor" "Contenedor reiniciado exitosamente"
    fi
    pause
    menu_contenedores
}

build() {
    banner_principal "CONSTRUIR IMAGENES"
    if ! validate_compose_env_files; then pause; menu_contenedores; return; fi
    ask_service_groups
    run_cmd "$(build_compose_cmd "build" "$SELECTED_PROFILE_ARGS" "$SELECTED_SERVICE_ARGS")" \
        "Error al construir imagenes" "Imagenes construidas exitosamente"
    pause
    menu_contenedores
}

# ==================================================
# ACCIONES - MONITOREO
# ==================================================

logs() {
    banner_principal "VER LOGS"
    if ! validate_compose_env_files; then pause; menu_monitoreo; return; fi
    eval "$(build_compose_cmd "logs -f")"
    pause
    menu_monitoreo
}

logs_single_container() {
    banner_principal "LOGS DE CONTENEDOR"
    local result
    select_container_from_stack "Seleccione contenedor para ver logs" true true
    result=$?
    [[ $result -ne 0 ]] && { menu_monitoreo; return; }
    docker logs -f "$SELECTED_CONTAINER_ID"
    pause
    menu_monitoreo
}

ps_stack() {
    banner_principal "ESTADO DE CONTENEDORES"
    if ! validate_compose_env_files; then pause; menu_monitoreo; return; fi
    eval "$(build_compose_cmd "ps")"
    pause
    menu_monitoreo
}

list_stack() {
    banner_principal "LISTAR CONTENEDORES"
    list_stack_containers "detailed" true
    pause
    menu_monitoreo
}

exec_stack() {
    banner_principal "TERMINAL EN CONTENEDOR"

    local result
    select_container_from_stack "Seleccione contenedor para acceder" true false
    result=$?
    [[ $result -ne 0 ]] && { menu_monitoreo; return; }

    echo -e "${GREEN}Conectando a $SELECTED_CONTAINER_NAME...${NC}"

    if $IS_WINDOWS; then
        # Git Bash necesita winpty para sesiones TTY interactivas con docker exec
        if $HAS_WINPTY; then
            echo -e "${BLUE}[INFO] Usando winpty para compatibilidad con Git Bash${NC}"
            # Intentar bash primero, luego sh
            if docker exec "$SELECTED_CONTAINER_ID" bash -c "echo" >/dev/null 2>&1; then
                winpty docker exec -it "$SELECTED_CONTAINER_ID" bash
            else
                winpty docker exec -it "$SELECTED_CONTAINER_ID" sh
            fi
        else
            echo -e "${YELLOW}[WARN] winpty no encontrado. La sesion interactiva puede no funcionar.${NC}"
            echo -e "${YELLOW}       Alternativa: abra otra terminal y ejecute:${NC}"
            echo -e "${CYAN}       winpty docker exec -it $SELECTED_CONTAINER_NAME bash${NC}"
            echo ""
            # Intentar igualmente
            if docker exec "$SELECTED_CONTAINER_ID" bash -c "echo" >/dev/null 2>&1; then
                docker exec -it "$SELECTED_CONTAINER_ID" bash
            else
                docker exec -it "$SELECTED_CONTAINER_ID" sh
            fi
        fi
    else
        if docker exec "$SELECTED_CONTAINER_ID" bash -c "echo" >/dev/null 2>&1; then
            docker exec -it "$SELECTED_CONTAINER_ID" bash
        else
            docker exec -it "$SELECTED_CONTAINER_ID" sh
        fi
    fi

    pause
    menu_monitoreo
}

monitor_resources() {
    banner_principal "MONITOREO DE RECURSOS"
    if ! check_stack_containers; then pause; menu_monitoreo; return; fi

    echo -e "${CYAN}${BOLD}ESTADISTICAS DE CONTENEDORES${NC}"
    echo -e "${YELLOW}Presione Ctrl+C para salir${NC}"
    echo ""
    docker stats --filter "label=$LABEL_FILTER" \
        --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
    pause
    menu_monitoreo
}

# ==================================================
# ACCIONES - LIMPIEZA
# ==================================================

clean() {
    banner_principal "LIMPIEZA DE RECURSOS"
    if ! validate_compose_env_files; then pause; menu_limpieza; return; fi
    if confirm_action "Limpiar contenedores, redes y volumenes del stack?" "no"; then
        run_cmd "$(build_compose_cmd "down --volumes --remove-orphans")" \
            "Error durante la limpieza" "Limpieza completada"
    fi
    pause
    menu_limpieza
}

clean_volumes() {
    banner_principal "LIMPIAR VOLUMENES"
    if confirm_action "Eliminar todos los volumenes no utilizados?" "no"; then
        run_cmd "docker volume prune -f" \
            "Error al limpiar volumenes" "Volumenes no utilizados eliminados"
    fi
    pause
    menu_limpieza
}

clean_images_enhanced() {
    banner_principal "LIMPIEZA DE IMAGENES"

    local total_images dangling_images
    total_images=$(docker images -q | wc -l | tr -d '[:space:]')
    dangling_images=$(docker images -f "dangling=true" -q | wc -l | tr -d '[:space:]')

    echo -e "${CYAN}${BOLD}ANALISIS DE IMAGENES DOCKER${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
    echo -e "   ${BOLD}Total de imagenes:${NC} $total_images"
    echo -e "   ${YELLOW}Imagenes huerfanas:${NC} $dangling_images"
    echo ""

    if [[ "$dangling_images" -gt 0 ]]; then
        echo -e "${YELLOW}${BOLD}IMAGENES HUERFANAS:${NC}"
        echo -e "${YELLOW}------------------------------------------------${NC}"
        docker images -f "dangling=true" --format "   * {{.ID}} ({{.Size}}) - Creada: {{.CreatedSince}}"
        echo ""
        if confirm_action "Eliminar imagenes huerfanas?" "si"; then
            run_cmd "docker image prune -f" "Error al limpiar" "Imagenes huerfanas eliminadas"
        fi
    fi

    echo ""
    if confirm_action "Eliminar todas las imagenes no utilizadas?" "no"; then
        run_cmd "docker image prune -af" "Error al limpiar" "Imagenes no utilizadas eliminadas"
    fi

    pause
    menu_limpieza
}

clean_all() {
    banner_principal "LIMPIEZA COMPLETA"
    if ! validate_compose_env_files; then pause; menu_limpieza; return; fi

    echo -e "${RED}${BOLD}[!] ADVERTENCIA: Limpieza profunda del sistema${NC}"
    echo -e "${YELLOW}------------------------------------------------${NC}"
    echo -e "${YELLOW}Se eliminaran:${NC}"
    echo -e "   * Contenedores, redes y volumenes del stack"
    echo -e "   * Volumenes huerfanos del stack"
    echo -e "   * Imagenes base e imagenes del proyecto (con confirmacion)"
    echo -e "   * Cache de builds de Docker"
    echo -e "${YELLOW}------------------------------------------------${NC}"
    echo ""

    if ! confirm_action "Iniciar limpieza completa?" "no"; then
        menu_limpieza
        return
    fi

    echo -e "\n${CYAN}${BOLD}PASO 1/3: Limpiando recursos del stack...${NC}"
    run_cmd "$(build_compose_cmd "down --volumes --remove-orphans")" \
        "Error al limpiar recursos del stack" "Recursos del stack eliminados"

    echo -e "\n${CYAN}${BOLD}PASO 2/3: Buscando volumenes huerfanos del stack...${NC}"

    local stack_volumes=()
    while IFS= read -r volume; do
        [[ -n "$volume" ]] && stack_volumes+=("$volume")
    done < <(docker volume ls --filter "dangling=true" --filter "label=$LABEL_FILTER" \
        --format "{{.Name}}" 2>/dev/null)

    if [[ ${#stack_volumes[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Volumenes huerfanos encontrados: ${#stack_volumes[@]}${NC}"
        for volume in "${stack_volumes[@]}"; do
            docker volume rm "$volume" >/dev/null 2>&1 \
                && echo -e "${GREEN}   [OK]  Eliminado: $volume${NC}" \
                || echo -e "${RED}   [ERR] Error al eliminar: $volume${NC}"
        done
    else
        echo -e "${GREEN}[OK]  No se encontraron volumenes huerfanos${NC}"
    fi

    echo -e "\n${CYAN}Eliminando imagenes huerfanas...${NC}"
    docker image prune -f >/dev/null 2>&1
    echo -e "${GREEN}[OK]  Imagenes huerfanas eliminadas${NC}"

    echo -e "\n${CYAN}${BOLD}PASO 3/3: Limpieza de imagenes Docker${NC}"
    local project_name="${PROJECT_NAME:-proyecto}"

    local base_images=()
    while IFS= read -r image; do
        [[ -n "$image" && "$image" != "<none>:<none>" ]] && base_images+=("$image")
    done < <(docker images --format "{{.Repository}}:{{.Tag}}" \
        | grep -v "^${project_name}/" | grep -v "<none>" | sort -u)

    local project_images=()
    while IFS= read -r image; do
        [[ -n "$image" ]] && project_images+=("$image")
    done < <(docker images --format "{{.Repository}}:{{.Tag}}" \
        | grep "^${project_name}/" | sort -u)

    if [[ ${#base_images[@]} -gt 0 ]]; then
        echo -e "\n${BLUE}${BOLD}IMAGENES BASE (${#base_images[@]} encontradas)${NC}"
        for image in "${base_images[@]}"; do
            local size
            size=$(docker images --format "{{.Size}}" "$image" 2>/dev/null | head -1)
            echo -e "   * $image (${size})"
        done
        echo ""
        if confirm_action "Eliminar TODAS las imagenes base?" "no"; then
            local deleted=0
            for image in "${base_images[@]}"; do
                docker rmi -f "$image" >/dev/null 2>&1 \
                    && { echo -e "${GREEN}   [OK]  Eliminada: $image${NC}"; ((deleted++)); } \
                    || echo -e "${RED}   [ERR] Error: $image${NC}"
            done
            echo -e "${GREEN}[OK]  Imagenes base eliminadas: $deleted de ${#base_images[@]}${NC}"
        fi
    fi

    if [[ ${#project_images[@]} -gt 0 ]]; then
        echo -e "\n${MAGENTA}${BOLD}IMAGENES DEL PROYECTO (${#project_images[@]} encontradas)${NC}"
        for image in "${project_images[@]}"; do
            local size
            size=$(docker images --format "{{.Size}}" "$image" 2>/dev/null | head -1)
            echo -e "   * $image (${size})"
        done
        echo ""
        if confirm_action "Eliminar TODAS las imagenes del proyecto?" "no"; then
            local deleted=0
            for image in "${project_images[@]}"; do
                docker rmi -f "$image" >/dev/null 2>&1 \
                    && { echo -e "${GREEN}   [OK]  Eliminada: $image${NC}"; ((deleted++)); } \
                    || echo -e "${RED}   [ERR] Error: $image${NC}"
            done
            echo -e "${GREEN}[OK]  Imagenes del proyecto eliminadas: $deleted de ${#project_images[@]}${NC}"
        fi
    fi

    echo -e "\n${CYAN}Limpiando cache de builds...${NC}"
    docker builder prune -af >/dev/null 2>&1
    echo -e "${GREEN}[OK]  Cache de builds eliminada${NC}"

    echo ""
    echo -e "${CYAN}${BOLD}============================================================${NC}"
    echo -e "${GREEN}${BOLD}[OK]  LIMPIEZA COMPLETA FINALIZADA${NC}"
    echo -e "${CYAN}${BOLD}============================================================${NC}"

    pause
    menu_limpieza
}

drop_persistence() {
    banner_principal "ELIMINAR PERSISTENCIAS"
    local data_root logs_root volumes_root
    data_root="$(get_runtime_data_root)"
    logs_root="$(get_runtime_logs_root)"
    volumes_root="$(get_runtime_volumes_root)"

    echo -e "${RED}${BOLD}[!] ADVERTENCIA: Esta accion eliminara:${NC}"
    echo -e "   * Volumenes Docker nombrados del proyecto"
    echo -e "   * Artefactos de runtime en ${volumes_root}"
    echo -e "   * Datos de ${data_root}"
    echo -e "   * Logs de ${logs_root}"
    echo ""

    if confirm_action "Eliminar todas las persistencias?" "no"; then

        echo -e "${YELLOW}Ajustando permisos de archivos...${NC}"
        ensure_path_writable "$data_root"    "datos persistentes"
        ensure_path_writable "$logs_root"    "logs persistentes"
        ensure_path_writable "$volumes_root" "artefactos runtime"
        echo ""

        if confirm_action "Eliminar volumenes Docker nombrados del proyecto?" "no"; then
            local named_volumes=("${PROJECT_NAME}_frontend_node_modules")
            local deleted_named=false
            for volume_name in "${named_volumes[@]}"; do
                if docker volume inspect "$volume_name" >/dev/null 2>&1; then
                    docker volume rm "$volume_name" >/dev/null 2>&1 \
                        && { deleted_named=true; echo -e "${GREEN}[OK]  Eliminado: $volume_name${NC}"; } \
                        || echo -e "${YELLOW}[WARN] No se pudo eliminar $volume_name (puede estar en uso)${NC}"
                fi
            done
            [[ "$deleted_named" == false ]] && \
                echo -e "${YELLOW}[WARN] No se encontraron volumenes nombrados para eliminar${NC}"
        fi

        if confirm_action "Eliminar artefactos de runtime en ${volumes_root}?" "no"; then
            clean_runtime_artifacts
        fi

        if confirm_action "Eliminar carpetas de ${data_root}?" "no"; then
            remove_directory_contents "$data_root" "$data_root"
        fi

        if confirm_action "Eliminar contenido de ${logs_root}?" "no"; then
            remove_directory_contents "$logs_root" "$logs_root"
        fi
    fi

    pause
    menu_limpieza
}

# ==================================================
# ACCIONES - CONFIGURACIÓN
# ==================================================

change_env() {
    banner_principal "CAMBIAR ENTORNO"

    echo -e "Entorno actual: $(get_env_color)"
    echo ""
    echo -e "Opciones disponibles:"
    echo -e "  ${CYAN}1)${NC} ${GREEN}dev${NC}"
    echo -e "  ${CYAN}2)${NC} ${YELLOW}qa${NC}"
    echo -e "  ${CYAN}3)${NC} ${RED}prd${NC}"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione nuevo entorno: ${NC}")" env_choice

    case "$env_choice" in
        1) ENV="dev" ;;
        2) ENV="qa" ;;
        3) ENV="prd" ;;
        *)
            echo -e "${RED}[ERR] Opcion invalida${NC}"
            sleep 2
            menu_configuracion
            return
            ;;
    esac

    define_compose_file
    echo -e "${GREEN}[OK]  Entorno cambiado a: $(get_env_color)${NC}"
    pause
    menu_configuracion
}

update_ip_menu() {
    banner_principal "ACTUALIZAR IP EXPO / ANDROID"

    local current_ip
    current_ip=$(get_current_ip)
    local env_file=".env"

    if [[ ! -f "$env_file" ]]; then
        echo -e "${RED}[ERR] Archivo .env no encontrado${NC}"
        pause
        menu_configuracion
        return
    fi

    echo -e "IP actual detectada: ${CYAN}$current_ip${NC}"
    echo -e "${BLUE}Se usara para REACT_NATIVE_PACKAGER_HOSTNAME en Expo / android_app.${NC}"

    if [[ -z "$current_ip" ]]; then
        echo -e "${YELLOW}[WARN] No se pudo detectar IP automaticamente${NC}"
        read -rp "Ingrese IP manualmente: " current_ip
    fi

    if confirm_action "Actualizar REACT_NATIVE_PACKAGER_HOSTNAME en .env a $current_ip?" "si"; then
        if grep -q "^REACT_NATIVE_PACKAGER_HOSTNAME=" "$env_file"; then
            sed_in_place "$env_file" "s/^REACT_NATIVE_PACKAGER_HOSTNAME=.*/REACT_NATIVE_PACKAGER_HOSTNAME=${current_ip}/" --backup
        else
            echo "REACT_NATIVE_PACKAGER_HOSTNAME=$current_ip" >> "$env_file"
        fi
        echo -e "${GREEN}[OK]  IP actualizada exitosamente${NC}"
    fi

    pause
    menu_configuracion
}

check_ip_menu() {
    banner_principal "VERIFICAR IP EXPO / ANDROID"

    local current_ip
    current_ip=$(get_current_ip)
    local env_file=".env"

    echo -e "IP actual del equipo: ${CYAN}${current_ip:-No detectada}${NC}"

    if [[ -f "$env_file" ]]; then
        local env_ip
        env_ip=$(grep "^REACT_NATIVE_PACKAGER_HOSTNAME=" "$env_file" | cut -d'=' -f2 | tr -d '\r')
        echo -e "REACT_NATIVE_PACKAGER_HOSTNAME en .env: ${CYAN}${env_ip:-No configurada}${NC}"

        if [[ -n "$current_ip" && -n "$env_ip" ]]; then
            if [[ "$current_ip" == "$env_ip" ]]; then
                echo -e "${GREEN}[OK]  Las IPs coinciden${NC}"
            else
                echo -e "${YELLOW}[WARN] Las IPs NO coinciden${NC}"
            fi
        fi
    fi

    pause
    menu_configuracion
}

validate_container_env() {
    banner_principal "VARIABLES DE ENTORNO"

    local result
    select_container_from_stack "Seleccione contenedor" true false
    result=$?
    [[ $result -ne 0 ]] && { menu_configuracion; return; }

    echo -e "\n${CYAN}${BOLD}Variables de entorno en $SELECTED_CONTAINER_NAME:${NC}"
    echo "============================================================"
    docker exec "$SELECTED_CONTAINER_ID" env 2>/dev/null | sort | nl

    pause
    menu_configuracion
}

# ==================================================
# ACCIONES - VALIDACIÓN
# ==================================================

validate_compose() {
    banner_principal "VALIDAR DOCKER COMPOSE"

    if ! check_file_exists "$COMPOSE_FILE" "validacion de sintaxis"; then
        pause; menu_contenedores; return
    fi
    if ! validate_compose_env_files; then
        pause; menu_contenedores; return
    fi

    echo -e "${BLUE}Validando configuracion...${NC}"
    echo ""

    if eval "$(build_compose_cmd "config")" > /dev/null 2>&1; then
        echo -e "${GREEN}${BOLD}[OK]  VALIDACION EXITOSA${NC}"
        echo ""
        echo -e "${CYAN}SERVICIOS CONFIGURADOS:${NC}"
        eval "$(build_compose_cmd "config --services")" | sed 's/^/   * /'
    else
        echo -e "${RED}${BOLD}[ERR] ERROR DE VALIDACION${NC}"
        echo ""
        eval "$(build_compose_cmd "config")"
    fi

    pause
    menu_contenedores
}

validate_compose_rules() {
    banner_principal "VALIDAR REGLAS DEL COMPOSE"

    if ! check_file_exists "$COMPOSE_FILE" "validacion de reglas"; then
        pause; menu_contenedores; return
    fi
    if ! validate_compose_env_files; then
        pause; menu_contenedores; return
    fi

    # mktemp en Git Bash funciona correctamente
    local tmp_config
    tmp_config="$(mktemp)"

    if ! eval "$(build_compose_cmd "config" "--profile tools")" >"$tmp_config" 2>/dev/null; then
        echo -e "${RED}[ERR] No se pudo expandir la configuracion de Compose${NC}"
        rm -f "$tmp_config"
        pause; menu_contenedores; return
    fi

    local services=()
    while IFS= read -r service_name; do
        [[ -n "$service_name" ]] && services+=("$service_name")
    done < <(eval "$(build_compose_cmd "config --services" "--profile tools")" 2>/dev/null)

    local errors=0 warnings=0

    echo -e "${CYAN}${BOLD}REGLAS EVALUADAS:${NC}"
    echo -e "   * container_name debe usar ${PROJECT_NAME}-<servicio>"
    echo -e "   * labels requeridos: stack, env, service.group, service.lifecycle"
    echo -e "   * service.group debe ser: core, dependency o tools"
    echo -e "   * no deben existir rutas legacy del layout anterior"
    echo ""

    for service_name in "${services[@]}"; do
        local source_block expanded_block expected_container_name group_value

        expected_container_name="${PROJECT_NAME}-${service_name}"
        source_block="$(get_service_block_from_compose "$COMPOSE_FILE" "$service_name")"
        expanded_block="$(awk -v target="$service_name" '
            BEGIN { in_services=0; in_target=0 }
            /^services:/ { in_services=1; next }
            in_services && /^[^[:space:]]/ { if (in_target) exit }
            in_services && $0 ~ ("^  " target ":$") { in_target=1; print; next }
            in_target && /^  [a-zA-Z0-9_-]+:/ { exit }
            in_target { print }
        ' "$tmp_config")"

        echo -e "${BLUE}${BOLD}Servicio:${NC} ${service_name}"

        if [[ -z "$source_block" ]]; then
            echo -e "${RED}   [ERR] No se pudo localizar el bloque del servicio${NC}"
            ((errors++)); continue
        fi

        echo "$expanded_block" | grep -q "container_name: ${expected_container_name}$" \
            && echo -e "${GREEN}   [OK]  container_name correcto (${expected_container_name})${NC}" \
            || { echo -e "${RED}   [ERR] container_name invalido. Se espera ${expected_container_name}${NC}"; ((errors++)); }

        echo "$expanded_block" | grep -q "stack: ${PROJECT_NAME}$" \
            && echo -e "${GREEN}   [OK]  label stack correcto${NC}" \
            || { echo -e "${RED}   [ERR] falta label stack=${PROJECT_NAME}${NC}"; ((errors++)); }

        echo "$expanded_block" | grep -q "env: ${ENV}$" \
            && echo -e "${GREEN}   [OK]  label env correcto${NC}" \
            || { echo -e "${RED}   [ERR] falta label env=${ENV}${NC}"; ((errors++)); }

        group_value="$(echo "$expanded_block" | sed -n 's/^[[:space:]]*service\.group: //p' | head -1 | tr -d '\r')"
        [[ "$group_value" =~ ^(core|dependency|tools)$ ]] \
            && echo -e "${GREEN}   [OK]  service.group valido (${group_value})${NC}" \
            || { echo -e "${RED}   [ERR] service.group invalido o ausente${NC}"; ((errors++)); }

        echo "$expanded_block" | grep -q "service.lifecycle:" \
            && echo -e "${GREEN}   [OK]  service.lifecycle presente${NC}" \
            || { echo -e "${RED}   [ERR] falta service.lifecycle${NC}"; ((errors++)); }

        echo "$source_block" | grep -Eq 'Data/dokerFile|persistence/|APP/data-prd|APP/data-qa|APP/logs-prd|APP/logs-qa|APP/data/settings' \
            && { echo -e "${RED}   [ERR] el servicio usa rutas legacy${NC}"; ((errors++)); }

        echo "$source_block" | grep -qE '^\s+- \./' \
            && { echo -e "${YELLOW}   [WARN] mounts con rutas relativas directas; revisar si deben usar variables${NC}"; ((warnings++)); }

        echo ""
    done

    rm -f "$tmp_config"

    echo -e "${CYAN}${BOLD}============================================================${NC}"
    if [[ $errors -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}[OK]  VALIDACION DE REGLAS SUPERADA${NC}"
    else
        echo -e "${RED}${BOLD}[ERR] VALIDACION DE REGLAS CON ERRORES${NC}"
    fi
    echo -e "${CYAN}Errores:${NC} $errors"
    echo -e "${CYAN}Advertencias:${NC} $warnings"
    echo -e "${CYAN}${BOLD}============================================================${NC}"

    pause
    menu_contenedores
}

# ==================================================
# ACCIONES - BACKUP
# ==================================================

backup_volumes() {
    banner_principal "BACKUP DE VOLUMENES"

    mkdir -p "$BACKUP_DIR"

    echo -e "${CYAN}${BOLD}VOLUMENES DEL PROYECTO:${NC}"
    echo ""

    local volumes=()
    while IFS= read -r volume; do
        [[ -n "$volume" ]] && volumes+=("$volume")
    done < <(list_project_named_volumes)

    if [[ ${#volumes[@]} -eq 0 ]]; then
        echo -e "${YELLOW}[WARN] No hay volumenes nombrados del proyecto${NC}"
        pause; menu_backup; return
    fi

    for i in "${!volumes[@]}"; do
        printf "  ${CYAN}%2d)${NC} %s\n" $((i+1)) "${volumes[$i]}"
    done

    echo ""
    echo "  ${CYAN}T)${NC} Todos los volumenes"
    echo "  ${CYAN}V)${NC} Volver al menu anterior"
    echo ""

    read -rp "$(echo -e "${CYAN}Seleccione volumen a respaldar: ${NC}")" vol_choice

    [[ "$vol_choice" =~ ^[Vv]$ ]] && { menu_backup; return; }

    local volumes_to_backup=()
    if [[ "$vol_choice" =~ ^[Tt]$ ]]; then
        volumes_to_backup=("${volumes[@]}")
    elif [[ "$vol_choice" =~ ^[0-9]+$ ]] && [[ "$vol_choice" -ge 1 ]] && [[ "$vol_choice" -le ${#volumes[@]} ]]; then
        volumes_to_backup=("${volumes[$((vol_choice-1))]}")
    else
        echo -e "${RED}[ERR] Opcion invalida${NC}"
        pause
        backup_volumes
        return
    fi

    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local success_count=0 error_count=0
    # Ruta absoluta en formato Docker compatible con Windows
    local backup_abs
    backup_abs="$(pwd_docker)/${BACKUP_DIR}"

    for volume in "${volumes_to_backup[@]}"; do
        local backup_filename="${volume}_${timestamp}.tar.gz"
        echo -e "${BLUE}Respaldando volumen: $volume${NC}"

        if docker run --rm \
            -v "${volume}:/source" \
            -v "${backup_abs}:/backup" \
            alpine tar czf "/backup/${backup_filename}" -C /source . 2>/dev/null; then
            local size
            size=$(du -h "${BACKUP_DIR}/${backup_filename}" 2>/dev/null | cut -f1)
            echo -e "${GREEN}[OK]  Backup creado: ${BACKUP_DIR}/${backup_filename} (${size})${NC}"
            ((success_count++))
        else
            echo -e "${RED}[ERR] Error al respaldar $volume${NC}"
            ((error_count++))
        fi
    done

    echo ""
    echo -e "${CYAN}============================================================${NC}"
    echo -e "${GREEN}[OK]  Backup completado: $success_count exitosos, $error_count errores${NC}"
    echo -e "${CYAN}============================================================${NC}"

    pause
    menu_backup
}

restore_volume() {
    banner_principal "RESTAURAR VOLUMEN"

    if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]]; then
        echo -e "${YELLOW}[WARN] No hay backups disponibles${NC}"
        pause; menu_backup; return
    fi

    echo -e "${CYAN}${BOLD}BACKUPS DISPONIBLES:${NC}"
    echo ""

    local backups=()
    while IFS= read -r backup; do
        [[ -n "$backup" ]] && backups+=("$backup")
    done < <(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | xargs -n1 basename)

    for i in "${!backups[@]}"; do
        local backup_file="${backups[$i]}"
        local size
        size=$(du -h "$BACKUP_DIR/$backup_file" 2>/dev/null | cut -f1)
        printf "  ${CYAN}%2d)${NC} %-40s ${YELLOW}[%s]${NC}\n" $((i+1)) "$backup_file" "$size"
    done

    echo ""
    read -rp "$(echo -e "${CYAN}Seleccione backup a restaurar: ${NC}")" backup_choice

    if ! [[ "$backup_choice" =~ ^[0-9]+$ ]] || \
       [[ "$backup_choice" -lt 1 ]] || \
       [[ "$backup_choice" -gt ${#backups[@]} ]]; then
        echo -e "${RED}[ERR] Opcion invalida${NC}"
        pause; return
    fi

    local selected_backup="${backups[$((backup_choice-1))]}"
    local volume_name
    volume_name="$(get_volume_name_from_backup "$selected_backup")"

    if [[ -z "$volume_name" ]]; then
        echo -e "${RED}[ERR] No se pudo determinar el volumen desde $selected_backup${NC}"
        pause; menu_backup; return
    fi

    echo ""
    echo -e "${YELLOW}[!] Se restaurara el volumen: $volume_name${NC}"

    if ! confirm_action "Continuar con la restauracion?" "no"; then
        menu_backup; return
    fi

    if docker volume ls -q | grep -q "^$volume_name$"; then
        if confirm_action "Eliminar volumen existente antes de restaurar?" "no"; then
            docker volume rm "$volume_name" >/dev/null 2>&1
        else
            echo -e "${BLUE}Restauracion cancelada${NC}"
            pause; return
        fi
    fi

    docker volume create "$volume_name" >/dev/null
    echo -e "${GREEN}[OK]  Volumen creado: $volume_name${NC}"

    local backup_abs
    backup_abs="$(pwd_docker)/${BACKUP_DIR}"

    if docker run --rm \
        -v "${volume_name}:/target" \
        -v "${backup_abs}:/backup" \
        alpine tar xzf "/backup/$selected_backup" -C /target 2>/dev/null; then
        echo -e "${GREEN}[OK]  Volumen restaurado exitosamente${NC}"
    else
        echo -e "${RED}[ERR] Error al restaurar el volumen${NC}"
    fi

    pause
    menu_backup
}

# ==================================================
# SALIDA
# ==================================================

exit_script() {
    clear
    echo -e "${CYAN}${BOLD}============================================================${NC}"
    echo -e "${GREEN}${BOLD}   Gracias por usar Docker Tools!${NC}"
    echo -e "${CYAN}${BOLD}============================================================${NC}"
    echo ""
    echo -e "${BLUE}Todos los procesos han sido cerrados correctamente.${NC}"
    echo ""
    exit 0
}

# ==================================================
# MAIN
# ==================================================

main() {
    clear

    detect_windows_env
    setup_colors

    check_dependencies

    ENV="dev"
    PROJECT_NAME=$(read_project_name)
    STACK="${PROJECT_NAME:-NoExisteStackName}"
    LABEL_FILTER="stack=${STACK}"
    COMPOSE_FILE=""
    CURRENT_IP=""
    BACKUP_DIR="docker-backups"
    PORTAINER_NAME="portainer"
    PORTAINER_IMAGE="portainer/portainer-ce:latest"

    # Variables de selección (globales)
    SELECTED_CONTAINER_ID=""
    SELECTED_CONTAINER_NAME=""
    SELECTED_PROFILE_ARGS=""
    SELECTED_SERVICE_ARGS=""
    STACK_CONTAINERS=()
    STACK_CONTAINER_COUNT=0

    define_compose_file
    menu
}

main "$@"