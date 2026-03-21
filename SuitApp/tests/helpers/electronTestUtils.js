import os from 'os';
import path from 'path';
import { _electron as electron, expect } from '@playwright/test';

const SECTION_CONFIG = {
    reports: {
        navTestId: 'sidebar-nav-reports',
        titleTestId: 'page-reports-title',
        titleText: 'Panel operativo del estudio',
    },
    agenda: {
        navTestId: 'sidebar-nav-agenda',
        titleTestId: 'page-agenda-title',
        titleText: 'Agenda General',
    },
    clients: {
        navTestId: 'sidebar-nav-people',
        titleTestId: 'page-people-title',
        titleText: 'Personas',
    },
    cases: {
        navTestId: 'sidebar-nav-cases',
        titleTestId: 'page-cases-title',
        titleText: 'Gestión de Casos',
    },
    documents: {
        navTestId: 'sidebar-nav-documents',
        titleTestId: 'page-documents-title',
        titleText: 'Documentos',
    },
    deadlines: {
        navTestId: 'sidebar-nav-deadlines',
        titleTestId: 'page-deadlines-title',
        titleText: 'Vencimientos',
    },
    sections: {
        navTestId: 'sidebar-nav-sections-manager', // testId real en Sidebar.jsx
        titleTestId: 'page-sections-title',
        titleText: 'Secciones',
    },
    templates: {
        navTestId: 'sidebar-nav-templates',
        titleTestId: 'page-templates-title',
        titleText: 'Galería de Modelos',
    },
    admin: {
        navTestId: 'sidebar-nav-admin',
        titleTestId: 'page-admin-title',
        titleText: 'Panel de Administración',
    },
    people: {
        navTestId: 'sidebar-nav-people',
        titleTestId: 'page-people-title',
        titleText: 'Personas',
    },
    economia: {
        navTestId: 'sidebar-nav-economia',
        titleTestId: 'page-economia-title',
        titleText: 'Economía',
    },
    categorias: {
        navTestId: 'sidebar-nav-categorias',
        titleTestId: 'page-categorias-title',
        titleText: 'Categorías',
    },
};

function buildUserDataDir(prefix = 'suit-test') {
    return path.join(
        os.tmpdir(),
        `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2)}`,
    );
}

function getSectionConfig(section) {
    const config = SECTION_CONFIG[section];
    if (!config) {
        throw new Error(`Sección no soportada en goToSection/waitForPageReady: ${section}`);
    }
    return config;
}

