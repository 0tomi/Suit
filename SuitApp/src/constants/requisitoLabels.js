/**
 * requisitoLabels.js — Traducciones al español de los tipos de requisitos.
 *
 * Los tipos provienen del catálogo seed-once de la API y están en inglés.
 * Como no tienen descripción en la BD, se usa este mapa para mostrar
 * nombres legibles en el panel de requisitos del editor de plantillas.
 */

export const REQUISITO_TYPE_LABELS = {
    // General
    text:                 'Texto libre',
    number:               'Número',
    date:                 'Fecha',
    dateTime:             'Fecha y hora',
    // Cliente
    clientCompleteName:   'Nombre completo',
    clientFirstName:      'Nombre',
    clientLastName:       'Apellido',
    clientIdentification: 'DNI / Identificación',
    clientAddress:        'Domicilio',
    clientEmail:          'Correo electrónico',
    clientPhone:          'Teléfono',
    // Usuario / Abogado
    userCompleteName:     'Nombre completo',
    userName:             'Nombre',
    userLastName:         'Apellido',
    userEmail:            'Correo electrónico',
    userRegistration:     'Matrícula',
    userCuit:             'CUIT',
    // Caso
    caseTitle:            'Carátula',
    caseNumber:           'N° de expediente',
    caseStartDate:        'Fecha de inicio',
    caseEndDate:          'Fecha de cierre',
    // Sub-entidades del caso
    caseType:             'Tipo de causa',
    radicacion:           'Radicación',
    jurisdiccion:         'Jurisdicción',
    competencia:          'Competencia',
    dependencia:          'Juzgado / Dependencia',
    // Financiero
    amount:               'Monto',
    paymentType:          'Tipo de pago',
    // Partes contrarias
    parteCompleteName:    'Nombre completo',
    parteIdentification:  'DNI / Identificación',
    parteAddress:         'Domicilio',
    // Ubicación
    city:                 'Ciudad',
    province:             'Provincia',
    address:              'Dirección',
    // Eventos
    eventType:            'Tipo de evento',
    eventName:            'Nombre del evento',
    eventDate:            'Fecha del evento',
    // Especial
    custom:               'Texto personalizado',
    // Fechas (partes derivadas)
    anioNombrado:         'Año (nombrado)',
    mesNombrado:          'Mes (nombrado)',
    diaNombrado:          'Día (nombrado)',
    anioNumero:           'Año (número)',
    mesNumero:            'Mes (número)',
    diaNumero:            'Día (número)',
    fechaConMesNombrado:  'Fecha completa (día N de mes de año)',
    // Financiero (monto en texto)
    montoNombrado:        'Monto (nombrado)',
    // Cliente - tratamiento por género
    clientTreatment:      'Tratamiento (Sr./Sra.)',
};

/**
 * Retorna el label localizado para un tipo de requisito.
 * Si el tipo no está en el mapa, devuelve el type tal cual (fallback).
 */
export function getRequisitoLabel(type) {
    return REQUISITO_TYPE_LABELS[type] ?? type;
}

/**
 * Categorías de requisitos para agrupar el panel lateral.
 * El campo `types` lista exactamente los types que pertenecen a cada categoría.
 */
export const REQUISITO_CATEGORIES = [
    {
        key: 'general',
        label: 'General',
        types: ['text', 'number', 'date', 'dateTime', 'custom'],
    },
    {
        key: 'fechas',
        label: 'Fechas',
        types: ['anioNombrado', 'mesNombrado', 'diaNombrado', 'anioNumero', 'mesNumero', 'diaNumero', 'fechaConMesNombrado'],
    },
    {
        key: 'cliente',
        label: 'Cliente',
        types: [
            'clientCompleteName', 'clientFirstName', 'clientLastName',
            'clientIdentification', 'clientAddress', 'clientEmail', 'clientPhone',
            'clientTreatment',
        ],
    },
    {
        key: 'caso',
        label: 'Caso',
        types: [
            'caseTitle', 'caseNumber', 'caseStartDate', 'caseEndDate',
            'caseType', 'radicacion', 'jurisdiccion', 'competencia', 'dependencia',
        ],
    },
    {
        key: 'usuario',
        label: 'Usuario / Abogado',
        types: [
            'userCompleteName', 'userName', 'userLastName',
            'userEmail', 'userRegistration', 'userCuit',
        ],
    },
    {
        key: 'partes',
        label: 'Partes',
        types: ['parteCompleteName', 'parteIdentification', 'parteAddress'],
    },
    {
        key: 'financiero',
        label: 'Financiero',
        types: ['amount', 'paymentType', 'montoNombrado'],
    },
    {
        key: 'ubicacion',
        label: 'Ubicación',
        types: ['city', 'province', 'address'],
    },
    {
        key: 'eventos',
        label: 'Eventos',
        types: ['eventType', 'eventName', 'eventDate'],
    },
];
