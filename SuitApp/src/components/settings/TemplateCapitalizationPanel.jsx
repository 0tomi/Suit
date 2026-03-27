/**
 * TemplateCapitalizationPanel.jsx
 *
 * Panel reutilizable para configurar la capitalización del motor de plantillas.
 * Se usa tanto en la sección "Plantillas" de Configuración como en el modal
 * de UseTemplateModal para acceso rápido desde el flujo de uso.
 */
import { useSettings } from '../../context/SettingsContext.jsx';
import { CAPITALIZATION_MODE, DEFAULT_TEMPLATE_CAPITALIZATION } from '../../utils/templateCapitalization.js';
import { Info } from 'lucide-react';

// ─── Texto de ejemplo para previsualizar el modo activo ───────────────────────
const EXAMPLE_SOURCE = 'García c/ Pérez s/ daños y perjuicios — ciudad de Buenos Aires';

function previewExample(mode) {
    if (mode === CAPITALIZATION_MODE.UPPER) {
        return EXAMPLE_SOURCE.toUpperCase();
    }
    // TITLE_CASE: primera letra de cada palabra en mayúscula, resto en minúscula
    return EXAMPLE_SOURCE
        .split(' ')
        .map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
        .join(' ');
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, id }) => (
    <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
    </button>
);

// ─── Grupos de campos configurables ──────────────────────────────────────────
const TEMPLATE_FIELD_GROUPS = [
    {
        label: 'Caso',
        fields: [
            { key: 'caseTitle',     label: 'Título del caso',            description: 'Ej: "García c/ Pérez s/ daños y perjuicios"' },
            { key: 'caseType',      label: 'Tipo de caso',               description: 'Ej: "civil y comercial"' },
            { key: 'radicacion',    label: 'Radicación',                 description: 'Ej: "federal"' },
            { key: 'jurisdiccion',  label: 'Jurisdicción',               description: 'Ej: "federal"' },
            { key: 'competencia',   label: 'Competencia',                description: 'Ej: "civil"' },
            { key: 'dependencia',   label: 'Juzgado / Dependencia',      description: 'Ej: "juzgado federal nº 1"' },
        ],
    },
    {
        label: 'Cliente',
        fields: [
            { key: 'clientCompleteName', label: 'Nombre completo',       description: 'Incluye tratamiento (Sr./Sra.) y nombre completo' },
            { key: 'clientFirstName',    label: 'Nombre',                description: 'Solo el nombre de pila' },
            { key: 'clientLastName',     label: 'Apellido',              description: 'Incluye tratamiento (Sr./Sra.)' },
        ],
    },
    {
        label: 'Abogado / Usuario',
        fields: [
            { key: 'userCompleteName', label: 'Nombre completo',         description: 'Nombre y apellido del profesional' },
            { key: 'userLastName',     label: 'Apellido',                description: 'Apellido del profesional' },
        ],
    },
    {
        label: 'Partes contrarias',
        fields: [
            { key: 'parteCompleteName', label: 'Nombre completo de la parte', description: 'Nombre y apellido de la parte' },
        ],
    },
    {
        label: 'Fechas nombradas',
        fields: [
            { key: 'mesNombrado',         label: 'Mes en palabras',          description: 'Ej: "marzo"' },
            { key: 'diaNombrado',         label: 'Día en palabras',          description: 'Ej: "quince"' },
            { key: 'anioNombrado',        label: 'Año en palabras',          description: 'Ej: "dos mil veintiséis"' },
            { key: 'fechaConMesNombrado', label: 'Fecha con mes nombrado',   description: 'Ej: "día 15 de marzo de 2026"' },
        ],
    },
    {
        label: 'Financiero',
        fields: [
            { key: 'montoNombrado', label: 'Monto en palabras',              description: 'Ej: "un millón quinientos mil"' },
            { key: 'paymentType',   label: 'Tipo de pago',                   description: 'Ej: "efectivo", "transferencia"' },
        ],
    },
    {
        label: 'Ubicación',
        fields: [
            { key: 'city',     label: 'Ciudad',        description: 'Ej: "buenos aires"' },
            { key: 'province', label: 'Provincia',     description: 'Ej: "córdoba"' },
            { key: 'address',  label: 'Dirección',     description: 'Ej: "calle rivadavia 123"' },
        ],
    },
    {
        label: 'Eventos',
        fields: [
            { key: 'eventType', label: 'Tipo de evento',   description: 'Ej: "audiencia", "pericia"' },
            { key: 'eventName', label: 'Nombre del evento', description: 'Título o descripción del evento' },
        ],
    },
];

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * Panel de configuración de capitalización del motor de plantillas.
 * Consume y actualiza directamente el contexto de settings.
 */
