#!/bin/bash

# ==================================================
# Docker Tools - Versión Mejorada
# Enfoque: Robustez, Refactorización y UX/UI
# ==================================================

# ==================================================
# CONFIGURACIÓN Y CONSTANTES (Punto 4: UX/UI - Colores)
# ==================================================

# Configuración de colores mejorada con tput (compatible)
setup_colors() {
    if [[ -t 1 ]]; then  # Verifica si es terminal interactiva
        if command -v tput &> /dev/null; then
            RED=$(tput setaf 1)
            GREEN=$(tput setaf 2)
            YELLOW=$(tput setaf 3)
            BLUE=$(tput setaf 4)
            MAGENTA=$(tput setaf 5)
            CYAN=$(tput setaf 6)
            WHITE=$(tput setaf 7)
            BOLD=$(tput bold)
            NC=$(tput sgr0) # No Color
        else
            # Fallback a códigos ANSI si tput no está disponible
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
        RED=""; GREEN=""; YELLOW=""; BLUE=""; MAGENTA=""; CYAN=""; WHITE=""; BOLD=""; NC=""
    fi
    
    # Emojis consistentes para feedback (Punto 4)
    ICON_SUCCESS="✅"
    ICON_ERROR="❌"
    ICON_WARNING="⚠️"
    ICON_INFO="ℹ️"
    ICON_QUESTION="👉"
    ICON_CONTAINER="📦"
    ICON_DOCKER="🐳"
    ICON_MENU="📋"
    ICON_SETTINGS="⚙️"
}

# ==================================================
# FUNCIONES ORIGINALES NECESARIAS
# ==================================================

# Función para leer PROJECT_NAME desde .env
read_project_name() {
    local env_file=".env"
    
    if [[ -f "$env_file" ]]; then
        local project_line=$(grep "^PROJECT_NAME=" "$env_file" 2>/dev/null)
        if [[ -n "$project_line" ]]; then
            echo "$project_line" | cut -d'=' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//'
        else
            echo ""
        fi
    else
        echo ""
    fi
}

# Función para definir archivo compose según entorno
define_compose_file() {
    case "$ENV" in
        "dev")
            COMPOSE_FILE="docker-compose-dev.yml"
            ;;
        "qa")
            COMPOSE_FILE="docker-compose-qa.yml"
            ;;
        "prd")
            COMPOSE_FILE="docker-compose.yml"
            ;;
        *)
            echo "Entorno no válido. Se usará el archivo por defecto: docker-compose-dev.yml"
            COMPOSE_FILE="docker-compose-dev.yml"
            ;;
    esac
}

# Función para obtener IP actual (versión simplificada)
get_current_ip() {
    local ip=""
    
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -n "$MSYSTEM" ]]; then
        if command -v ipconfig &> /dev/null; then
            ip=$(ipconfig 2>/dev/null | grep -a "IPv4" | grep -v "127.0.0.1" | head -1 | sed 's/.*: //' | tr -d '\r')
        fi
    else
        if command -v ip &> /dev/null; then
            ip=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
        fi
        if [[ -z "$ip" ]] && command -v hostname &> /dev/null; then
            ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        fi
    fi
    
    echo "$ip"
}

# Función para pausar
pause() {
    echo ""
    read -p "$(echo -e ${CYAN}"Presione Enter para continuar..."${NC})"
}

# ==================================================
# VERIFICACIÓN DE DEPENDENCIAS (Punto 1: Robustez)
# ==================================================

# Verificar dependencias críticas
check_dependencies() {
    local missing_deps=()
    local has_errors=false
    
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}🔍 VERIFICANDO DEPENDENCIAS DEL SISTEMA${NC}"
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Verificar Docker CLI
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
        has_errors=true
    else
        echo -e "${GREEN}✅ Docker CLI: Encontrado${NC}"
        
        # Verificar que Docker daemon esté corriendo
        if ! docker info &> /dev/null; then
            echo -e "${RED}❌ Docker daemon: No está en ejecución${NC}"
            echo -e "${YELLOW}   └─ Solución: Inicie Docker Desktop o el servicio Docker${NC}"
            has_errors=true
        else
            echo -e "${GREEN}✅ Docker daemon: En ejecución${NC}"
        fi
    fi
    
    # Verificar Docker Compose (plugin o standalone)
    if docker compose version &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose (plugin): Encontrado${NC}"
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose (standalone): Encontrado${NC}"
        COMPOSE_CMD="docker-compose"
    else
        missing_deps+=("docker-compose")
        has_errors=true
    fi
    
    # Verificar comandos esenciales de Unix
    local essential_commands=("grep" "cut" "sed" "awk")
    for cmd in "${essential_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
            has_errors=true
        else
            echo -e "${GREEN}✅ $cmd: Encontrado${NC}"
        fi
    done
    
    echo ""
    
    # Mostrar resultados de verificación
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        echo -e "${RED}${BOLD}❌ ERROR: Dependencias críticas faltantes:${NC}"
        for dep in "${missing_deps[@]}"; do
            echo -e "${RED}   └─ $dep${NC}"
        done
        echo ""
        echo -e "${YELLOW}💡 Instale las dependencias faltantes e intente nuevamente.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}${BOLD}✅ Verificación de dependencias completada exitosamente${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    sleep 2
}

# ==================================================
# FUNCIONES DE UTILIDAD ROBUSTAS (Punto 1)
# ==================================================

# Función segura para sed -i (compatible Linux/macOS)
sed_in_place() {
    local file="$1"
    local pattern="$2"
    local backup_ext=""
    
    # Crear backup automático
    if [[ "$3" == "--backup" ]]; then
        local backup_file="${file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$file" "$backup_file"
        echo -e "${BLUE}📋 Backup creado: $backup_file${NC}"
    fi
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$pattern" "$file"
    else
        sed -i "$pattern" "$file"
    fi
    
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        echo -e "${RED}❌ Error al modificar $file${NC}"
        return 1
    fi
    return 0
}

# Ejecutar comando con manejo de errores mejorado
run_cmd() {
    local cmd="$1"
    local error_msg="${2:-Error al ejecutar el comando}"
    local success_msg="${3:-Comando ejecutado exitosamente}"
    local exit_code
    
    echo -e "${CYAN}▶ Ejecutando: $cmd${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────${NC}"
    
    # Ejecutar el comando directamente para ver el output en tiempo real
    eval "$cmd"
    exit_code=$?
    
    echo -e "${CYAN}────────────────────────────────────────────────${NC}"
    
    if [[ $exit_code -ne 0 ]]; then
        echo -e "${RED}❌ $error_msg (código: $exit_code)${NC}"
        return $exit_code
    fi
    
    echo -e "${GREEN}✅ $success_msg${NC}"
    return 0
}

