import SectionsPanel from '../components/settings/SectionsPanel.jsx';

/**
 * Página legacy de secciones. Mantiene la ruta existente reutilizando el mismo
 * panel ahora expuesto también dentro de Ajustes.
 */
function Sections() {
    return (
        <SectionsPanel
            containerClassName="max-w-5xl mx-auto"
            showPinButtons={false}
            description="Navegá rápidamente a cualquier sección de la aplicación."
        />
    );
}

export default Sections;
