import { SyncStatusProvider } from './SyncStatusContext';
import { CasesProvider } from './CasesContext';
import { ClientsProvider } from './ClientsContext';
import { DocumentsProvider } from './DocumentsContext';
import { EventsProvider } from './EventsContext.jsx';
import { UsersProvider } from './UsersContext';
import { CaseTypesProvider } from './CaseTypesContext';
import { EventTypesProvider } from './EventTypesContext';
import { SettingsProvider } from './SettingsContext';
import { TemplatesProvider } from './TemplatesContext';
import { TemplateCategoriesProvider } from './TemplateCategoriesContext';
import { DeadlinesProvider } from './DeadlinesContext';
import { HotkeysProvider } from '../hotkeys/HotkeysProvider';
import { RadicacionesProvider } from './RadicacionesContext';
import { TipoExpedientesProvider } from './TipoExpedientesContext';
import { RolesProvider } from './RolesContext';
import { TipoPagosProvider } from './TipoPagosContext';
import { GastoCatalogoProvider } from './GastoCatalogoContext';
import { PartesProvider } from './PartesContext';
import { MultimediaProvider } from './MultimediaContext';
import { FilesProvider } from './FilesContext';
import { PublicFileCatalogsProvider } from './PublicFileCatalogsContext';
import { PublicFilesProvider } from './PublicFilesContext';

export const AppProviders = ({ children }) => {
    return (
        <SettingsProvider>
            <HotkeysProvider>
                <SyncStatusProvider>
                    <CasesProvider>
                        <CaseTypesProvider>
                            <RadicacionesProvider>
                                <TipoExpedientesProvider>
                                    <ClientsProvider>
                                        <TemplateCategoriesProvider>
                                            <TemplatesProvider>
                                                <DocumentsProvider>
                                                    <EventsProvider>
                                                        <EventTypesProvider>
                                                            <DeadlinesProvider>
                                                                <RolesProvider>
                                                                    <TipoPagosProvider>
                                                                        <GastoCatalogoProvider>
                                                                            <PartesProvider>
                                                                                <MultimediaProvider>
                                                                                    <FilesProvider>
                                                                                        <UsersProvider>
                                                                                            <PublicFileCatalogsProvider>
                                                                                                <PublicFilesProvider>
                                                                                                    {children}
                                                                                                </PublicFilesProvider>
                                                                                            </PublicFileCatalogsProvider>
                                                                                        </UsersProvider>
                                                                                    </FilesProvider>
                                                                                </MultimediaProvider>
                                                                            </PartesProvider>
                                                                        </GastoCatalogoProvider>
                                                                    </TipoPagosProvider>
                                                                </RolesProvider>
                                                            </DeadlinesProvider>
                                                        </EventTypesProvider>
                                                    </EventsProvider>
                                                </DocumentsProvider>
                                            </TemplatesProvider>
                                        </TemplateCategoriesProvider>
                                    </ClientsProvider>
                                </TipoExpedientesProvider>
                            </RadicacionesProvider>
                        </CaseTypesProvider>
                    </CasesProvider>
                </SyncStatusProvider>
            </HotkeysProvider>
        </SettingsProvider>
    );
};