# Verificar existencia de archivo con mensaje claro
check_file_exists() {
    local file="$1"
    local purpose="${2:-operación}"
    
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}❌ Error: Archivo no encontrado: $file${NC}"
        echo -e "${YELLOW}   └─ Necesario para: $purpose${NC}"
        return 1
    fi
    return 0
}

# Verificar que el stack tenga contenedores
check_stack_containers() {
    local count=$(docker ps --filter "label=$LABEL_FILTER" -q 2>/dev/null | wc -l)
    if [[ $count -eq 0 ]]; then
        echo -e "${YELLOW}⚠️  No hay contenedores activos con etiqueta: $LABEL_FILTER${NC}"
        echo -e "${BLUE}   └─ Use la opción 1 del menú principal para iniciarlos${NC}"
        return 1
    fi
    return 0
}

# ==================================================
# FUNCIONES REFACTORIZADAS (Punto 2)
# ==================================================

# Función unificada para listar contenedores del stack
list_stack_containers() {
    local format="${1:-simple}"
    local include_all="${2:-false}"
    local containers=()
    local docker_cmd="docker ps"
    
    if [[ "$include_all" == "true" ]]; then
        docker_cmd="docker ps -a"
    fi
    
    # Usar delimitador seguro (|) para evitar problemas con espacios
    while IFS= read -r line; do
        [[ -n "$line" ]] && containers+=("$line")
    done < <($docker_cmd --filter "label=$LABEL_FILTER" --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}" 2>/dev/null)
    
    if [[ ${#containers[@]} -eq 0 ]]; then
        echo -e "${YELLOW}⚠️  No se encontraron contenedores con la etiqueta: $LABEL_FILTER${NC}"
        return 1
    fi
    
    echo ""
    case "$format" in
        "simple")
            printf "${BOLD}%-4s %-25s %-15s${NC}\n" "#" "NOMBRE" "ESTADO"
            echo "----------------------------------------------------"
            for i in "${!containers[@]}"; do
                IFS='|' read -r id name image status ports <<< "${containers[$i]}"
                local status_color="${GREEN}"
                [[ "$status" == *"Exited"* ]] && status_color="${RED}"
                [[ "$status" == *"Paused"* ]] && status_color="${YELLOW}"
                printf "%-4d %-25.25s ${status_color}%-15.15s${NC}\n" $((i+1)) "$name" "$status"
            done
            ;;
        "detailed")
            printf "${BOLD}%-4s %-25s %-30s %-15s %-25s${NC}\n" "#" "NOMBRE" "IMAGEN" "ESTADO" "PUERTOS"
            echo "------------------------------------------------------------------------------------------"
            for i in "${!containers[@]}"; do
                IFS='|' read -r id name image status ports <<< "${containers[$i]}"
                local status_color="${GREEN}"
                [[ "$status" == *"Exited"* ]] && status_color="${RED}"
                [[ "$status" == *"Paused"* ]] && status_color="${YELLOW}"
                printf "%-4d %-25.25s %-30.30s ${status_color}%-15.15s${NC} %-25.25s\n" $((i+1)) "$name" "$image" "$status" "$ports"
            done
            ;;
    esac
    
    # Guardar en variable global para uso posterior
    STACK_CONTAINERS=("${containers[@]}")
    STACK_CONTAINER_COUNT=${#containers[@]}
    return 0
}

# Función unificada para seleccionar un contenedor del stack
select_container_from_stack() {
    local prompt="${1:-Seleccione el número del contenedor}"
    local allow_exit="${2:-true}"
    local show_all="${3:-false}"
    local selected_id=""
    local selected_name=""
    local selected_index=""
    
    echo -e "\n${CYAN}${BOLD}📋 CONTENEDORES DISPONIBLES:${NC}"
    
    if ! list_stack_containers "detailed" "$show_all"; then
        return 1
    fi
    
    local exit_index=$(( STACK_CONTAINER_COUNT + 1 ))
    echo ""
    
    if [[ "$allow_exit" == "true" ]]; then
        echo -e "${YELLOW}${exit_index}) ⬅️ Volver al menú anterior${NC}"
    fi
    
    echo ""
    read -p "$(echo -e ${CYAN}"$prompt: "${NC})" index
    
    if [[ "$allow_exit" == "true" ]] && [[ "$index" == "$exit_index" || "$index" == "0" ]]; then
        return 2  # Código especial para volver
    fi
    
    if ! [[ "$index" =~ ^[0-9]+$ ]] || [[ "$index" -lt 1 ]] || [[ "$index" -gt $STACK_CONTAINER_COUNT ]]; then
        echo -e "${RED}❌ Índice inválido. Debe ser un número entre 1 y $STACK_CONTAINER_COUNT${NC}"
        sleep 2
        return 1
    fi
    
    IFS='|' read -r selected_id selected_name _ <<< "${STACK_CONTAINERS[$((index-1))]}"
    
    # Retornar valores usando variables globales
    SELECTED_CONTAINER_ID="$selected_id"
    SELECTED_CONTAINER_NAME="$selected_name"
    
    echo -e "${GREEN}✅ Seleccionado: $selected_name${NC}"
    return 0
}

# Función para confirmar acciones destructivas (Punto 4 - UX)
confirm_action() {
    local message="$1"
    local default="${2:-no}"
    local response
    
    echo ""
    echo -e "${YELLOW}${BOLD}⚠️  CONFIRMACIÓN REQUERIDA${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}$message${NC}"
    echo ""
    
    if [[ "$default" == "si" ]]; then
        read -p "$(echo -e ${CYAN}"¿Continuar? [S/n]: "${NC})" response
        response=${response:-S}
    else
        read -p "$(echo -e ${CYAN}"¿Continuar? [s/N]: "${NC})" response
        response=${response:-N}
    fi
    
    if [[ "$response" =~ ^[Ss]$ ]]; then
        echo -e "${BLUE}⏳ Procediendo...${NC}"
        return 0
    else
        echo -e "${BLUE}⏭️  Operación cancelada${NC}"
        return 1
    fi
}

# ==================================================
# BANNER MEJORADO CON COLORES (Punto 4 - UX)
# ==================================================

banner_principal() {
    local title="$1"
    clear
    
    echo -e "${CYAN}${BOLD}╔═══════════════════════════════════════════════════════════╗${NC}"
    printf "${CYAN}${BOLD}║              DOCKER TOOLS - %-25s║${NC}\n" "$title"
    echo -e "${CYAN}${BOLD}╚═══════════════════════════════════════════════════════════╝${NC}"
    
    # Mostrar información del entorno con colores
    local current_ip=""
    if [[ -n "$CURRENT_IP" ]]; then
        current_ip="$CURRENT_IP"
    else
        current_ip=$(get_current_ip 2>/dev/null || echo "No detectada")
    fi
    
    local git_info=""
    if git rev-parse --is-inside-work-tree 2>/dev/null; then
        git_info="${GREEN}$(git rev-parse --abbrev-ref HEAD 2>/dev/null)${NC}"
    else
        git_info="${YELLOW}No es repositorio Git${NC}"
    fi
    
    echo -e "${BLUE}${BOLD}📋 INFORMACIÓN DEL ENTORNO:${NC}"
    echo -e "   ${CYAN}Archivo:${NC} $COMPOSE_FILE"
    echo -e "   ${CYAN}Stack:${NC} $STACK"
    echo -e "   ${CYAN}Entorno:${NC} $(get_env_color)"
    echo -e "   ${CYAN}IP Actual:${NC} $current_ip"
    echo -e "   ${CYAN}Rama Git:${NC} $git_info"
    echo ""
}

get_env_color() {
    case "$ENV" in
        "dev")  echo -e "${GREEN}dev${NC}" ;;
        "qa")   echo -e "${YELLOW}qa${NC}" ;;
        "prd")  echo -e "${RED}prd${NC}" ;;
        *)      echo -e "$ENV" ;;
    esac
}

