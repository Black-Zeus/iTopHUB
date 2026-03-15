const mockData = {
  kpis: [
    { label: "Activos integrados", value: "1,248", helper: "CMDB sincronizada", tone: "info" },
    { label: "Actas de entrega", value: "84", helper: "Mes actual", tone: "success" },
    { label: "Recepciones abiertas", value: "19", helper: "Con revisión pendiente", tone: "warning" },
    { label: "Usuarios con equipo", value: "612", helper: "Asignación activa", tone: "info" }
  ],
  documentSummary: [
    { label: "Entregas emitidas", value: 84 },
    { label: "Recepciones emitidas", value: 37 },
    { label: "Borradores pendientes", value: 11 },
    { label: "Documentos observados", value: 3 }
  ],
  alerts: [
    { title: "7 equipos pendientes de diagnóstico", text: "Ingresados a laboratorio hace más de 48 horas sin clasificación final." },
    { title: "3 actas de entrega sin confirmación", text: "Falta validación del receptor y envío documental asociado." },
    { title: "2 notebooks con devolución programada", text: "Vencimiento de préstamo temporal previsto para la próxima semana." }
  ],
  recentActivity: [
    { time: "13 Mar 2026 · 09:12", title: "Recepción de notebook NB-24017", text: "Lucía Vera registró ingreso por falla intermitente de batería." },
    { time: "13 Mar 2026 · 08:40", title: "Entrega de docking DK-19008", text: "Asignado a Paula Ferreyra mediante acta ENT-2026-0317." },
    { time: "12 Mar 2026 · 17:25", title: "Actualización de estado en CMDB", text: "Servidor SV-0009 pasó a mantenimiento preventivo." },
    { time: "12 Mar 2026 · 15:03", title: "Reasignación de monitor MN-11044", text: "Movimiento aprobado entre Administración y Finanzas." }
  ],
  assets: [
    {
      id: "asset-1",
      code: "NB-24017",
      name: "Notebook Ejecutiva",
      classKey: "laptop",
      cmdbClass: "Laptop (Laptop)",
      type: "Notebook",
      model: "Latitude 5440",
      brand: "Dell",
      serial: "DL5440-22A91",
      currentUser: "Paula Ferreyra",
      status: "Asignado",
      location: "Oficina Central",
      cmdbStatus: "En uso",
      onboardingDate: "2025-08-14",
      observations: "Equipo con docking asignado y cifrado activo.",
      inventoryCode: "INV-001482",
      state: "Operativo"
    },
    {
      id: "asset-2",
      code: "NB-24021",
      name: "Notebook Analista",
      classKey: "laptop",
      cmdbClass: "Laptop (Laptop)",
      type: "Notebook",
      model: "EliteBook 840 G10",
      brand: "HP",
      serial: "HP840G10-0912",
      currentUser: "Joaquín Herrera",
      status: "Laboratorio",
      location: "Mesa de ayuda",
      cmdbStatus: "En revisión",
      onboardingDate: "2025-11-03",
      observations: "Ingreso por recalentamiento y ruido en ventilación.",
      inventoryCode: "INV-001497",
      state: "No operativo"
    },
    {
      id: "asset-3",
      code: "MN-11044",
      name: "Monitor Corporativo",
      classKey: "peripheral",
      cmdbClass: "Periférico (Peripheral)",
      type: "Monitor",
      model: "P2423D",
      brand: "Dell",
      serial: "MN-P2423D-8844",
      currentUser: "Carla Rosales",
      status: "Asignado",
      location: "Finanzas",
      cmdbStatus: "En uso",
      onboardingDate: "2024-06-19",
      observations: "Sin observaciones.",
      inventoryCode: "INV-000932",
      state: "Operativo"
    },
    {
      id: "asset-4",
      code: "DK-19008",
      name: "Docking USB-C",
      classKey: "peripheral",
      cmdbClass: "Periférico (Peripheral)",
      type: "Periférico",
      model: "WD19S",
      brand: "Dell",
      serial: "WD19S-AB221",
      currentUser: "Paula Ferreyra",
      status: "Asignado",
      location: "Oficina Central",
      cmdbStatus: "En uso",
      onboardingDate: "2025-02-11",
      observations: "Asignado con notebook NB-24017.",
      inventoryCode: "INV-001031",
      state: "Operativo"
    },
    {
      id: "asset-5",
      code: "SV-0009",
      name: "Servidor Aplicativo",
      classKey: "pc",
      cmdbClass: "Desktop (PC)",
      type: "Servidor",
      model: "PowerEdge R650",
      brand: "Dell",
      serial: "SVR650-01MX2",
      currentUser: "Infraestructura",
      status: "Pendiente",
      location: "Datacenter San Juan",
      cmdbStatus: "Mantenimiento",
      onboardingDate: "2023-09-01",
      observations: "Mantenimiento preventivo programado.",
      inventoryCode: "INV-000210",
      state: "Operativo"
    }
  ],
  assetHistory: {
    "asset-1": [
      { date: "2026-03-10", movement: "Entrega", from: "Stock TI", to: "Paula Ferreyra", previous: "Disponible", next: "Asignado", document: "ENT-2026-0317", operator: "Marina Sosa" },
      { date: "2025-12-02", movement: "Preparación", from: "Almacén", to: "Stock TI", previous: "Nuevo", next: "Disponible", document: "PREP-2025-118", operator: "Sergio Nievas" }
    ],
    "asset-2": [
      { date: "2026-03-13", movement: "Recepción", from: "Joaquín Herrera", to: "Laboratorio", previous: "Asignado", next: "Laboratorio", document: "REC-2026-0142", operator: "Lucía Vera" },
      { date: "2025-11-05", movement: "Entrega", from: "Stock TI", to: "Joaquín Herrera", previous: "Disponible", next: "Asignado", document: "ENT-2025-0921", operator: "Marina Sosa" }
    ],
    "asset-3": [
      { date: "2026-02-01", movement: "Reasignación", from: "Administración", to: "Carla Rosales", previous: "Asignado", next: "Asignado", document: "ENT-2026-0088", operator: "Damián Ochoa" }
    ],
    "asset-4": [
      { date: "2026-03-10", movement: "Entrega", from: "Stock TI", to: "Paula Ferreyra", previous: "Disponible", next: "Asignado", document: "ENT-2026-0317", operator: "Marina Sosa" }
    ],
    "asset-5": [
      { date: "2026-03-12", movement: "Cambio de estado", from: "Producción", to: "Producción", previous: "Operativo", next: "Pendiente", document: "MNT-2026-0044", operator: "Equipo Infraestructura" }
    ]
  },
  users: [
    {
      id: "user-1",
      name: "Paula Ferreyra",
      identifier: "PF-2048",
      email: "paula.ferreyra@itophub.local",
      area: "Dirección Comercial",
      role: "Gerente de cuentas",
      manager: "Mauro Rivas",
      location: "Oficina Central",
      status: "Activo",
      hireDate: "2022-04-11",
      currentAssets: [
        { code: "NB-24017", name: "Notebook Ejecutiva", type: "Notebook", model: "Latitude 5440", assignedDate: "2026-03-10", status: "Operativo" },
        { code: "DK-19008", name: "Docking USB-C", type: "Periférico", model: "WD19S", assignedDate: "2026-03-10", status: "Operativo" }
      ],
      history: [
        { asset: "Notebook Ejecutiva", type: "Notebook", assignedDate: "2026-03-10", removedDate: "-", reason: "Asignación inicial", movementStatus: "Vigente", reference: "ENT-2026-0317" },
        { asset: "Monitor Corporativo", type: "Monitor", assignedDate: "2024-01-18", removedDate: "2025-12-22", reason: "Renovación", movementStatus: "Cerrado", reference: "ENT-2024-0102" }
      ]
    },
    {
      id: "user-2",
      name: "Joaquín Herrera",
      identifier: "JH-1820",
      email: "joaquin.herrera@itophub.local",
      area: "Operaciones",
      role: "Analista senior",
      manager: "Silvina Luque",
      location: "Oficina Norte",
      status: "Activo",
      hireDate: "2023-09-04",
      currentAssets: [],
      history: [
        { asset: "Notebook Analista", type: "Notebook", assignedDate: "2025-11-05", removedDate: "2026-03-13", reason: "Ingreso a laboratorio", movementStatus: "Recepcionado", reference: "REC-2026-0142" }
      ]
    },
    {
      id: "user-3",
      name: "Carla Rosales",
      identifier: "CR-2191",
      email: "carla.rosales@itophub.local",
      area: "Finanzas",
      role: "Analista contable",
      manager: "Luis Cuello",
      location: "Finanzas",
      status: "Activo",
      hireDate: "2021-07-21",
      currentAssets: [
        { code: "MN-11044", name: "Monitor Corporativo", type: "Monitor", model: "P2423D", assignedDate: "2026-02-01", status: "Operativo" }
      ],
      history: [
        { asset: "Monitor Corporativo", type: "Monitor", assignedDate: "2026-02-01", removedDate: "-", reason: "Reasignación interna", movementStatus: "Vigente", reference: "ENT-2026-0088" }
      ]
    }
  ],
  systemUsers: [
    {
      id: "sys-1",
      username: "victor.soto",
      apiCode: "usr_************************8f3a",
      name: "Victor Soto",
      email: "victor.soto@itophub.local",
      role: "Administrador",
      status: "Activo"
    },
    {
      id: "sys-2",
      username: "marina.sosa",
      apiCode: "usr_************************2a91",
      name: "Marina Sosa",
      email: "marina.sosa@itophub.local",
      role: "Soporte General",
      status: "Activo"
    },
    {
      id: "sys-3",
      username: "natalia.quiroga",
      apiCode: "usr_************************7c42",
      name: "Natalia Quiroga",
      email: "natalia.quiroga@itophub.local",
      role: "Soporte Laboratorio",
      status: "Activo"
    },
    {
      id: "sys-4",
      username: "lucia.vera",
      apiCode: "usr_************************5d18",
      name: "Lucía Vera",
      email: "lucia.vera@itophub.local",
      role: "Soporte Terreno",
      status: "Activo"
    },
    {
      id: "sys-5",
      username: "damian.ochoa",
      apiCode: "usr_************************9f62",
      name: "Damián Ochoa",
      email: "damian.ochoa@itophub.local",
      role: "Visualizador",
      status: "Activo"
    }
  ],
  handovers: [
    {
      id: "handover-1",
      document: "ENT-2026-0317",
      date: "2026-03-10",
      type: "Asignación inicial",
      assetCode: "NB-24017",
      assetName: "Notebook Ejecutiva",
      user: "Paula Ferreyra",
      userIdentifier: "PF-2048",
      owner: "Marina Sosa",
      status: "Emitida",
      notes: "Entrega inicial con docking y cargador corporativo."
    },
    {
      id: "handover-2",
      document: "ENT-2026-0316",
      date: "2026-03-10",
      type: "Asignación inicial",
      assetCode: "DK-19008",
      assetName: "Docking USB-C",
      user: "Paula Ferreyra",
      userIdentifier: "PF-2048",
      owner: "Marina Sosa",
      status: "Emitida",
      notes: "Docking asignado junto a notebook ejecutiva."
    },
    {
      id: "handover-3",
      document: "ENT-2026-0088",
      date: "2026-02-01",
      type: "Reasignación",
      assetCode: "MN-11044",
      assetName: "Monitor Corporativo",
      user: "Carla Rosales",
      userIdentifier: "CR-2191",
      owner: "Damián Ochoa",
      status: "Confirmada",
      notes: "Reasignación interna desde Administración a Finanzas."
    }
  ],
  receptions: [
    {
      id: "reception-1",
      document: "REC-2026-0142",
      assetCode: "NB-24021",
      assetName: "Notebook Analista",
      origin: "Usuario final",
      deliverer: "Joaquín Herrera",
      receiver: "Lucía Vera",
      reason: "Falla reportada",
      receivedState: "En análisis",
      date: "2026-03-13",
      owner: "Natalia Quiroga",
      resultNotes: "Pendiente de prueba térmica y validación de batería.",
      accessories: "Cargador original y funda corporativa.",
      technicalNotes: "Equipo con apagado aleatorio luego de 20 minutos de uso.",
      diagnosis: "Posible degradación de batería y ventilación obstruida.",
      flags: { review: true, format: false, repair: false, operational: true, down: false },
      report: {
        general: "Regular",
        case: "Con marcas",
        screen: "Operativa",
        keyboard: "Completo",
        pointer: "Operativo",
        battery: "Autonomía reducida",
        charger: "Entregado y operativo",
        ports: "Sin novedad"
      }
    },
    {
      id: "reception-2",
      document: "REC-2026-0138",
      assetCode: "PR-70031",
      assetName: "Impresora Multifunción",
      origin: "Sucursal Oeste",
      deliverer: "Carlos Nieto",
      receiver: "Lucía Vera",
      reason: "Mantenimiento",
      receivedState: "Pendiente de diagnóstico",
      date: "2026-03-12",
      owner: "Lucía Vera",
      resultNotes: "Pendiente de revisión mecánica de bandeja.",
      accessories: "Cable de energía.",
      technicalNotes: "Atasco recurrente en bandeja 2.",
      diagnosis: "Posible desgaste en rodillos de arrastre.",
      flags: { review: true, format: false, repair: true, operational: false, down: true },
      report: {
        general: "Regular",
        case: "Con marcas",
        screen: "Operativa",
        keyboard: "Completo",
        pointer: "Operativo",
        battery: "Buena autonomía",
        charger: "No entregado",
        ports: "Con desgaste"
      }
    },
    {
      id: "reception-3",
      document: "REC-2026-0131",
      assetCode: "PC-19077",
      assetName: "Desktop Operativo",
      origin: "Mesa de ayuda",
      deliverer: "Marina Sosa",
      receiver: "Natalia Quiroga",
      reason: "Baja técnica",
      receivedState: "Ingresado a laboratorio",
      date: "2026-03-11",
      owner: "Natalia Quiroga",
      resultNotes: "Equipo en laboratorio para evaluación de disco y reinstalación.",
      accessories: "Cable poder y teclado.",
      technicalNotes: "Lentitud general con errores SMART.",
      diagnosis: "Unidad SSD con fallas de lectura.",
      flags: { review: true, format: true, repair: true, operational: false, down: true },
      report: {
        general: "Crítico",
        case: "Sin daños",
        screen: "Operativa",
        keyboard: "Desgaste leve",
        pointer: "Operativo",
        battery: "Buena autonomía",
        charger: "No entregado",
        ports: "Sin novedad"
      }
    }
  ],
  labQueue: [
    {
      id: "lab-1",
      receptionDocument: "REC-2026-0142",
      assetCode: "NB-24021",
      assetName: "Notebook Analista",
      type: "Notebook",
      reason: "Falla reportada",
      priority: "Alta",
      status: "En diagnóstico",
      technician: "Natalia Quiroga",
      reportNumber: "LAB-2026-0048",
      entryAt: "2026-03-13",
      closedAt: "2026-03-14T11:30",
      description: "Se detecta suciedad interna, batería degradada y ventilación con ruido. Requiere limpieza, prueba térmica y evaluación de batería.",
      result: "Diagnóstico emitido",
      evidence: [
        { title: "Vista frontal del equipo", note: "Se observan marcas leves en tapa y adhesivo patrimonial íntegro." },
        { title: "Batería y carcasa inferior", note: "Desgaste visible en tornillos y deformación menor en base." }
      ]
    },
    {
      id: "lab-2",
      receptionDocument: "REC-2026-0138",
      assetCode: "PR-70031",
      assetName: "Impresora Multifunción",
      type: "Impresora",
      reason: "Mantenimiento",
      priority: "Media",
      status: "Pendiente de revisión",
      technician: "Lucía Vera",
      reportNumber: "LAB-2026-0049",
      entryAt: "2026-03-12",
      closedAt: "",
      description: "Pendiente de apertura técnica y validación de rodillos de arrastre.",
      result: "Reparación requerida",
      evidence: [
        { title: "Bandeja de papel", note: "Se observa desgaste en guías laterales." }
      ]
    },
    {
      id: "lab-3",
      receptionDocument: "REC-2026-0131",
      assetCode: "PC-19077",
      assetName: "Desktop Operativo",
      type: "PC",
      reason: "Baja técnica",
      priority: "Alta",
      status: "Listo para devolución",
      technician: "Marina Sosa",
      reportNumber: "LAB-2026-0045",
      entryAt: "2026-03-11",
      closedAt: "2026-03-13T17:10",
      description: "Se reemplazó unidad SSD, se reinstaló imagen corporativa y se validó operación.",
      result: "Listo para devolución",
      evidence: [
        { title: "SMART previo a reemplazo", note: "Sector de salud crítico y alertas de lectura." },
        { title: "Equipo operativo post intervención", note: "Sistema inicia correctamente y queda listo para entrega." }
      ]
    }
  ],
  checklistDefinitionsByModule: {
    lab: [
      {
        id: "lab-checklist-1",
        name: "Checklist notebook estándar",
        classKey: "laptop",
        cmdbClass: "Laptop (Laptop)",
        description: "Plantilla base para recepción, diagnóstico y cierre técnico de equipos portátiles corporativos.",
        status: "Activo",
        checks: [
          { id: "laptop-check-1", name: "Carcasa", description: "Valida golpes, fisuras o piezas faltantes en la estructura externa.", type: "Check" },
          { id: "laptop-check-2", name: "Pantalla", description: "Revisa quiebres, manchas, pixeles muertos y funcionamiento general.", type: "Check" },
          { id: "laptop-check-3", name: "Diagnóstico inicial", description: "Permite registrar un diagnóstico técnico breve del equipo.", type: "Text area" },
          { id: "laptop-check-4", name: "Serie validada", description: "Solicita confirmar la serie física observada en el equipo.", type: "Input text" },
          { id: "laptop-check-5", name: "Estado operativo", description: "Permite indicar si el equipo quedó operativo luego de la revisión.", type: "Option / Radio", optionA: "Operativo", optionB: "No operativo" }
        ]
      },
      {
        id: "lab-checklist-2",
        name: "Checklist desktop corporativo",
        classKey: "pc",
        cmdbClass: "Desktop (PC)",
        description: "Lista enfocada en validación física, encendido, puertos, almacenamiento y periféricos de puesto fijo.",
        status: "Activo",
        checks: [
          { id: "pc-check-1", name: "Encendido", description: "Confirma arranque básico y operación general del equipo.", type: "Check" },
          { id: "pc-check-2", name: "Teclado y mouse", description: "Valida presencia y funcionamiento de periféricos de puesto.", type: "Check" },
          { id: "pc-check-3", name: "Observación técnica", description: "Permite registrar una observación breve del puesto.", type: "Text area" }
        ]
      },
      {
        id: "lab-checklist-3",
        name: "Checklist tableta corporativa",
        classKey: "tablet",
        cmdbClass: "Tableta (Tablet)",
        description: "Checklist orientado a revisión rápida de pantalla, táctil, carga y estado general del dispositivo.",
        status: "Inactivo",
        checks: [
          { id: "tablet-check-1", name: "Pantalla táctil", description: "Verifica respuesta táctil y estado superficial del panel.", type: "Check" },
          { id: "tablet-check-2", name: "Carga", description: "Confirma carga y presencia de adaptador compatible.", type: "Check" }
        ]
      },
      {
        id: "lab-checklist-4",
        name: "Checklist celular corporativo",
        classKey: "mobilephone",
        cmdbClass: "Celular (MobilePhone)",
        description: "Plantilla para validación funcional y física de equipos móviles, batería y accesorios entregados.",
        status: "Inactivo",
        checks: [
          { id: "mobile-check-1", name: "Pantalla", description: "Revisa vidrio, panel y respuesta táctil.", type: "Check" },
          { id: "mobile-check-2", name: "IMEI verificado", description: "Solicita registrar el IMEI o confirmación visible del equipo.", type: "Input text" }
        ]
      },
      {
        id: "lab-checklist-5",
        name: "Checklist impresora multifunción",
        classKey: "printer",
        cmdbClass: "Impresora (Printer)",
        description: "Controles específicos para bandejas, arrastre, conectividad, impresión y consumibles visibles.",
        status: "Inactivo",
        checks: [
          { id: "printer-check-1", name: "Bandejas", description: "Valida integridad, guías y presencia de bandejas de papel.", type: "Check" },
          { id: "printer-check-2", name: "Arrastre", description: "Revisa atascos y comportamiento de rodillos visibles.", type: "Check" }
        ]
      },
      {
        id: "lab-checklist-6",
        name: "Checklist periférico general",
        classKey: "peripheral",
        cmdbClass: "Periférico (Peripheral)",
        description: "Lista adaptable para accesorios y periféricos sin plantilla específica.",
        status: "Inactivo",
        checks: [
          { id: "peripheral-check-1", name: "Estado físico", description: "Valida golpes, fisuras o deterioro visible.", type: "Check" },
          { id: "peripheral-check-2", name: "Conector", description: "Revisa integridad del cable o conector de uso.", type: "Check" }
        ]
      }
    ],
    handover: [
      {
        id: "handover-checklist-1",
        name: "Entrega base del activo",
        description: "Plantilla principal para documentar la entrega del activo base, validar identificación y registrar conformidad inicial.",
        status: "Activo",
        checks: [
          { id: "handover-base-1", name: "Activo principal entregado", description: "Confirma que el equipo o insumo principal fue entregado físicamente al usuario.", type: "Check" },
          { id: "handover-base-2", name: "Código o serie validada", description: "Permite registrar la identificación física validada durante la entrega.", type: "Input text" },
          { id: "handover-base-3", name: "Observación de entrega", description: "Permite consignar aclaraciones relevantes sobre el estado o condición de entrega.", type: "Text area" }
        ]
      },
      {
        id: "handover-checklist-2",
        name: "Accesorios de energía y conectividad",
        description: "Sirve para registrar cargadores, docking, adaptadores, cables y otros accesorios de conectividad incluidos en la entrega.",
        status: "Activo",
        checks: [
          { id: "handover-power-1", name: "Cargador incluido", description: "Permite indicar si el acta considera entrega de cargador.", type: "Option / Radio", optionA: "Con cargador", optionB: "Sin cargador" },
          { id: "handover-power-2", name: "Docking incluido", description: "Permite indicar si el acta considera entrega de docking o estación de acople.", type: "Option / Radio", optionA: "Con docking", optionB: "Sin docking" },
          { id: "handover-power-3", name: "Detalle de conectividad", description: "Permite documentar adaptadores, cables de red, HDMI, USB-C u otros accesorios.", type: "Text area" }
        ]
      },
      {
        id: "handover-checklist-3",
        name: "Periféricos y almacenamiento",
        description: "Permite anexar a la entrega mouse, teclado, monitor, pendrive, disco externo u otros insumos complementarios.",
        status: "Activo",
        checks: [
          { id: "handover-peripherals-1", name: "Periféricos entregados", description: "Permite indicar si la entrega incluye periféricos asociados.", type: "Option / Radio", optionA: "Sí incluye", optionB: "No incluye" },
          { id: "handover-peripherals-2", name: "Detalle de insumos entregados", description: "Permite listar monitor, mouse, teclado, pendrive, disco externo u otros elementos.", type: "Text area" }
        ]
      },
      {
        id: "handover-checklist-4",
        name: "Conformidad y observaciones finales",
        description: "Plantilla final para dejar trazabilidad de conformidad del usuario, faltantes autorizados y observaciones de cierre.",
        status: "Inactivo",
        checks: [
          { id: "handover-closing-1", name: "Conformidad del usuario", description: "Permite registrar si el usuario recibe conforme o con observaciones.", type: "Option / Radio", optionA: "Conforme", optionB: "Con observación" },
          { id: "handover-closing-2", name: "Observaciones finales", description: "Permite dejar nota de faltantes autorizados, restricciones o acuerdos de entrega.", type: "Text area" }
        ]
      }
    ],
    reception: [
      {
        id: "reception-checklist-1",
        name: "Recepción base del activo",
        description: "Plantilla principal para dejar evidencia de recepción del activo base y validar identificación del equipo o insumo devuelto.",
        status: "Activo",
        checks: [
          { id: "reception-base-1", name: "Activo principal recibido", description: "Confirma que el activo o insumo principal fue recibido físicamente.", type: "Check" },
          { id: "reception-base-2", name: "Código o serie validada", description: "Permite registrar la identificación física validada al recibir el activo.", type: "Input text" },
          { id: "reception-base-3", name: "Observación de recepción", description: "Permite dejar nota general sobre la condición de recepción.", type: "Text area" }
        ]
      },
      {
        id: "reception-checklist-2",
        name: "Accesorios de energía y conectividad",
        description: "Sirve para registrar si el usuario devuelve cargador, docking, adaptadores, cables u otros elementos de conectividad.",
        status: "Activo",
        checks: [
          { id: "reception-power-1", name: "Cargador recibido", description: "Permite indicar si el usuario devuelve el cargador corporativo.", type: "Option / Radio", optionA: "Con cargador", optionB: "Sin cargador" },
          { id: "reception-power-2", name: "Docking recibido", description: "Permite indicar si la devolución incluye docking o estación de acople.", type: "Option / Radio", optionA: "Con docking", optionB: "Sin docking" },
          { id: "reception-power-3", name: "Detalle de conectividad recibida", description: "Permite documentar cables, adaptadores u otros accesorios de conectividad recibidos.", type: "Text area" }
        ]
      },
      {
        id: "reception-checklist-3",
        name: "Periféricos y almacenamiento devueltos",
        description: "Plantilla para registrar mouse, teclado, monitor, pendrive, disco externo y otros insumos complementarios devueltos.",
        status: "Activo",
        checks: [
          { id: "reception-peripherals-1", name: "Periféricos devueltos", description: "Permite indicar si la devolución incluye periféricos asociados.", type: "Option / Radio", optionA: "Sí incluye", optionB: "No incluye" },
          { id: "reception-peripherals-2", name: "Detalle de insumos recibidos", description: "Permite listar monitor, mouse, teclado, pendrive, disco externo u otros elementos devueltos.", type: "Text area" }
        ]
      },
      {
        id: "reception-checklist-4",
        name: "Faltantes y diferencias",
        description: "Plantilla para registrar accesorios no devueltos, diferencias contra la entrega original y observaciones de faltantes.",
        status: "Inactivo",
        checks: [
          { id: "reception-missing-1", name: "Existen faltantes", description: "Permite indicar si se detectan faltantes al momento de la devolución.", type: "Option / Radio", optionA: "Sí existen", optionB: "No existen" },
          { id: "reception-missing-2", name: "Detalle de faltantes o diferencias", description: "Permite registrar cargador, docking, almacenamiento externo u otros elementos no devueltos.", type: "Text area" }
        ]
      }
    ]
  },
  reports: [
    {
      id: "report-1",
      name: "Personas con equipo asignado",
      category: "Asignación",
      frequency: "Semanal",
      description: "Consolida el parque asignado por colaborador con foco en custodia vigente, fecha de entrega y responsable operativo para seguimiento de uso y control documental.",
      sampleResult: "183 registros encontrados. Mayor concentración en Dirección Comercial y Operaciones.",
      parameters: [
        { type: "select", label: "Estado de asignación", key: "assignment", options: ["Vigentes", "Todos"] },
        { type: "date", label: "Fecha corte", key: "cutoff" },
        { type: "select", label: "Orden", key: "sort", options: ["Persona", "Fecha asignación", "Activo"] }
      ],
      columns: ["Persona", "Área", "Activo", "Tipo", "Modelo", "Fecha asignación", "Responsable"],
      rows: [
        ["Paula Ferreyra", "Dirección Comercial", "NB-24017", "Notebook", "Latitude 5440", "2026-03-10", "Marina Sosa"],
        ["Paula Ferreyra", "Dirección Comercial", "DK-19008", "Periférico", "WD19S", "2026-03-10", "Marina Sosa"],
        ["Carla Rosales", "Finanzas", "MN-11044", "Monitor", "P2423D", "2026-02-01", "Damián Ochoa"]
      ]
    },
    {
      id: "report-2",
      name: "Historial de movimientos por activo",
      category: "Movimientos",
      frequency: "Bajo demanda",
      description: "Reconstruye la trazabilidad completa de un activo, incluyendo cambios de estado, transferencias, ingresos a laboratorio y referencias documentales asociadas.",
      sampleResult: "Se identificaron 24 activos con más de 5 movimientos en los últimos 90 días.",
      parameters: [
        { type: "search", label: "Código de activo", key: "asset_code", placeholder: "NB-24017" },
        { type: "date", label: "Desde", key: "from_date" },
        { type: "date", label: "Hasta", key: "to_date" },
        { type: "select", label: "Tipo de movimiento", key: "movement", options: ["Todos", "Entrega", "Recepción", "Reasignación", "Cambio de estado"] }
      ],
      columns: ["Fecha", "Activo", "Movimiento", "Origen", "Destino", "Estado previo", "Estado nuevo", "Acta"],
      rows: [
        ["2026-03-10", "NB-24017", "Entrega", "Stock TI", "Paula Ferreyra", "Disponible", "Asignado", "ENT-2026-0317"],
        ["2026-03-13", "NB-24021", "Recepción", "Joaquín Herrera", "Laboratorio", "Asignado", "Laboratorio", "REC-2026-0142"],
        ["2026-02-01", "MN-11044", "Reasignación", "Administración", "Carla Rosales", "Asignado", "Asignado", "ENT-2026-0088"]
      ]
    },
    {
      id: "report-3",
      name: "Equipos en laboratorio",
      category: "Laboratorio",
      frequency: "Diario",
      description: "Resume la carga vigente del laboratorio con prioridad, técnico asignado, motivo de ingreso y estado técnico para priorización diaria del trabajo.",
      sampleResult: "8 equipos en diagnóstico, 3 listos para devolución y 2 pendientes de repuesto.",
      parameters: [
        { type: "select", label: "Prioridad", key: "priority", options: ["Todas", "Alta", "Media", "Baja"] },
        { type: "select", label: "Estado", key: "status", options: ["Todos", "En diagnóstico", "Pendiente de revisión", "Listo para devolución"] },
        { type: "select", label: "Técnico", key: "technician", options: ["Todos", "Natalia Quiroga", "Lucía Vera", "Marina Sosa"] },
        { type: "date", label: "Fecha de ingreso", key: "entry_date" }
      ],
      columns: ["Acta recepción", "Activo", "Motivo", "Prioridad", "Estado", "Técnico", "Acta técnica"],
      rows: [
        ["REC-2026-0142", "NB-24021", "Recalentamiento", "Alta", "En diagnóstico", "Natalia Quiroga", "LAB-2026-0048"],
        ["REC-2026-0138", "PR-70031", "Atasco recurrente", "Media", "Pendiente de revisión", "Lucía Vera", "LAB-2026-0049"],
        ["REC-2026-0131", "PC-19077", "Error de disco", "Alta", "Listo para devolución", "Marina Sosa", "LAB-2026-0045"]
      ]
    },
    {
      id: "report-4",
      name: "Actas emitidas por período",
      category: "Documental",
      frequency: "Mensual",
      description: "Centraliza la emisión documental del período para medir volumen de entregas, recepciones y registros técnicos por responsable y tipo de documento.",
      sampleResult: "121 actas emitidas en el mes. Incremento del 14% respecto al mes anterior.",
      parameters: [
        { type: "date", label: "Desde", key: "from_date" },
        { type: "date", label: "Hasta", key: "to_date" },
        { type: "select", label: "Tipo documental", key: "document_type", options: ["Todos", "Entrega", "Recepción", "Laboratorio"] },
        { type: "select", label: "Responsable", key: "owner", options: ["Todos", "Marina Sosa", "Lucía Vera", "Natalia Quiroga"] }
      ],
      columns: ["Tipo", "Número", "Fecha", "Responsable", "Activo", "Usuario relacionado", "Estado"],
      rows: [
        ["Entrega", "ENT-2026-0317", "2026-03-10", "Marina Sosa", "NB-24017", "Paula Ferreyra", "Emitida"],
        ["Recepción", "REC-2026-0142", "2026-03-13", "Lucía Vera", "NB-24021", "Joaquín Herrera", "En análisis"],
        ["Laboratorio", "LAB-2026-0048", "2026-03-13", "Natalia Quiroga", "NB-24021", "Joaquín Herrera", "Diagnóstico emitido"]
      ]
    },
    {
      id: "report-5",
      name: "Personas sin equipo asignado",
      category: "Asignación",
      frequency: "Semanal",
      description: "Detecta personas activas sin equipamiento vigente para identificar ingresos recientes, devoluciones no repuestas o inconsistencias entre operación y CMDB.",
      sampleResult: "27 personas activas sin equipo asignado. 11 corresponden a ingresos recientes.",
      parameters: [
        { type: "select", label: "Estado persona", key: "person_status", options: ["Activo", "Todos"] },
        { type: "date", label: "Ingreso desde", key: "entry_from" },
        { type: "select", label: "Ordenar por", key: "sort", options: ["Nombre", "Fecha de ingreso", "Estado"] }
      ],
      columns: ["Persona", "Área", "Cargo", "Correo", "Fecha ingreso", "Estado"],
      rows: [
        ["Joaquín Herrera", "Operaciones", "Analista senior", "joaquin.herrera@itophub.local", "2023-09-04", "Activo"],
        ["Laura Ponce", "Finanzas", "Analista", "laura.ponce@itophub.local", "2026-02-18", "Activo"],
        ["Tomás Agüero", "Dirección Comercial", "Ejecutivo", "tomas.aguero@itophub.local", "2026-03-01", "Activo"]
      ]
    },
    {
      id: "report-6",
      name: "Activos por estado CMDB",
      category: "Inventario",
      frequency: "Mensual",
      description: "Muestra la distribución actual del inventario por estado CMDB para analizar disponibilidad, uso efectivo, pendientes técnicos y activos fuera de servicio.",
      sampleResult: "74% del parque en uso, 9% en laboratorio, 11% en stock, 6% en baja.",
      parameters: [
        { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Monitor", "Periférico", "Servidor"] },
        { type: "select", label: "Estado CMDB", key: "cmdb_status", options: ["Todos", "En uso", "En revisión", "Mantenimiento"] },
        { type: "date", label: "Fecha corte", key: "cutoff" },
        { type: "select", label: "Vista", key: "view", options: ["Resumen", "Detalle"] }
      ],
      columns: ["Código", "Tipo", "Modelo", "Estado CMDB", "Estado operativo", "Usuario actual"],
      rows: [
        ["NB-24017", "Notebook", "Latitude 5440", "En uso", "Operativo", "Paula Ferreyra"],
        ["NB-24021", "Notebook", "EliteBook 840 G10", "En revisión", "No operativo", "Joaquín Herrera"],
        ["SV-0009", "Servidor", "PowerEdge R650", "Mantenimiento", "Operativo", "Infraestructura"]
      ]
    },
    {
      id: "report-7",
      name: "Activos próximos a recambio",
      category: "Renovación",
      frequency: "Mensual",
      description: "Identifica equipos cercanos al fin de vida útil o con antigüedad crítica para planificar renovación, presupuesto y reasignaciones preventivas.",
      sampleResult: "36 activos superan el umbral de recambio. 19 corresponden a notebooks de uso intensivo.",
      parameters: [
        { type: "select", label: "Familia de activo", key: "asset_family", options: ["Todas", "Notebook", "Desktop", "Monitor", "Servidor"] },
        { type: "select", label: "Antigüedad mínima", key: "age", options: ["36 meses", "48 meses", "60 meses"] },
        { type: "date", label: "Fecha corte", key: "cutoff" },
        { type: "select", label: "Ordenar por", key: "sort", options: ["Antigüedad", "Área", "Modelo"] }
      ],
      columns: ["Código", "Activo", "Modelo", "Fecha alta", "Antigüedad", "Usuario actual", "Estado"],
      rows: [
        ["NB-21003", "Notebook Ejecutiva", "Latitude 7420", "2021-02-16", "49 meses", "Paula Ferreyra", "Operativo"],
        ["PC-18077", "Desktop Administrativo", "OptiPlex 7090", "2020-11-08", "52 meses", "Laura Ponce", "Operativo"],
        ["MN-10440", "Monitor Corporativo", "P2419H", "2020-07-22", "56 meses", "Carla Rosales", "Operativo"]
      ]
    },
    {
      id: "report-8",
      name: "Recepciones con reparación requerida",
      category: "Laboratorio",
      frequency: "Semanal",
      description: "Lista recepciones que derivaron en reparación para medir carga técnica, identificar causas recurrentes y priorizar repuestos o derivaciones.",
      sampleResult: "12 recepciones marcaron reparación requerida. Los casos más repetidos corresponden a batería y almacenamiento.",
      parameters: [
        { type: "date", label: "Desde", key: "from_date" },
        { type: "date", label: "Hasta", key: "to_date" },
        { type: "select", label: "Estado del caso", key: "case_status", options: ["Todos", "Pendiente", "En reparación", "Resuelto"] },
        { type: "select", label: "Técnico", key: "technician", options: ["Todos", "Natalia Quiroga", "Lucía Vera", "Marina Sosa"] }
      ],
      columns: ["Acta", "Activo", "Falla inicial", "Diagnóstico", "Técnico", "Estado", "Fecha ingreso"],
      rows: [
        ["REC-2026-0142", "NB-24021", "Apagado aleatorio", "Batería degradada", "Natalia Quiroga", "Pendiente", "2026-03-13"],
        ["REC-2026-0131", "PC-19077", "Error de disco", "SSD con fallas", "Marina Sosa", "En reparación", "2026-03-11"],
        ["REC-2026-0127", "NB-23318", "Pantalla intermitente", "Flex dañado", "Lucía Vera", "Resuelto", "2026-03-08"]
      ]
    },
    {
      id: "report-9",
      name: "Entregas pendientes de confirmación",
      category: "Documental",
      frequency: "Diario",
      description: "Controla actas de entrega emitidas que aún no tienen validación final del receptor o cierre documental completo.",
      sampleResult: "7 actas siguen pendientes de confirmación. 4 requieren firma y 3 necesitan envío documental.",
      parameters: [
        { type: "date", label: "Desde", key: "from_date" },
        { type: "date", label: "Hasta", key: "to_date" },
        { type: "select", label: "Pendiente de", key: "pending_type", options: ["Todos", "Firma", "Envío", "Cierre documental"] },
        { type: "select", label: "Responsable", key: "owner", options: ["Todos", "Marina Sosa", "Damián Ochoa", "Lucía Vera"] }
      ],
      columns: ["Acta", "Fecha", "Activo", "Persona", "Responsable", "Pendiente", "Estado"],
      rows: [
        ["ENT-2026-0318", "2026-03-13", "NB-24025", "Ivana Páez", "Marina Sosa", "Firma", "Pendiente"],
        ["ENT-2026-0315", "2026-03-09", "DK-19018", "Paula Ferreyra", "Marina Sosa", "Envío", "Pendiente"],
        ["ENT-2026-0309", "2026-03-06", "MN-11201", "Sergio Luna", "Damián Ochoa", "Cierre documental", "Pendiente"]
      ]
    },
    {
      id: "report-11",
      name: "Stock disponible por tipo de activo",
      category: "Inventario",
      frequency: "Diario",
      description: "Muestra los activos disponibles en stock, segmentados por familia, modelo y estado operativo para acelerar nuevas asignaciones.",
      sampleResult: "58 activos disponibles. Predominan notebooks estándar y monitores de 24 pulgadas.",
      parameters: [
        { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Desktop", "Monitor", "Periférico"] },
        { type: "select", label: "Estado operativo", key: "asset_state", options: ["Todos", "Operativo", "Pendiente", "En preparación"] },
        { type: "date", label: "Fecha corte", key: "cutoff" },
        { type: "select", label: "Ordenar por", key: "sort", options: ["Tipo", "Modelo", "Cantidad"] }
      ],
      columns: ["Código", "Activo", "Tipo", "Modelo", "Estado", "Ubicación lógica"],
      rows: [
        ["NB-24031", "Notebook Operativa", "Notebook", "Latitude 5450", "Operativo", "Stock TI"],
        ["MN-11452", "Monitor Corporativo", "Monitor", "P2425H", "Operativo", "Stock TI"],
        ["DK-19107", "Docking USB-C", "Periférico", "WD19S", "En preparación", "Almacén"]
      ]
    },
    {
      id: "report-18",
      name: "Activos por locación",
      category: "Inventario",
      frequency: "Semanal",
      description: "Distribuye el inventario por sede o ubicación lógica para facilitar control territorial, planificación de soporte y validación de presencia operativa.",
      sampleResult: "Oficina Central concentra el 46% de los activos visibles. Finanzas y Mesa de ayuda presentan mayor densidad operativa.",
      parameters: [
        { type: "select", label: "Locación", key: "location", options: ["Todas", "Oficina Central", "Oficina Norte", "Finanzas", "Mesa de ayuda", "Datacenter San Juan"] },
        { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Desktop", "Monitor", "Periférico", "Servidor"] },
        { type: "select", label: "Estado", key: "status", options: ["Todos", "Asignado", "Laboratorio", "Pendiente", "Disponible"] },
        { type: "date", label: "Fecha corte", key: "cutoff" }
      ],
      columns: ["Locación", "Código", "Activo", "Tipo", "Modelo", "Estado", "Usuario actual"],
      rows: [
        ["Oficina Central", "NB-24017", "Notebook Ejecutiva", "Notebook", "Latitude 5440", "Asignado", "Paula Ferreyra"],
        ["Finanzas", "MN-11044", "Monitor Corporativo", "Monitor", "P2423D", "Asignado", "Carla Rosales"],
        ["Mesa de ayuda", "NB-24021", "Notebook Analista", "Notebook", "EliteBook 840 G10", "Laboratorio", "Joaquín Herrera"]
      ]
    },
    {
      id: "report-14",
      name: "Actas sin respaldo completo",
      category: "Documental",
      frequency: "Diario",
      description: "Detecta documentación emitida con validaciones, anexos o cierres pendientes para reforzar control y completitud del circuito documental.",
      sampleResult: "6 documentos presentan faltantes. La mayoría corresponde a firmas y anexos de entrega.",
      parameters: [
        { type: "date", label: "Desde", key: "from_date" },
        { type: "date", label: "Hasta", key: "to_date" },
        { type: "select", label: "Tipo documental", key: "document_type", options: ["Todos", "Entrega", "Recepción", "Laboratorio"] },
        { type: "select", label: "Faltante", key: "missing", options: ["Todos", "Firma", "Adjunto", "Cierre"] }
      ],
      columns: ["Documento", "Tipo", "Fecha", "Activo", "Responsable", "Faltante", "Estado"],
      rows: [
        ["ENT-2026-0318", "Entrega", "2026-03-13", "NB-24025", "Marina Sosa", "Firma", "Pendiente"],
        ["REC-2026-0140", "Recepción", "2026-03-12", "PR-70028", "Lucía Vera", "Adjunto", "Pendiente"],
        ["LAB-2026-0046", "Laboratorio", "2026-03-10", "NB-23318", "Natalia Quiroga", "Cierre", "Pendiente"]
      ]
    },
    {
      id: "report-15",
      name: "Modelos fuera de estándar",
      category: "Renovación",
      frequency: "Mensual",
      description: "Agrupa activos que no pertenecen al catálogo tecnológico vigente para apoyar decisiones de normalización y renovación progresiva.",
      sampleResult: "21 activos corresponden a modelos fuera de estándar. 13 impactan puestos críticos de operación.",
      parameters: [
        { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Desktop", "Monitor"] },
        { type: "select", label: "Área", key: "business_area", options: ["Todas", "Operaciones", "Finanzas", "Dirección Comercial"] },
        { type: "date", label: "Fecha corte", key: "cutoff" },
        { type: "select", label: "Ordenar por", key: "sort", options: ["Modelo", "Antigüedad", "Área"] }
      ],
      columns: ["Código", "Activo", "Modelo", "Área", "Usuario", "Antigüedad", "Estado"],
      rows: [
        ["NB-21003", "Notebook Ejecutiva", "Latitude 7420", "Dirección Comercial", "Paula Ferreyra", "49 meses", "Operativo"],
        ["PC-18077", "Desktop Administrativo", "OptiPlex 7090", "Finanzas", "Laura Ponce", "52 meses", "Operativo"],
        ["NB-22018", "Notebook Operativa", "ProBook 440 G8", "Operaciones", "Tomás Agüero", "44 meses", "Operativo"]
      ]
    },
    {
      id: "report-16",
      name: "Activos sin usuario o ubicación",
      category: "Calidad CMDB",
      frequency: "Semanal",
      description: "Detecta registros incompletos en CMDB donde faltan relaciones clave como usuario asignado o ubicación lógica, afectando trazabilidad y control.",
      sampleResult: "14 activos presentan campos críticos incompletos. 9 no tienen usuario y 5 carecen de ubicación lógica.",
      parameters: [
        { type: "select", label: "Dato faltante", key: "missing_data", options: ["Todos", "Usuario", "Ubicación", "Ambos"] },
        { type: "select", label: "Tipo de activo", key: "asset_type", options: ["Todos", "Notebook", "Monitor", "Servidor", "Periférico"] },
        { type: "date", label: "Fecha corte", key: "cutoff" },
        { type: "select", label: "Ordenar por", key: "sort", options: ["Código", "Tipo", "Dato faltante"] }
      ],
      columns: ["Código", "Activo", "Tipo", "Usuario actual", "Ubicación", "Dato faltante"],
      rows: [
        ["NB-24044", "Notebook Operativa", "Notebook", "-", "Oficina Norte", "Usuario"],
        ["MN-11502", "Monitor Corporativo", "Monitor", "Carla Rosales", "-", "Ubicación"],
        ["DK-19128", "Docking USB-C", "Periférico", "-", "-", "Ambos"]
      ]
    },
    {
      id: "report-17",
      name: "Inconsistencias entre CMDB y actas",
      category: "Calidad CMDB",
      frequency: "Semanal",
      description: "Compara la relación documental con el estado actual de CMDB para encontrar activos con asignación, estado o custodio que no coinciden con el respaldo emitido.",
      sampleResult: "5 inconsistencias detectadas entre asignación documental y usuario vigente en CMDB.",
      parameters: [
        { type: "date", label: "Desde", key: "from_date" },
        { type: "date", label: "Hasta", key: "to_date" },
        { type: "select", label: "Tipo de diferencia", key: "difference", options: ["Todos", "Usuario", "Estado", "Documento faltante"] },
        { type: "select", label: "Prioridad", key: "priority", options: ["Todas", "Alta", "Media", "Baja"] }
      ],
      columns: ["Activo", "CMDB actual", "Documento", "Dato observado", "Diferencia", "Prioridad"],
      rows: [
        ["NB-24017", "Paula Ferreyra", "ENT-2026-0317", "Usuario", "Sin diferencia", "Baja"],
        ["NB-24025", "Ivana Páez", "-", "Documento faltante", "Asignación sin acta", "Alta"],
        ["PR-70031", "En revisión", "REC-2026-0138", "Estado", "CMDB sin actualizar", "Media"]
      ]
    }
  ]
};