const TemplateCapitalizationPanel = () => {
    const {
        templateCapitalization, setTemplateCapitalization,
        templateClientTreatment, setTemplateClientTreatment,
    } = useSettings();

    const fields = templateCapitalization?.fields ?? DEFAULT_TEMPLATE_CAPITALIZATION.fields;
    const mode   = templateCapitalization?.mode   ?? CAPITALIZATION_MODE.TITLE_CASE;

    const activeCount = Object.values(fields).filter(Boolean).length;
    const example = previewExample(mode);

    const handleFieldToggle = (key, value) => {
        setTemplateCapitalization({ fields: { [key]: value } });
    };

    const handleModeChange = (newMode) => {
        setTemplateCapitalization({ mode: newMode });
    };

    return (
        <div className="space-y-6">

            {/* ── Tratamiento formal (Sr./Sra.) ─────────────────────────────── */}
            <div>
                <p className="font-medium text-(--text-primary) mb-1">Tratamiento formal</p>
                <p className="text-sm text-(--text-secondary) mb-3">
                    Controla si se antepone <span className="font-mono text-xs bg-(--bg-card-hover) px-1 rounded">Sr.</span> o <span className="font-mono text-xs bg-(--bg-card-hover) px-1 rounded">Sra.</span> al nombre completo y apellido del cliente, según el género registrado.
                </p>
                <div className="rounded-xl border border-(--border-default) overflow-hidden">
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-(--text-primary)">Incluir Sr. / Sra. en nombres de cliente</p>
                            <p className="text-xs text-(--text-secondary) mt-0.5">
                                {templateClientTreatment
                                    ? 'Activo — Ej: "Sr. García", "Sra. María González"'
                                    : 'Inactivo — Ej: "García", "María González"'}
                            </p>
                        </div>
                        <Toggle
                            id="template-client-treatment"
                            checked={templateClientTreatment ?? true}
                            onChange={setTemplateClientTreatment}
                        />
                    </div>
                </div>
            </div>

            {/* ── Selector de modo ─────────────────────────────────────────── */}
            <div>
                <p className="font-medium text-(--text-primary) mb-1">Modo de capitalización</p>
                <p className="text-sm text-(--text-secondary) mb-3">
                    Se aplicará a cada campo habilitado al generar documentos desde plantilla.
                </p>

                {/* Pills de modo */}
                <div className="inline-flex rounded-lg border border-(--border-default) overflow-hidden">
                    <button
                        onClick={() => handleModeChange(CAPITALIZATION_MODE.TITLE_CASE)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                            mode === CAPITALIZATION_MODE.TITLE_CASE
                                ? 'bg-blue-600 text-white'
                                : 'bg-(--bg-card) text-(--text-secondary) hover:bg-(--bg-card-hover)'
                        }`}
                    >
                        Primera mayúscula por palabra
                    </button>
                    <button
                        onClick={() => handleModeChange(CAPITALIZATION_MODE.UPPER)}
                        className={`px-4 py-2 text-sm font-medium border-l border-(--border-default) transition-colors ${
                            mode === CAPITALIZATION_MODE.UPPER
                                ? 'bg-blue-600 text-white'
                                : 'bg-(--bg-card) text-(--text-secondary) hover:bg-(--bg-card-hover)'
                        }`}
                    >
                        Todo en mayúsculas
                    </button>
                </div>

                {/* Ejemplo en vivo */}
                <div className="mt-3 rounded-lg border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-(--text-tertiary) mb-1">Ejemplo</p>
                    <p className="text-sm font-mono text-(--text-primary)">{example}</p>
                </div>
            </div>

            {/* ── Aviso cuando no hay campos activos ───────────────────────── */}
            {activeCount === 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        Ningún campo habilitado. El texto se escribirá tal como está guardado en la aplicación, sin transformaciones.
                    </p>
                </div>
            )}

            {/* ── Grupos de campos ─────────────────────────────────────────── */}
            <div className="space-y-6">
                {TEMPLATE_FIELD_GROUPS.map((group) => (
                    <div key={group.label}>
                        <p className="text-xs font-bold uppercase tracking-wider text-(--text-tertiary) mb-2">
                            {group.label}
                        </p>
                        <div className="rounded-xl border border-(--border-default) overflow-hidden">
                            {group.fields.map(({ key, label, description }) => (
                                <div
                                    key={key}
                                    className="flex items-center justify-between gap-4 px-4 py-3 border-b border-(--border-subtle) last:border-b-0"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-(--text-primary)">{label}</p>
                                        <p className="text-xs text-(--text-secondary) mt-0.5">{description}</p>
                                    </div>
                                    <Toggle
                                        id={`cap-field-${key}`}
                                        checked={Boolean(fields[key])}
                                        onChange={(val) => handleFieldToggle(key, val)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TemplateCapitalizationPanel;