# ==================================================
# FUNCIONES DE MENÚ (Punto 2)
# ==================================================

# Menú principal
menu() {
    banner_principal "MENÚ PRINCIPAL"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} ${ICON_CONTAINER} MANEJADOR DE CONTENEDORES"
    echo -e "  ${CYAN}2)${NC} 📊 MONITOREO Y DIAGNÓSTICO"
    echo -e "  ${CYAN}3)${NC} 🧹 LIMPIEZA Y MANTENIMIENTO"
    echo -e "  ${CYAN}4)${NC} ${ICON_SETTINGS} CONFIGURACIÓN DEL SISTEMA"
    echo -e "  ${CYAN}5)${NC} 📱 HERRAMIENTAS EXPO"
    echo -e "  ${CYAN}6)${NC} 📄 GESTIÓN DE TEMPLATES .ENV"
    echo -e "  ${CYAN}7)${NC} ${ICON_DOCKER} ESTADO Y SERVICIOS DOCKER"
    echo -e "  ${CYAN}8)${NC} 🧰 PORTAINER"
    echo -e "  ${CYAN}9)${NC} 💾 BACKUP Y RESTORE"
    echo ""
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
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
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu
            ;;
    esac
}

# Menú de contenedores
menu_contenedores() {
    banner_principal "MANEJADOR DE CONTENEDORES"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} 🚀 Iniciar contenedores y construir imagenes"
    echo -e "  ${CYAN}2)${NC} 🛑 Detener y eliminar contenedores"
    echo -e "  ${CYAN}3)${NC} 🔄 Reiniciar contenedores"
    echo -e "  ${CYAN}4)${NC} 🔃 Reiniciar contenedor unico"
    echo -e "  ${CYAN}5)${NC} 🔨 Construir imágenes"
    echo -e "  ${CYAN}6)${NC} 🔍 Validar Docker Compose"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) up ;;
        2) down ;;
        3) restart ;;
        4) restart_single_container ;;
        5) build ;;
        6) validate_compose ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_contenedores
            ;;
    esac
}

# Menú de monitoreo
menu_monitoreo() {
    banner_principal "MONITOREO Y DIAGNÓSTICO"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} 📋 Ver logs"
    echo -e "  ${CYAN}2)${NC} 📊 Estado de los contenedores"
    echo -e "  ${CYAN}3)${NC} 📦 Listar contenedores de stack"
    echo -e "  ${CYAN}4)${NC} 💻 Abrir terminal en contenedor"
    echo -e "  ${CYAN}5)${NC} 📈 Monitoreo de recursos"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) logs ;;
        2) ps ;;
        3) list_stack ;;
        4) exec_stack ;;
        5) monitor_resources ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_monitoreo
            ;;
    esac
}

# Menú de limpieza
menu_limpieza() {
    banner_principal "LIMPIEZA Y MANTENIMIENTO"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} 🧹 Limpiar contenedores, redes y volúmenes"
    echo -e "  ${CYAN}2)${NC} 🖼️ Limpiar imágenes no utilizadas"
    echo -e "  ${CYAN}3)${NC} 💾 Limpiar volúmenes no utilizados"
    echo -e "  ${CYAN}4)${NC} 🗑️ Limpiar todo"
    echo -e "  ${CYAN}5)${NC} 🔥 Eliminar Persistencias"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) clean ;;
        2) clean_images_enhanced ;;
        3) clean_volumes ;;
        4) clean_all ;;
        5) drop_persistence ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_limpieza
            ;;
    esac
}

# Menú de configuración
menu_configuracion() {
    banner_principal "CONFIGURACIÓN DEL SISTEMA"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} 🔧 Cambiar entorno (dev, qa, prd)"
    echo -e "  ${CYAN}2)${NC} 🌐 Actualizar IP en Docker Compose"
    echo -e "  ${CYAN}3)${NC} 🔍 Verificar IP actual"
    echo -e "  ${CYAN}4)${NC} 📋 Listar variables de entorno"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) change_env ;;
        2) update_ip_menu ;;
        3) check_ip_menu ;;
        4) validate_container_env ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_configuracion
            ;;
    esac
}

# Menú de backup
menu_backup() {
    banner_principal "BACKUP Y RESTORE"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} 💾 Backup de volúmenes"
    echo -e "  ${CYAN}2)${NC} 🔄 Restaurar volumen"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) backup_volumes ;;
        2) restore_volume ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_backup
            ;;
    esac
}

# ==================================================
# FUNCIONES DE ACCIÓN (Simplificadas para este ejemplo)
# ==================================================

up() {
    banner_principal "INICIAR CONTENEDORES"
    run_cmd "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV up -d --build" \
            "Error al iniciar contenedores" \
            "Contenedores iniciados exitosamente"
    pause
    menu_contenedores
}

down() {
    banner_principal "DETENER CONTENEDORES"
    if confirm_action "¿Detener y eliminar todos los contenedores del stack?" "no"; then
        run_cmd "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV down" \
                "Error al detener contenedores" \
                "Contenedores detenidos exitosamente"
    fi
    pause
    menu_contenedores
}

restart() {
    banner_principal "REINICIAR CONTENEDORES"
    if confirm_action "¿Reiniciar todos los contenedores del stack?" "no"; then
        run_cmd "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV down" \
                "Error al detener contenedores"
        run_cmd "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV up -d --build" \
                "Error al iniciar contenedores" \
                "Contenedores reiniciados exitosamente"
    fi
    pause
    menu_contenedores
}

restart_single_container() {
    banner_principal "REINICIAR CONTENEDOR ÚNICO"
    
    if ! select_container_from_stack "Seleccione contenedor a reiniciar" true false; then
        menu_contenedores
        return
    fi
    
    if confirm_action "¿Reiniciar contenedor $SELECTED_CONTAINER_NAME?" "no"; then
        run_cmd "docker restart $SELECTED_CONTAINER_ID" \
                "Error al reiniciar contenedor" \
                "Contenedor reiniciado exitosamente"
    fi
    
    pause
    menu_contenedores
}

