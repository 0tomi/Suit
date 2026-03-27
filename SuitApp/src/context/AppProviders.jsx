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
import { RequisitosProvider } from './RequisitosContext';
import { DeadlinesProvider } from './DeadlinesContext';
import { HotkeysProvider } from '../hotkeys/HotkeysProvider';
import { RadicacionesProvider } from './RadicacionesContext';
import { JurisdiccionesProvider } from './JurisdiccionesContext';
import { CompetenciasProvider } from './CompetenciasContext';
import { DependenciasJudicialesProvider } from './DependenciasJudicialesContext';
import { TipoExpedientesProvider } from './TipoExpedientesContext';
import { RolesProvider } from './RolesContext';
import { TipoPagosProvider } from './TipoPagosContext';
import { GastoCatalogoProvider } from './GastoCatalogoContext';
import { PartesProvider } from './PartesContext';
import { MultimediaProvider } from './MultimediaContext';
import { FilesProvider } from './FilesContext';
import { TabsProvider } from './TabsContext';

export const AppProviders = ({ children }) => {
    return (
        <SettingsProvider>
            <HotkeysProvider>
                <SyncStatusProvider>
                    <CasesProvider>
                        <CaseTypesProvider>
                            <RadicacionesProvider>
                                <JurisdiccionesProvider>
                                <CompetenciasProvider>
                                <DependenciasJudicialesProvider>
                                <TipoExpedientesProvider>
                                    <ClientsProvider>
                                        <TemplateCategoriesProvider>
                                            <TemplatesProvider>
                                                <RequisitosProvider>
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
                                                                                            <TabsProvider>
                                                                            {children}
                                                                        </TabsProvider>
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
                                                </RequisitosProvider>
                                            </TemplatesProvider>
                                        </TemplateCategoriesProvider>
                                    </ClientsProvider>
                                </TipoExpedientesProvider>
                                </DependenciasJudicialesProvider>
                                </CompetenciasProvider>
                                </JurisdiccionesProvider>
                            </RadicacionesProvider>
                        </CaseTypesProvider>
                    </CasesProvider>
                </SyncStatusProvider>
            </HotkeysProvider>
        </SettingsProvider>
    );
};