export async function launchElectronApp(options = {}) {
    const normalized = typeof options === 'string' ? { prefix: options } : options;
    const prefix = normalized.prefix || 'suit-test';
    const userDataDir = normalized.userDataDir || buildUserDataDir(prefix);
    const electronApp = await electron.launch({
        args: ['electron/main.cjs', '--no-sandbox', '--disable-gpu', `--user-data-dir=${userDataDir}`],
        env: {
            ...process.env,
            ...(normalized.appEnv || {}),
            ELECTRON_RUN_AS_NODE: undefined,
            DISPLAY: process.env.DISPLAY || ':99',
        },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Log Electron crashes and page errors to stdout for hang detection
    window.on('crash', () => console.error('[electronTestUtils] Renderer CRASHED'));
    window.on('pageerror', (err) => console.error('[electronTestUtils] Page error:', err.message));
    window.on('console', msg => console.log('[Browser]', msg.text()));

    return { electronApp, window, userDataDir };
}

export async function waitForPageReady(window, section = 'agenda', { timeout = 15000 } = {}) {
    const config = getSectionConfig(section);
    const title = window.getByTestId(config.titleTestId);
    await expect(title).toBeVisible({ timeout });
    await expect(title).toContainText(config.titleText, { timeout });
}

export async function goToSection(window, section, { timeout = 15000 } = {}) {
    const config = getSectionConfig(section);
    await window.getByTestId(config.navTestId).click();
    await waitForPageReady(window, section, { timeout });
}

/**
 * Navega a una sección usando la página "Secciones" accesible desde el sidebar.
 * Este flujo sirve para abrir una sección puntual sin depender de que esté pineada.
 */
export async function goToSectionFromSectionsPage(window, section, { timeout = 15000 } = {}) {
    await goToSection(window, 'sections', { timeout });
    const sectionCard = window.getByTestId(`sections-card-link-${section}`);
    await sectionCard.waitFor({ state: 'visible', timeout });
    await sectionCard.click();
    await waitForPageReady(window, section, { timeout });
}

/**
 * Asegura que una sección opcional figure en el sidebar antes de navegar.
 * Sólo debe usarse cuando el test realmente necesita el pin en el sidebar.
 * La navegación a una sección puntual debe hacerse con `goToSectionFromSectionsPage`.
 */
export async function ensureSectionPinned(window, section, { timeout = 15000 } = {}) {
    const config = getSectionConfig(section);
    const navItem = window.getByTestId(config.navTestId);

    if (await navItem.isVisible().catch(() => false)) {
        return;
    }

    // La ruta pública /sections siempre existe; desde ahí el acceso a Ajustes > Secciones
    // es más estable que asumir que el click en Ajustes ya dejó visible el tab correcto.
    await goToSection(window, 'sections', { timeout });

    // Settings siempre está visible en el sidebar (no es una sección pineable).
    // SideMenuPageLayout genera ids con el atributo `id=`, no `data-testid`, por eso se usa locator('#...').
    await window.getByTestId('sidebar-nav-settings').click();
    await expect(window.locator('h1', { hasText: 'Configuración' })).toBeVisible({ timeout });
    const seccionesTab = window.locator('#settings-tab-secciones');
    await seccionesTab.waitFor({ state: 'visible', timeout });
    await seccionesTab.click();

    const pinButton = window.getByTestId(`sections-pin-btn-${section}`);
    await pinButton.waitFor({ state: 'visible', timeout });

    // El texto del botón es 'Mostrar en sidebar' cuando no está pineado.
    if ((await pinButton.innerText()).includes('Mostrar')) {
        await pinButton.click();
        await expect(pinButton).toContainText('No mostrar', { timeout: 5000 });
    }

    await expect(navItem).toBeVisible({ timeout });
}

export async function ensureLoggedIn(
    window,
    { username = 'test', password = 'testtest', loginTimeout = 60000 } = {},
) {
    // loginTimeout aumentado a 60s para cubrir arranques lentos (discovery + sync inicial).
    // El valor por defecto anterior era 30s, insuficiente cuando el servidor tarda en
    // responder al discovery o la sincronización inicial de recursos es extensa.
    const setupLocator = window.getByTestId('server-setup-modal');
    const loginLocator = window.getByTestId('login-submit');
    const agendaLocator = window.getByTestId('page-agenda-title');

    await Promise.race([
        setupLocator.waitFor({ timeout: 30000 }).catch(() => { }),
        loginLocator.waitFor({ timeout: 30000 }).catch(() => { }),
        agendaLocator.waitFor({ timeout: 30000 }).catch(() => { }),
        setupLocator.waitFor({ timeout: loginTimeout }).catch(() => { }),
        loginLocator.waitFor({ timeout: loginTimeout }).catch(() => { }),
        agendaLocator.waitFor({ timeout: loginTimeout }).catch(() => { }),
    ]);

    if (await setupLocator.isVisible()) {
        const localhostButton = window.getByTestId('server-setup-localhost');
        const acceptButton = window.getByTestId('server-setup-accept');

        // El modal puede convivir unos instantes con el login detrás. Si el setup sigue
        // visible, primero fijamos localhost y aceptamos para no intentar autenticar
        // contra una base API aún no confirmada.
        await Promise.race([
            localhostButton.waitFor({ state: 'visible', timeout: loginTimeout }).catch(() => { }),
            acceptButton.waitFor({ state: 'visible', timeout: loginTimeout }).catch(() => { }),
            agendaLocator.waitFor({ timeout: loginTimeout }).catch(() => { }),
        ]);

        if (await setupLocator.isVisible()) {
            await localhostButton.click();
            await acceptButton.waitFor({ state: 'visible', timeout: 5000 });
            await expect(acceptButton).toBeEnabled({ timeout: 5000 });
            await acceptButton.click();
            await Promise.race([
                loginLocator.waitFor({ timeout: 20000 }),
                agendaLocator.waitFor({ timeout: 20000 }),
            ]).catch(() => { });
        }
    }

    if (await loginLocator.isVisible()) {
        await window.getByTestId('login-username').waitFor({ timeout: 5000 });
        await window.getByTestId('login-username').fill(username);
        await window.getByTestId('login-password').fill(password);
        await window.getByTestId('login-submit').click();
    }

    await waitForPageReady(window, 'agenda', { timeout: 30000 });
    await waitForPageReady(window, 'agenda', { timeout: loginTimeout });
}

export async function launchAndLogin(options = {}) {
    const launched = await launchElectronApp({
        prefix: options.prefix || 'suit-test',
        userDataDir: options.userDataDir,
    });
    await ensureLoggedIn(launched.window, options.credentials);
    return launched;
}

/**
 * Resuelve la superficie abierta de un Select tolerando wrapper legacy y Radix real.
 * - Legacy: dropdown inline `div.absolute.z-50` dentro del contenedor relativo.
 * - Radix: contenido portalizado bajo `data-radix-popper-content-wrapper`.
 */
async function resolveOpenSelectSurface(page, triggerLocator, { timeout = 5000 } = {}) {
    await triggerLocator.click();

    await expect(triggerLocator).toHaveAttribute('data-state', 'open', { timeout }).catch(() => { });
    await expect(triggerLocator).toHaveAttribute('aria-expanded', 'true', { timeout }).catch(() => { });

    const candidates = [
        page.locator('[data-radix-popper-content-wrapper]').last(),
        page.locator('body > div').filter({ has: page.locator('[role="option"]') }).last(),
        page.locator('body > div').filter({ has: page.locator('[data-radix-collection-item]') }).last(),
        page.getByRole('listbox').last(),
        triggerLocator
            .locator('xpath=ancestor::div[contains(@class,"relative")][1]')
            .locator('div.absolute.z-50'),
    ];

    for (const candidate of candidates) {
        if (await candidate.isVisible().catch(() => false)) {
            return candidate;
        }
    }

    throw new Error('No se encontró la superficie abierta del Select');
}

/**
 * Selecciona una opción por texto, soportando items con `role="option"` o botones legacy.
 */
export async function selectDropdownOption(page, triggerLocator, optionText, { timeout = 8000 } = {}) {
    const surface = await resolveOpenSelectSurface(page, triggerLocator, { timeout });
    const optionLocators = [
        surface.getByRole('option', { name: optionText, exact: false }),
        surface.getByRole('button', { name: optionText, exact: false }),
        page.getByRole('option', { name: optionText, exact: false }),
        page.getByRole('button', { name: optionText, exact: false }),
    ];

    for (const locator of optionLocators) {
        const option = locator.first();
        if (await option.isVisible().catch(() => false)) {
            await option.click({ timeout });
            return optionText;
        }
    }

    throw new Error(`No se encontró la opción "${optionText}" en el Select`);
}

/**
 * Selecciona la primera opción visible útil y devuelve el label elegido.
 * Sirve para smokes donde cualquier dato real de catálogo es suficiente.
 */
export async function selectFirstDropdownOption(page, triggerLocator, { timeout = 8000 } = {}) {
    const surface = await resolveOpenSelectSurface(page, triggerLocator, { timeout });
    const optionGroups = [
        surface.getByRole('option'),
        surface.getByRole('button'),
    ];

    for (const group of optionGroups) {
        const optionCount = await group.count().catch(() => 0);
        for (let index = 0; index < optionCount; index += 1) {
            const option = group.nth(index);
            const label = ((await option.textContent().catch(() => '')) || '').trim();

            if (!label) {
                continue;
            }

            if (await option.isVisible().catch(() => false)) {
                await option.click({ timeout });
                return label;
            }
        }
    }

    return null;
}

export async function getCurrentUser(window) {
    return await window.evaluate(async () => {
        const raw = await window.electronAPI.config.get('auth_user');
        if (raw) return JSON.parse(raw);

        const users = await window.electronAPI.db.getAll('users');
        const firstUser = Array.isArray(users) ? users[0] : null;
        if (firstUser) {
            if (firstUser.data_json) {
                try {
                    return JSON.parse(firstUser.data_json);
                } catch {
                    // Fallback a columnas planas si el JSON está ausente o corrupto.
                }
            }

            return {
                id: firstUser.id ?? null,
                name: firstUser.name ?? null,
                tag: firstUser.tag ?? null,
                role: firstUser.role ?? null,
                email: firstUser.email ?? null,
            };
        }

        const [host, port, authToken] = await Promise.all([
            window.electronAPI.config.get('api_host'),
            window.electronAPI.config.get('api_port'),
            window.electronAPI.config.get('auth_token'),
        ]);

        if (!host || !port || !authToken) {
            const fallbackUser = { id: 1, tag: 'test' };
            await window.electronAPI.config.set('auth_user', JSON.stringify(fallbackUser));
            return fallbackUser;
        }

        try {
            const response = await fetch(`http://${host}:${port}/api/user`, {
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
            });

            if (!response.ok) return null;
            const user = await response.json();
            await window.electronAPI.config.set('auth_user', JSON.stringify(user));
            return user;
        } catch {
            const fallbackUser = { id: 1, tag: 'test' };
            await window.electronAPI.config.set('auth_user', JSON.stringify(fallbackUser));
            return fallbackUser;
        }
    });
}

export async function seedPastReminder(window, overrides = {}) {
    const currentUser = await getCurrentUser(window);
    if (!currentUser?.id) {
        throw new Error('No authenticated user found in config');
    }

    const eventId = overrides.eventId ?? Math.floor(Date.now() / 1000);
    const minutesAgo = overrides.minutesAgo ?? 10;
    const now = new Date();
    const eventDate = new Date(now.getTime() - minutesAgo * 60 * 1000);
    // starts_at naive (sin Z): se construye con partes locales para evitar corrimiento UTC.
    const pad = (n) => String(n).padStart(2, '0');
    const startsAt = `${eventDate.getFullYear()}-${pad(eventDate.getMonth() + 1)}-${pad(eventDate.getDate())}T${pad(eventDate.getHours())}:${pad(eventDate.getMinutes())}:${pad(eventDate.getSeconds())}`;
    const notifyAt = startsAt; // el evento ya pasó, notify_at = starts_at del evento pasado
    const title = overrides.title ?? `PW-Notificacion-${eventId}`;
    const description = overrides.description ?? 'Recordatorio sembrado desde Playwright';

    await window.evaluate(async ({ eventId, userId, startsAt, notifyAt, title, description }) => {
        await window.electronAPI.db.upsertMany('events', [{
            id: eventId,
            agenda_id: 1,
            suit_case_id: null,
            event_type_id: 1,
            title,
            description,
            starts_at: startsAt,
            is_all_day: 0,
            data_json: JSON.stringify({
                id: eventId,
                agenda_id: 1,
                suit_case_id: null,
                event_type_id: 1,
                title,
                description,
                starts_at: startsAt,
                is_all_day: 0,
            }),
            synced_at: new Date().toISOString(),
        }]);

        await window.electronAPI.db.upsertMany('event_notifications', [{
            event_id: eventId,
            user_id: userId,
            notify_at: notifyAt,
            last_updated_at: new Date().toISOString(),
            status: 'pending_read',
            handled_at: new Date().toISOString(),
            data_json: JSON.stringify({
                event_id: eventId,
                user_id: userId,
                notify_at: notifyAt,
                status: 'pending_read',
                title,
                description,
                starts_at: startsAt,
            }),
            synced_at: new Date().toISOString(),
        }]);
    }, {
        eventId,
        userId: currentUser.id,
        startsAt,
        notifyAt,
        title,
        description,
    });

    return {
        eventId,
        userId: currentUser.id,
        title,
        description,
        starts_at: startsAt,
    };
}