build() {
    banner_principal "CONSTRUIR IMÁGENES"
    run_cmd "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV build" \
            "Error al construir imágenes" \
            "Imágenes construidas exitosamente"
    pause
    menu_contenedores
}

logs() {
    banner_principal "VER LOGS"
    $COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV logs -f
    pause
    menu_monitoreo
}

ps() {
    banner_principal "ESTADO DE CONTENEDORES"
    $COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV ps
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
    
    if ! select_container_from_stack "Seleccione contenedor para acceder" true false; then
        menu_monitoreo
        return
    fi
    
    echo -e "${GREEN}Conectando a $SELECTED_CONTAINER_NAME...${NC}"
    
    # Intentar bash, luego sh
    if docker exec -it "$SELECTED_CONTAINER_ID" bash -c "echo" 2>/dev/null; then
        docker exec -it "$SELECTED_CONTAINER_ID" bash
    else
        docker exec -it "$SELECTED_CONTAINER_ID" sh
    fi
    
    pause
    menu_monitoreo
}

clean() {
    banner_principal "LIMPIEZA DE RECURSOS"
    if confirm_action "¿Limpiar contenedores, redes y volúmenes del stack?" "no"; then
        run_cmd "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV down --volumes --remove-orphans" \
                "Error durante la limpieza" \
                "Limpieza completada"
    fi
    pause
    menu_limpieza
}

clean_volumes() {
    banner_principal "LIMPIAR VOLÚMENES"
    if confirm_action "¿Eliminar todos los volúmenes no utilizados?" "no"; then
        run_cmd "docker volume prune -f" \
                "Error al limpiar volúmenes" \
                "Volúmenes no utilizados eliminados"
    fi
    pause
    menu_limpieza
}

clean_all() {
    banner_principal "LIMPIEZA COMPLETA"
    
    echo -e "${RED}${BOLD}⚠️  ADVERTENCIA: Esta acción realizará una limpieza profunda del sistema${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Se eliminarán:${NC}"
    echo -e "   • Contenedores, redes y volúmenes del stack actual"
    echo -e "   • Volúmenes huérfanos relacionados con el stack"
    echo -e "   • Imágenes base e Imágenes proyecto (Confirmación)"
    echo -e "   • Caché de builds de Docker"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
     # PRIMERA CONFIRMACIÓN: Inicio de limpieza
    if ! confirm_action "¿Iniciar limpieza completa?" "no"; then
        menu_limpieza
        return
    fi
    
    # PASO 1: Limpiar contenedores, redes y volúmenes del stack
    echo -e "\n${CYAN}${BOLD}📦 PASO 1/3: Limpiando recursos del stack...${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────${NC}"
    
    run_cmd "$COMPOSE_CMD -f $COMPOSE_FILE --env-file .env --env-file .env.$ENV down --volumes --remove-orphans" \
            "Error al limpiar recursos del stack" \
            "Recursos del stack eliminados"
    
    # PASO 2: Limpiar volúmenes huérfanos del stack
    echo -e "\n${CYAN}${BOLD}💾 PASO 2/3: Buscando volúmenes huérfanos del stack...${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────${NC}"
    
    local stack_volumes=()
    while IFS= read -r volume; do
        stack_volumes+=("$volume")
    done < <(docker volume ls --filter "dangling=true" --filter "label=$LABEL_FILTER" --format "{{.Name}}" 2>/dev/null)
    
    if [[ ${#stack_volumes[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Se encontraron ${#stack_volumes[@]} volúmenes huérfanos del stack:${NC}"
        for volume in "${stack_volumes[@]}"; do
            echo -e "   • $volume"
        done
        echo ""
        
        for volume in "${stack_volumes[@]}"; do
            docker volume rm "$volume" >/dev/null 2>&1 && \
                echo -e "${GREEN}   ✅ Eliminado: $volume${NC}" || \
                echo -e "${RED}   ❌ Error al eliminar: $volume${NC}"
        done
    else
        echo -e "${GREEN}✅ No se encontraron volúmenes huérfanos del stack${NC}"
    fi
    
    # Limpiar imágenes huérfanas (automático)
    echo -e "\n${CYAN}${BOLD}🗑️  Eliminando imágenes huérfanas...${NC}"
    docker image prune -f >/dev/null 2>&1
    echo -e "${GREEN}✅ Imágenes huérfanas eliminadas${NC}"
    
    # PASO 3: Limpieza de imágenes (con consultas separadas)
    echo -e "\n${CYAN}${BOLD}🖼️  PASO 3/3: Limpieza de imágenes Docker${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────${NC}"
    
    local project_name="${PROJECT_NAME:-inventario}"
    
    # Obtener imágenes base (excluyendo las del proyecto)
    local base_images=()
    while IFS= read -r image; do
        if [[ -n "$image" && "$image" != "<none>:<none>" ]]; then
            base_images+=("$image")
        fi
    done < <(docker images --format "{{.Repository}}:{{.Tag}}" | grep -v "^${project_name}/" | grep -v "<none>" | sort -u)
    
    # Obtener imágenes del proyecto
    local project_images=()
    while IFS= read -r image; do
        if [[ -n "$image" ]]; then
            project_images+=("$image")
        fi
    done < <(docker images --format "{{.Repository}}:{{.Tag}}" | grep "^${project_name}/" | sort -u)
    
    # SEGUNDA CONFIRMACIÓN: Imágenes base (externas)
    if [[ ${#base_images[@]} -gt 0 ]]; then
        echo -e "\n${BLUE}${BOLD}📦 IMÁGENES BASE (EXTERNAS) - ${#base_images[@]} encontradas${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}Estas imágenes son descargadas de Docker Hub:${NC}"
        echo ""
        
        # Mostrar lista de imágenes base
        for image in "${base_images[@]}"; do
            local size=$(docker images --format "{{.Size}}" "$image" 2>/dev/null | head -1)
            echo -e "   • $image ${CYAN}(${size})${NC}"
        done
        echo ""
        
        if confirm_action "¿Eliminar TODAS las imágenes base?" "no"; then
            echo -e "${YELLOW}Eliminando imágenes base...${NC}"
            local deleted=0
            for image in "${base_images[@]}"; do
                if docker rmi -f "$image" >/dev/null 2>&1; then
                    echo -e "${GREEN}   ✅ Eliminada: $image${NC}"
                    ((deleted++))
                else
                    echo -e "${RED}   ❌ Error al eliminar: $image${NC}"
                fi
            done
            echo -e "${GREEN}✅ Imágenes base eliminadas: $deleted de ${#base_images[@]}${NC}"
        else
            echo -e "${BLUE}⏭️  Imágenes base conservadas${NC}"
        fi
    else
        echo -e "\n${GREEN}✅ No hay imágenes base para eliminar${NC}"
    fi
    
    # TERCERA CONFIRMACIÓN: Imágenes del proyecto
    if [[ ${#project_images[@]} -gt 0 ]]; then
        echo -e "\n${MAGENTA}${BOLD}🏗️  IMÁGENES DEL PROYECTO - ${#project_images[@]} encontradas${NC}"
        echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}Estas imágenes fueron construidas desde Dockerfiles locales:${NC}"
        echo ""
        
        # Mostrar lista de imágenes del proyecto
        for image in "${project_images[@]}"; do
            local size=$(docker images --format "{{.Size}}" "$image" 2>/dev/null | head -1)
            echo -e "   • $image ${CYAN}(${size})${NC}"
        done
        echo ""
        
        if confirm_action "¿Eliminar TODAS las imágenes del proyecto?" "no"; then
            echo -e "${YELLOW}Eliminando imágenes del proyecto...${NC}"
            local deleted=0
            for image in "${project_images[@]}"; do
                if docker rmi -f "$image" >/dev/null 2>&1; then
                    echo -e "${GREEN}   ✅ Eliminada: $image${NC}"
                    ((deleted++))
                else
                    echo -e "${RED}   ❌ Error al eliminar: $image${NC}"
                fi
            done
            echo -e "${GREEN}✅ Imágenes del proyecto eliminadas: $deleted de ${#project_images[@]}${NC}"
        else
            echo -e "${BLUE}⏭️  Imágenes del proyecto conservadas${NC}"
        fi
    else
        echo -e "\n${GREEN}✅ No hay imágenes del proyecto para eliminar${NC}"
    fi
    
    # Limpiar caché de builds (automático)
    echo -e "\n${CYAN}${BOLD}🧹 Limpiando caché de builds...${NC}"
    docker builder prune -af >/dev/null 2>&1
    echo -e "${GREEN}✅ Caché de builds eliminada${NC}"
    
    # RESUMEN FINAL
    echo ""
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}✅ LIMPIEZA COMPLETA FINALIZADA${NC}"
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
    
    pause
    menu_limpieza
}

drop_persistence() {
    banner_principal "ELIMINAR PERSISTENCIAS"
    
    echo -e "${RED}${BOLD}⚠️  ADVERTENCIA: Esta acción eliminará:${NC}"
    echo -e "   • Datos de bases de datos (volumes/*)"
    echo -e "   • node_modules, package-lock.json y __pycache__"
    echo -e "   • Datos de APP/data/*_data"
    echo -e "   • Logs de APP/logs"
    echo ""
    
    if confirm_action "¿Eliminar todas las persistencias?" "no"; then
        
        # ===========================================
        # CAMBIAR PERMISOS (siempre se ejecuta)
        # ===========================================
        echo -e "${YELLOW}Cambiando permisos de archivos...${NC}"
        
        # Cambiar permisos de data
        if [[ -d ./APP/data ]]; then
            sudo chown -R vsoto:vsoto ./APP/data/*_data 2>/dev/null
            echo -e "${GREEN}✅ Permisos actualizados: APP/data/*_data${NC}"
        fi
        
        # Cambiar permisos de logs
        if [[ -d ./APP/logs ]]; then
            sudo chown -R vsoto:vsoto ./APP/logs 2>/dev/null
            echo -e "${GREEN}✅ Permisos actualizados: APP/logs${NC}"
        fi
        
        echo ""
        
        # ===========================================
        # 1. VOLÚMENES DOCKER
        # ===========================================
        if confirm_action "¿Eliminar volúmenes de Docker (volumes/*)?" "no"; then
            # Verificar contenedores en ejecución
            local active_containers=$(docker ps --format "{{.Names}}")
            
            # Eliminar volúmenes de servicios específicos
            for service in mailpit mariadb minio rabbitmq redis redisinsight; do
                if echo "$active_containers" | grep -q "$service"; then
                    echo -e "${YELLOW}⚠️  $service está en ejecución - NO se elimina${NC}"
                else
                    if [[ -d "volumes/$service" ]]; then
                        rm -rf "volumes/$service" 2>/dev/null && \
                            echo -e "${GREEN}✅ Eliminado: volumes/$service${NC}" || \
                            echo -e "${RED}❌ Error al eliminar volumes/$service${NC}"
                    fi
                fi
            done
        else
            echo -e "${YELLOW}⏭️  Omitida eliminación de volúmenes Docker${NC}"
        fi
        
        # ===========================================
        # 2. NODE_MODULES, PACKAGE-LOCK Y PYCACHE
        # ===========================================
        if confirm_action "¿Eliminar node_modules, package-lock.json y __pycache__?" "no"; then
            # node_modules
            find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null && \
                echo -e "${GREEN}✅ Eliminados: node_modules${NC}"
            
            # package-lock.json
            find . -type f -name "package-lock.json" -exec rm -f {} + 2>/dev/null && \
                echo -e "${GREEN}✅ Eliminados: package-lock.json${NC}"
            
            # __pycache__
            find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null && \
                echo -e "${GREEN}✅ Eliminados: __pycache__${NC}"
        else
            echo -e "${YELLOW}⏭️  Omitida eliminación de node_modules, package-lock y __pycache__${NC}"
        fi
        
        # ===========================================
        # 3. APP/DATA/*_DATA
        # ===========================================
        if confirm_action "¿Eliminar carpetas APP/data/*_data?" "no"; then
            if [[ -d ./APP/data ]]; then
                local data_found=false
                for data_dir in ./APP/data/*_data; do
                    if [[ -d "$data_dir" ]]; then
                        data_found=true
                        rm -rf "$data_dir" 2>/dev/null && \
                            echo -e "${GREEN}✅ Eliminado: $data_dir${NC}" || \
                            echo -e "${RED}❌ Error al eliminar $data_dir${NC}"
                    fi
                done
                if [[ "$data_found" == false ]]; then
                    echo -e "${YELLOW}⚠️  No se encontraron carpetas *_data en APP/data${NC}"
                fi
            else
                echo -e "${YELLOW}⚠️  No existe el directorio APP/data${NC}"
            fi
        else
            echo -e "${YELLOW}⏭️  Omitida eliminación de APP/data/*_data${NC}"
        fi
        
        # ===========================================
        # 4. APP/LOGS
        # ===========================================
        if confirm_action "¿Eliminar contenido de APP/logs?" "no"; then
            if [[ -d ./APP/logs ]]; then
                if [[ -n "$(ls -A ./APP/logs 2>/dev/null)" ]]; then
                    rm -rf ./APP/logs/* 2>/dev/null && \
                        echo -e "${GREEN}✅ Eliminados: APP/logs${NC}" || \
                        echo -e "${RED}❌ Error al eliminar APP/logs${NC}"
                else
                    echo -e "${YELLOW}⚠️  APP/logs ya está vacío${NC}"
                fi
            else
                echo -e "${YELLOW}⚠️  No existe el directorio APP/logs${NC}"
            fi
        else
            echo -e "${YELLOW}⏭️  Omitida eliminación de APP/logs${NC}"
        fi
    fi
    
    pause
    menu_limpieza
}

change_env() {
    banner_principal "CAMBIAR ENTORNO"
    
    echo -e "Entorno actual: $(get_env_color)"
    echo ""
    echo -e "Opciones disponibles:"
    echo -e "  ${CYAN}1)${NC} ${GREEN}dev${NC}"
    echo -e "  ${CYAN}2)${NC} ${YELLOW}qa${NC}"
    echo -e "  ${CYAN}3)${NC} ${RED}prd${NC}"
    echo ""
    
    read -p "$(echo -e ${CYAN}"Seleccione nuevo entorno: "${NC})" env_choice
    
    case "$env_choice" in
        1) ENV="dev" ;;
        2) ENV="qa" ;;
        3) ENV="prd" ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_configuracion
            return
            ;;
    esac
    
    define_compose_file
    echo -e "${GREEN}✅ Entorno cambiado a: $(get_env_color)${NC}"
    pause
    menu_configuracion
}

update_ip_menu() {
    banner_principal "ACTUALIZAR IP"
    
    local current_ip=$(get_current_ip)
    local env_file=".env"
    
    if [[ ! -f "$env_file" ]]; then
        echo -e "${RED}❌ Error: Archivo .env no encontrado${NC}"
        pause
        menu_configuracion
        return
    fi
    
    echo -e "IP actual detectada: ${CYAN}$current_ip${NC}"
    
    if [[ -z "$current_ip" ]]; then
        echo -e "${YELLOW}⚠️  No se pudo detectar IP automáticamente${NC}"
        read -p "Ingrese IP manualmente: " current_ip
    fi
    
    if confirm_action "¿Actualizar IP en .env a $current_ip?" "si"; then
        if grep -q "^REACT_NATIVE_PACKAGER_HOSTNAME=" "$env_file"; then
            sed_in_place "s/^REACT_NATIVE_PACKAGER_HOSTNAME=.*/REACT_NATIVE_PACKAGER_HOSTNAME=$current_ip/" "$env_file" --backup
        else
            echo "REACT_NATIVE_PACKAGER_HOSTNAME=$current_ip" >> "$env_file"
        fi
        echo -e "${GREEN}✅ IP actualizada exitosamente${NC}"
    fi
    
    pause
    menu_configuracion
}

check_ip_menu() {
    banner_principal "VERIFICAR IP"
    
    local current_ip=$(get_current_ip)
    local env_file=".env"
    
    echo -e "IP actual del equipo: ${CYAN}${current_ip:-No detectada}${NC}"
    
    if [[ -f "$env_file" ]]; then
        local env_ip=$(grep "^REACT_NATIVE_PACKAGER_HOSTNAME=" "$env_file" | cut -d'=' -f2)
        echo -e "IP en .env: ${CYAN}${env_ip:-No configurada}${NC}"
        
        if [[ -n "$current_ip" && -n "$env_ip" ]]; then
            if [[ "$current_ip" == "$env_ip" ]]; then
                echo -e "${GREEN}✅ Las IPs coinciden${NC}"
            else
                echo -e "${YELLOW}⚠️  Las IPs NO coinciden${NC}"
            fi
        fi
    fi
    
    pause
    menu_configuracion
}

validate_container_env() {
    banner_principal "VARIABLES DE ENTORNO"
    
    if ! select_container_from_stack "Seleccione contenedor" true false; then
        menu_configuracion
        return
    fi
    
    echo -e "\n${CYAN}${BOLD}📋 Variables de entorno en $SELECTED_CONTAINER_NAME:${NC}"
    echo "═══════════════════════════════════════════════════════════"
    docker exec "$SELECTED_CONTAINER_ID" env 2>/dev/null | sort | nl
    
    pause
    menu_configuracion
}

# ==================================================
# FUNCIONES DE MONITOREO MEJORADAS
# ==================================================

monitor_resources() {
    banner_principal "MONITOREO DE RECURSOS"
    
    if ! check_stack_containers; then
        pause
        menu_monitoreo
        return
    fi
    
    echo -e "${CYAN}${BOLD}📊 ESTADÍSTICAS DE CONTENEDORES${NC}"
    echo -e "${YELLOW}Presione Ctrl+C para salir${NC}"
    echo ""
    
    docker stats --filter "label=$LABEL_FILTER" --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}"
    
    pause
    menu_monitoreo
}

# ==================================================
# FUNCIONES DE VALIDACIÓN
# ==================================================

validate_compose() {
    banner_principal "VALIDAR DOCKER COMPOSE"
    
    if ! check_file_exists "$COMPOSE_FILE" "validación de sintaxis"; then
        pause
        menu_contenedores
        return
    fi
    
    echo -e "${BLUE}Validando configuración...${NC}"
    echo ""
    
    if $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file .env --env-file ".env.$ENV" config > /dev/null 2>&1; then
        echo -e "${GREEN}${BOLD}✅ VALIDACIÓN EXITOSA${NC}"
        echo ""
        echo -e "${CYAN}📋 SERVICIOS CONFIGURADOS:${NC}"
        $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file .env --env-file ".env.$ENV" config --services | sed 's/^/   • /'
    else
        echo -e "${RED}${BOLD}❌ ERROR DE VALIDACIÓN${NC}"
        echo ""
        $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file .env --env-file ".env.$ENV" config
    fi
    
    pause
    menu_contenedores
}

# ==================================================
# FUNCIONES DE BACKUP
# ==================================================

backup_volumes() {
    banner_principal "BACKUP DE VOLÚMENES"
    
    mkdir -p "$BACKUP_DIR"
    
    echo -e "${CYAN}${BOLD}📦 VOLÚMENES DISPONIBLES:${NC}"
    echo ""
    
    local volumes=()
    while IFS= read -r volume; do
        volumes+=("$volume")
    done < <(docker volume ls --format "{{.Name}}" 2>/dev/null)
    
    if [[ ${#volumes[@]} -eq 0 ]]; then
        echo -e "${YELLOW}⚠️  No hay volúmenes disponibles${NC}"
        pause
        menu_backup
        return
    fi
    
    for i in "${!volumes[@]}"; do
        printf "  ${CYAN}%2d)${NC} %s\n" $((i+1)) "${volumes[$i]}"
    done
    
    echo ""
    echo "  ${CYAN}T)${NC} Todos los volúmenes"
    echo "  ${CYAN}V)${NC} ⬅️ Volver al menú anterior"
    echo ""
    
    read -p "$(echo -e ${CYAN}"Seleccione volumen a respaldar: "${NC})" vol_choice
    
    # Opción para volver
    if [[ "$vol_choice" =~ ^[Vv]$ ]]; then
        echo -e "${BLUE}⏭️  Volviendo al menú anterior...${NC}"
        sleep 1
        menu_backup
        return
    fi
    
    local volumes_to_backup=()
    if [[ "$vol_choice" =~ ^[Tt]$ ]]; then
        volumes_to_backup=("${volumes[@]}")
    elif [[ "$vol_choice" =~ ^[0-9]+$ ]] && [[ "$vol_choice" -ge 1 ]] && [[ "$vol_choice" -le ${#volumes[@]} ]]; then
        volumes_to_backup=("${volumes[$((vol_choice-1))]}")
    else
        echo -e "${RED}❌ Opción inválida${NC}"
        echo -e "${YELLOW}   Las opciones válidas son: número del 1 al ${#volumes[@]}, T o V${NC}"
        pause
        backup_volumes  # Volver a mostrar el menú de backup
        return
    fi
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local success_count=0
    local error_count=0
    
    for volume in "${volumes_to_backup[@]}"; do
        local backup_file="$BACKUP_DIR/${volume}_$timestamp.tar.gz"
        echo -e "${BLUE}⏳ Respaldando volumen: $volume${NC}"
        
        if docker run --rm -v "$volume":/source -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf "/backup/$(basename "$backup_file")" -C /source . 2>/dev/null; then
            local size=$(du -h "$backup_file" | cut -f1)
            echo -e "${GREEN}✅ Backup creado: $backup_file ($size)${NC}"
            ((success_count++))
        else
            echo -e "${RED}❌ Error al respaldar $volume${NC}"
            ((error_count++))
        fi
    done
    
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Backup completado: $success_count exitosos, $error_count errores${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    
    pause
    menu_backup
}

restore_volume() {
    banner_principal "RESTAURAR VOLUMEN"
    
    if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]]; then
        echo -e "${YELLOW}⚠️  No hay backups disponibles${NC}"
        pause
        menu_backup
        return
    fi
    
    echo -e "${CYAN}${BOLD}📦 BACKUPS DISPONIBLES:${NC}"
    echo ""
    
    local backups=()
    while IFS= read -r backup; do
        backups+=("$backup")
    done < <(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | xargs -n1 basename)
    
    for i in "${!backups[@]}"; do
        local backup_file="${backups[$i]}"
        local size=$(du -h "$BACKUP_DIR/$backup_file" | cut -f1)
        printf "  ${CYAN}%2d)${NC} %-40s ${YELLOW}[%s]${NC}\n" $((i+1)) "$backup_file" "$size"
    done
    
    echo ""
    read -p "$(echo -e ${CYAN}"Seleccione backup a restaurar: "${NC})" backup_choice
    
    if ! [[ "$backup_choice" =~ ^[0-9]+$ ]] || [[ "$backup_choice" -lt 1 ]] || [[ "$backup_choice" -gt ${#backups[@]} ]]; then
        echo -e "${RED}❌ Opción inválida${NC}"
        pause
        return
    fi
    
    local selected_backup="${backups[$((backup_choice-1))]}"
    local volume_name=$(echo "$selected_backup" | cut -d'_' -f1)
    
    echo ""
    echo -e "${YELLOW}⚠️  Se restaurará el volumen: $volume_name${NC}"
    
    if ! confirm_action "¿Continuar con la restauración?" "no"; then
        menu_backup
        return
    fi
    
    # Verificar si el volumen existe
    if docker volume ls -q | grep -q "^$volume_name$"; then
        if confirm_action "¿Eliminar volumen existente antes de restaurar?" "no"; then
            docker volume rm "$volume_name" >/dev/null 2>&1
        else
            echo -e "${BLUE}⏭️  Restauración cancelada${NC}"
            pause
            return
        fi
    fi
    
    # Crear nuevo volumen y restaurar
    docker volume create "$volume_name" >/dev/null
    echo -e "${GREEN}✅ Volumen creado: $volume_name${NC}"
    
    if docker run --rm -v "$volume_name":/target -v "$(pwd)/$BACKUP_DIR":/backup alpine tar xzf "/backup/$selected_backup" -C /target 2>/dev/null; then
        echo -e "${GREEN}✅ Volumen restaurado exitosamente${NC}"
    else
        echo -e "${RED}❌ Error al restaurar el volumen${NC}"
    fi
    
    pause
    menu_backup
}

# ==================================================
# FUNCIONES DE LIMPIEZA MEJORADAS
# ==================================================

clean_images_enhanced() {
    banner_principal "LIMPIEZA DE IMÁGENES"
    
    echo -e "${CYAN}${BOLD}📊 ANÁLISIS DE IMÁGENES DOCKER${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Obtener estadísticas
    local total_images=$(docker images -q | wc -l)
    local dangling_images=$(docker images -f "dangling=true" -q | wc -l)
    
    echo -e "   ${BOLD}Total de imágenes:${NC} $total_images"
    echo -e "   ${YELLOW}Imágenes huérfanas:${NC} $dangling_images"
    echo ""
    
    # Mostrar imágenes huérfanas
    if [[ $dangling_images -gt 0 ]]; then
        echo -e "${YELLOW}${BOLD}🗑️  IMÁGENES HUÉRFANAS:${NC}"
        echo -e "${YELLOW}────────────────────────────────────────────────${NC}"
        docker images -f "dangling=true" --format "   • {{.ID}} ({{.Size}}) - Creada: {{.CreatedSince}}"
        echo ""
        
        if confirm_action "¿Eliminar imágenes huérfanas?" "si"; then
            run_cmd "docker image prune -f" "Error al limpiar" "Imágenes huérfanas eliminadas"
        fi
    fi
    
    # Preguntar por imágenes no utilizadas
    echo ""
    if confirm_action "¿Eliminar todas las imágenes no utilizadas?" "no"; then
        run_cmd "docker image prune -af" "Error al limpiar" "Imágenes no utilizadas eliminadas"
    fi
    
    pause
    menu_limpieza
}

# ==================================================
# FUNCIONES DE MENÚ FALTANTES (Templates, Expo, Docker Services, Portainer)
# ==================================================

menu_templates() {
    banner_principal "GESTIÓN DE TEMPLATES .ENV"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} 🔨 Generar .env.template"
    echo -e "  ${CYAN}2)${NC} 📋 Generar archivos .env desde template"
    echo -e "  ${CYAN}3)${NC} 🔍 Verificar archivos .env"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) 
            echo -e "${YELLOW}⚠️  Función en desarrollo${NC}"
            sleep 2
            menu_templates 
            ;;
        2) 
            echo -e "${YELLOW}⚠️  Función en desarrollo${NC}"
            sleep 2
            menu_templates 
            ;;
        3) 
            echo -e "${YELLOW}⚠️  Función en desarrollo${NC}"
            sleep 2
            menu_templates 
            ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_templates
            ;;
    esac
}

menu_expo() {
    banner_principal "HERRAMIENTAS EXPO"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} 🚀 Iniciar Expo Development Server"
    echo -e "  ${CYAN}2)${NC} 🏗️ EAS Build"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) 
            echo -e "${YELLOW}⚠️  Función en desarrollo${NC}"
            sleep 2
            menu_expo 
            ;;
        2) 
            echo -e "${YELLOW}⚠️  Función en desarrollo${NC}"
            sleep 2
            menu_expo 
            ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_expo
            ;;
    esac
}

menu_docker_services() {
    banner_principal "ESTADO Y SERVICIOS DOCKER"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} 🔍 Estado Docker Engine"
    echo -e "  ${CYAN}2)${NC} 🖥️ Estado Docker Desktop"
    echo -e "  ${CYAN}3)${NC} 🔄 Reiniciar Docker Engine"
    echo -e "  ${CYAN}4)${NC} 🔄 Reiniciar Docker Desktop"
    echo -e "  ${CYAN}5)${NC} ♻️ Reiniciar Ambos"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) 
            docker info
            pause
            menu_docker_services 
            ;;
        2) 
            echo -e "${YELLOW}⚠️  Verifique Docker Desktop manualmente${NC}"
            pause
            menu_docker_services 
            ;;
        3) 
            if confirm_action "¿Reiniciar Docker Engine?" "no"; then
                echo -e "${YELLOW}⚠️  Requiere permisos de administrador${NC}"
                sudo systemctl restart docker 2>/dev/null || echo -e "${RED}❌ No se pudo reiniciar${NC}"
            fi
            pause
            menu_docker_services 
            ;;
        4) 
            echo -e "${YELLOW}⚠️  Reinicie Docker Desktop manualmente${NC}"
            pause
            menu_docker_services 
            ;;
        5) 
            echo -e "${YELLOW}⚠️  Reinicie Docker Engine y Desktop manualmente${NC}"
            pause
            menu_docker_services 
            ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_docker_services
            ;;
    esac
}

menu_portainer() {
    banner_principal "PORTAINER"
    
    echo -e "${BOLD}OPCIONES DISPONIBLES:${NC}"
    echo ""
    echo -e "  ${CYAN}1)${NC} ▶️ Iniciar Portainer"
    echo -e "  ${CYAN}2)${NC} ⏹️ Detener Portainer"
    echo -e "  ${CYAN}3)${NC} 🔄 Reiniciar Portainer"
    echo -e "  ${CYAN}4)${NC} 🌐 Abrir en navegador"
    echo -e "  ${CYAN}5)${NC} 📋 Ver logs"
    echo -e "  ${CYAN}6)${NC} ♻️ Recrear Portainer"
    echo ""
    echo -e "  ${CYAN}V)${NC} ⬅️ Volver"
    echo -e "  ${CYAN}S)${NC} 🚪 Salir"
    echo ""
    
    read -p "$(echo -e ${CYAN}"👉 Seleccione una opción: "${NC})" choice
    
    case "$choice" in
        1) 
            # Versión simplificada de portainer_start
            if ! docker ps -a --format '{{.Names}}' | grep -qx "$PORTAINER_NAME"; then
                docker run -d \
                    --name $PORTAINER_NAME \
                    --restart unless-stopped \
                    -p 9000:9000 \
                    -v /var/run/docker.sock:/var/run/docker.sock \
                    -v portainer_data:/data \
                    $PORTAINER_IMAGE >/dev/null 2>&1 && \
                    echo -e "${GREEN}✅ Portainer iniciado en http://localhost:9000${NC}" || \
                    echo -e "${RED}❌ Error al iniciar Portainer${NC}"
            else
                docker start "$PORTAINER_NAME" >/dev/null 2>&1 && \
                    echo -e "${GREEN}✅ Portainer iniciado${NC}" || \
                    echo -e "${RED}❌ Error al iniciar${NC}"
            fi
            pause
            menu_portainer 
            ;;
        2) 
            docker stop "$PORTAINER_NAME" >/dev/null 2>&1 && \
                echo -e "${GREEN}✅ Portainer detenido${NC}" || \
                echo -e "${RED}❌ Error al detener${NC}"
            pause
            menu_portainer 
            ;;
        3) 
            docker restart "$PORTAINER_NAME" >/dev/null 2>&1 && \
                echo -e "${GREEN}✅ Portainer reiniciado${NC}" || \
                echo -e "${RED}❌ Error al reiniciar${NC}"
            pause
            menu_portainer 
            ;;
        4) 
            xdg-open "http://localhost:9000" 2>/dev/null || \
                echo -e "${YELLOW}⚠️  Abra http://localhost:9000 manualmente${NC}"
            pause
            menu_portainer 
            ;;
        5) 
            docker logs "$PORTAINER_NAME" --tail 50
            pause
            menu_portainer 
            ;;
        6) 
            if confirm_action "¿Recrear contenedor Portainer?" "no"; then
                docker stop "$PORTAINER_NAME" >/dev/null 2>&1
                docker rm "$PORTAINER_NAME" >/dev/null 2>&1
                docker volume create portainer_data >/dev/null
                docker run -d \
                    --name $PORTAINER_NAME \
                    --restart unless-stopped \
                    -p 9000:9000 \
                    -v /var/run/docker.sock:/var/run/docker.sock \
                    -v portainer_data:/data \
                    $PORTAINER_IMAGE >/dev/null 2>&1 && \
                    echo -e "${GREEN}✅ Portainer recreado${NC}" || \
                    echo -e "${RED}❌ Error al recrear${NC}"
            fi
            pause
            menu_portainer 
            ;;
        [Vv]) menu ;;
        [Ss]) exit_script ;;
        *)
            echo -e "${RED}❌ Opción inválida${NC}"
            sleep 2
            menu_portainer
            ;;
    esac
}

# ==================================================
# FUNCIÓN DE SALIDA
# ==================================================

exit_script() {
    clear
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}   ¡Gracias por usar Docker Tools!${NC}"
    echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}Todos los procesos han sido cerrados correctamente.${NC}"
    echo ""
    exit 0
}

# ==================================================
# FUNCIÓN PRINCIPAL
# ==================================================

main() {
    # Limpiar pantalla al inicio
    clear
    
    # Configurar colores
    setup_colors
    
    # Verificar dependencias al inicio (Punto 1)
    check_dependencies
    
    # Variables iniciales
    ENV="dev"
    PROJECT_NAME=$(read_project_name)
    STACK="${PROJECT_NAME:-NoExiteStackName}"
    LABEL_FILTER="stack=${STACK}"
    COMPOSE_FILE=""
    CURRENT_IP=""
    BACKUP_DIR="docker-backups"
    
    # Definir archivo compose inicial
    define_compose_file
    
    # Ir al menú principal
    menu
}

# Ejecutar función principal
main "$@"