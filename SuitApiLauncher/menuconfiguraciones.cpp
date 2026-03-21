#include "menuconfiguraciones.h"
#include "ui_menuconfiguraciones.h"
#include "configmanager.h"
#include "envparser.h"
#include "caddyfileparser.h"
#include "dialogrecuperacion.h"
#include <QCoreApplication>
#include <QFile>
#include <QFileDialog>
#include <QTextStream>
#include <QMessageBox>
#include <QSettings>
#include <QSpinBox>
#include <QComboBox>
#include <QVBoxLayout>
#include <QStandardPaths>
#include <utility>

// --- Helpers para conversión segundos <-> valor+unidad -----------------------
// Índices de cmbIntervaloBackupUnidad / cmbLimpiezaUnidad:
//   0=Minutos, 1=Horas, 2=Días, 3=Semanas, 4=Meses

static const int kMultiplicadores[] = {60, 3600, 86400, 604800, 2592000};

static void segundosAWidget(int totalSegundos, QSpinBox *spn, QComboBox *cmb)
{
    for (int i = 4; i >= 0; i--) {
        if (totalSegundos >= kMultiplicadores[i] && totalSegundos % kMultiplicadores[i] == 0) {
            spn->setValue(totalSegundos / kMultiplicadores[i]);
            cmb->setCurrentIndex(i);
            return;
        }
    }
    spn->setValue(qMax(1, totalSegundos / 60));
    cmb->setCurrentIndex(0);
}

static int widgetASegundos(QSpinBox *spn, QComboBox *cmb)
{
    return spn->value() * kMultiplicadores[cmb->currentIndex()];
}

// --- Helpers para storage backup: 0=Horas, 1=Días, 2=Semanas ----------------

static const int kMultStorage[] = {3600, 86400, 604800};

static void segundosAWidgetStorage(int totalSegundos, QSpinBox *spn, QComboBox *cmb)
{
    for (int i = 2; i >= 0; i--) {
        if (totalSegundos >= kMultStorage[i] && totalSegundos % kMultStorage[i] == 0) {
            spn->setValue(totalSegundos / kMultStorage[i]);
            cmb->setCurrentIndex(i);
            return;
        }
    }
    spn->setValue(qMax(1, totalSegundos / 3600));
    cmb->setCurrentIndex(0);
}

static int widgetASegundosStorage(QSpinBox *spn, QComboBox *cmb)
{
    return spn->value() * kMultStorage[cmb->currentIndex()];
}

// --- Helpers para expiración Sanctum en minutos: 0=Min, 1=Hs, 2=Días, 3=Sem -

static const int kMultMinutos[] = {1, 60, 1440, 10080};

static void minutosAWidget(int totalMinutos, QSpinBox *spn, QComboBox *cmb)
{
    for (int i = 3; i >= 0; i--) {
        if (totalMinutos >= kMultMinutos[i] && totalMinutos % kMultMinutos[i] == 0) {
            spn->setValue(totalMinutos / kMultMinutos[i]);
            cmb->setCurrentIndex(i);
            return;
        }
    }
    spn->setValue(qMax(1, totalMinutos));
    cmb->setCurrentIndex(0);
}

static int widgetAMinutos(QSpinBox *spn, QComboBox *cmb)
{
    return spn->value() * kMultMinutos[cmb->currentIndex()];
}

// -----------------------------------------------------------------------------

MenuConfiguraciones::MenuConfiguraciones(
    const QString &rutaEnv,
    const QString &rutaCaddyfile,
    const QString &rutaPhpIni,
    const QString &rutaSanctum,
    const QString &rutaFilesystems,
    ConfigManager *config,
    QWidget *parent
)
    : QDialog(parent)
    , ui(new Ui::MenuConfiguraciones)
    , config(config)
    , rutaEnv(rutaEnv)
    , rutaCaddyfile(rutaCaddyfile)
    , rutaPhpIni(rutaPhpIni)
    , rutaSanctum(rutaSanctum)
    , rutaFilesystems(rutaFilesystems)
{
    ui->setupUi(this);

    // Crear checkboxes de extensiones desde el php.ini antes de cargar valores
    inicializarExtensiones();

    // Cargar todos los valores en la UI
    cargarValores();

    // Conectar señales DESPUÉS de cargar para no marcar phpIniCambiado en falso
    connect(ui->btnRecuperarBackup, &QPushButton::clicked,
            this, &MenuConfiguraciones::onRecuperarBackup);
    connect(ui->btnCrearBackup, &QPushButton::clicked,
            this, &MenuConfiguraciones::onCrearBackup);
    connect(ui->btnCambiarRutaBackups, &QPushButton::clicked,
            this, &MenuConfiguraciones::onCambiarRutaBackups);
    connect(ui->btnCambiarRutaStorageBackup, &QPushButton::clicked,
            this, &MenuConfiguraciones::onCambiarRutaStorageBackup);
    connect(ui->btnCrearStorageBackup, &QPushButton::clicked,
            this, &MenuConfiguraciones::onCrearStorageBackup);
    connect(ui->btnExplorarPrivada, &QPushButton::clicked,
            this, &MenuConfiguraciones::onExplorarRutaPrivada);
    connect(ui->btnExplorarPublica, &QPushButton::clicked,
            this, &MenuConfiguraciones::onExplorarRutaPublica);
    connect(ui->btnRestablecerPrivada, &QPushButton::clicked,
            this, &MenuConfiguraciones::onRestablecerRutaPrivada);
    connect(ui->btnRestablecerPublica, &QPushButton::clicked,
            this, &MenuConfiguraciones::onRestablecerRutaPublica);
    connect(ui->cmbExpiracionSanctum,
            QOverload<int>::of(&QComboBox::currentIndexChanged),
            this, &MenuConfiguraciones::onCambiarExpiracionSanctum);
    connect(ui->chkStorageBackupActivo, &QCheckBox::toggled,
            this, [this](bool checked) {
        ui->spnStorageBackupValor->setEnabled(checked);
        ui->cmbStorageBackupUnidad->setEnabled(checked);
        ui->edtRutaStorageBackup->setEnabled(checked);
        ui->btnCambiarRutaStorageBackup->setEnabled(checked);
    });

    // Tracking de cambios en tab PHP (después de cargar para no disparar en falso)
    for (QCheckBox *chk : std::as_const(extensionCheckboxes)) {
        connect(chk, &QCheckBox::toggled, this, [this](bool) { phpIniCambiado = true; });
    }
    connect(ui->spnMaxExecTime, QOverload<int>::of(&QSpinBox::valueChanged),
            this, [this](int) { phpIniCambiado = true; });
    connect(ui->edtMemoryLimit, &QLineEdit::textChanged,
            this, [this](const QString &) { phpIniCambiado = true; });
    connect(ui->edtPostMaxSize, &QLineEdit::textChanged,
            this, [this](const QString &) { phpIniCambiado = true; });
    connect(ui->edtUploadMaxSize, &QLineEdit::textChanged,
            this, [this](const QString &) { phpIniCambiado = true; });
}

MenuConfiguraciones::~MenuConfiguraciones()
{
    delete ui;
}

// -----------------------------------------------------------------------------

void MenuConfiguraciones::inicializarExtensiones()
{
    if (!phpIni.cargar(rutaPhpIni)) {
        ui->PhpSettings->setEnabled(false);
        return;
    }

    QVBoxLayout *layout = new QVBoxLayout(ui->widgetExtensiones);
    layout->setAlignment(Qt::AlignTop);
    layout->setSpacing(4);

    for (const auto &par : phpIni.extensiones()) {
        QCheckBox *chk = new QCheckBox(par.first, ui->widgetExtensiones);
        chk->setChecked(par.second);
        extensionCheckboxes[par.first] = chk;
        layout->addWidget(chk);
    }
}

void MenuConfiguraciones::cargarValores()
{
    // --- Tab Backup ----------------------------------------------------------
    segundosAWidget(config->intervaloBackupSegundos(),
                    ui->spnIntervaloBackupValor, ui->cmbIntervaloBackupUnidad);
    ui->spnRotacion->setValue(config->rotacionBackups());
    ui->edtRutaBackups->setText(config->rutaBackups());

    // Storage backup
    const bool sbActivo = config->storageBackupActivado();
    ui->chkStorageBackupActivo->setChecked(sbActivo);
    segundosAWidgetStorage(config->intervaloStorageBackupSegundos(),
                           ui->spnStorageBackupValor, ui->cmbStorageBackupUnidad);
    ui->edtRutaStorageBackup->setText(config->rutaStorageBackup());
    ui->spnStorageBackupValor->setEnabled(sbActivo);
    ui->cmbStorageBackupUnidad->setEnabled(sbActivo);
    ui->edtRutaStorageBackup->setEnabled(sbActivo);
    ui->btnCambiarRutaStorageBackup->setEnabled(sbActivo);

    // --- Tab Server ----------------------------------------------------------
    bool envOk = QFile::exists(rutaEnv);
    bool caddyOk = QFile::exists(rutaCaddyfile);

    if (!envOk || !caddyOk) {
        QString faltantes;
        if (!envOk) faltantes += "\n  • " + rutaEnv;
        if (!caddyOk) faltantes += "\n  • " + rutaCaddyfile;
        QMessageBox::warning(
            this, "Archivos no encontrados",
            "No se encontraron los siguientes archivos de configuración del servidor:" + faltantes +
            "\n\nEl tab Server estará deshabilitado."
        );
        ui->ServerSettings->setEnabled(false);
        return;
    }

    EnvParser env;
    if (env.cargar(rutaEnv)) {
        ui->edtDbHost->setText(env.valor("DB_HOST", "127.0.0.1"));
        ui->spnDbPuerto->setValue(env.valor("DB_PORT", "5432").toInt());
        ui->edtDbNombre->setText(env.valor("DB_DATABASE", "suitapi"));
        ui->edtDbUsuario->setText(env.valor("DB_USERNAME", "SuitApiBD"));
        ui->edtDbPassword->setText(env.valor("DB_PASSWORD"));
        ui->spnPuertoServidor->setValue(env.valor("APP_PORT", "8443").toInt());
        ui->spnFileCleanupDays->setValue(env.valor("FILE_CLEANUP_DAYS", "30").toInt());
    }

    CaddyfileParser caddy;
    if (caddy.cargar(rutaCaddyfile)) {
        ui->edtHostname->setText(caddy.host());
        ui->spnPuertoServidor->setValue(caddy.puerto());
        ui->chkTls->setChecked(caddy.tlsActivo());

        // Guardar valores originales para detectar si hay que reiniciar
        originalPuerto = caddy.puerto();
        originalHostname = caddy.host();
        originalTls = caddy.tlsActivo();
    }

    segundosAWidget(config->intervaloLimpiezaSegundos(),
                    ui->spnLimpiezaValor, ui->cmbLimpiezaUnidad);

    // Sanctum
    if (sanctumCfg.cargar(rutaSanctum)) {
        QString expStr = sanctumCfg.valor("expiration");
        if (expStr.isEmpty() || expStr == "null") {
            ui->cmbExpiracionSanctum->setCurrentIndex(0); // Indefinida
            ui->spnExpiracionSanctum->setEnabled(false);
            ui->cmbExpiracionUnidad->setEnabled(false);
        } else {
            ui->cmbExpiracionSanctum->setCurrentIndex(1); // Personalizada
            minutosAWidget(expStr.toInt(), ui->spnExpiracionSanctum, ui->cmbExpiracionUnidad);
            ui->spnExpiracionSanctum->setEnabled(true);
            ui->cmbExpiracionUnidad->setEnabled(true);
        }
    } else {
        ui->grpSanctum->setEnabled(false);
    }

    // Rutas de storage (filesystems.php)
    if (filesystemsCfg.cargar(rutaFilesystems)) {
        auto parseRuta = [](const QString &raw) -> QString {
            if (raw.isEmpty() || raw.startsWith("storage_path("))
                return {};
            if (raw.size() >= 2 &&
                ((raw.front() == '\'' && raw.back() == '\'') ||
                 (raw.front() == '"'  && raw.back() == '"')))
                return raw.mid(1, raw.size() - 2);
            return raw;
        };
        ui->edtRutaPrivada->setText(parseRuta(filesystemsCfg.valorDisco("local", "root")));
        ui->edtRutaPublica->setText(parseRuta(filesystemsCfg.valorDisco("public", "root")));
    } else {
        ui->grpRutasAlmacenamiento->setEnabled(false);
    }

    // --- Tab Aplicacion ------------------------------------------------------
    const QString modo = config->modoInicio();
    if (modo == "minimizado")
        ui->cmbModoInicio->setCurrentIndex(1);
    else if (modo == "maximizado")
        ui->cmbModoInicio->setCurrentIndex(2);
    else
        ui->cmbModoInicio->setCurrentIndex(0);
    ui->chkInicioConSistema->setChecked(config->inicioConSistema());

    // --- Tab PHP (límites de recursos, si se cargó el ini) -------------------
    if (ui->PhpSettings->isEnabled()) {
        ui->spnMaxExecTime->setValue(phpIni.valor("max_execution_time", "30").toInt());
        ui->edtMemoryLimit->setText(phpIni.valor("memory_limit", "128M"));
        ui->edtPostMaxSize->setText(phpIni.valor("post_max_size", "8M"));
        ui->edtUploadMaxSize->setText(phpIni.valor("upload_max_filesize", "100M"));
    }
}

void MenuConfiguraciones::guardarCambios()
{
    // --- Tab Backup ----------------------------------------------------------
    config->setIntervaloBackupSegundos(
        widgetASegundos(ui->spnIntervaloBackupValor, ui->cmbIntervaloBackupUnidad)
    );
    config->setRotacionBackups(ui->spnRotacion->value());
    config->setRutaBackups(ui->edtRutaBackups->text());

    // Storage backup
    const bool sbActivo = ui->chkStorageBackupActivo->isChecked();
    config->setStorageBackupActivado(sbActivo);
    config->setIntervaloStorageBackupSegundos(
        widgetASegundosStorage(ui->spnStorageBackupValor, ui->cmbStorageBackupUnidad)
    );
    config->setRutaStorageBackup(ui->edtRutaStorageBackup->text());

    // --- Tab Server ----------------------------------------------------------
    if (ui->ServerSettings->isEnabled()) {
        EnvParser env;
        if (env.cargar(rutaEnv)) {
            env.setValor("DB_HOST", ui->edtDbHost->text());
            env.setValor("DB_PORT", QString::number(ui->spnDbPuerto->value()));
            env.setValor("DB_DATABASE", ui->edtDbNombre->text());
            env.setValor("DB_USERNAME", ui->edtDbUsuario->text());
            env.setValor("DB_PASSWORD", ui->edtDbPassword->text());
            env.setValor("APP_PORT", QString::number(ui->spnPuertoServidor->value()));
            env.setValor("FILE_CLEANUP_DAYS", QString::number(ui->spnFileCleanupDays->value()));
            env.guardar(rutaEnv);
        }

        CaddyfileParser caddy;
        if (caddy.cargar(rutaCaddyfile)) {
            caddy.setHost(ui->edtHostname->text());
            caddy.setPuerto(ui->spnPuertoServidor->value());
            caddy.setTlsActivo(ui->chkTls->isChecked());
            caddy.guardar(rutaCaddyfile);
        }

        config->setIntervaloLimpiezaSegundos(
            widgetASegundos(ui->spnLimpiezaValor, ui->cmbLimpiezaUnidad)
        );

        // Sanctum
        if (ui->grpSanctum->isEnabled()) {
            if (ui->cmbExpiracionSanctum->currentIndex() == 0)
                sanctumCfg.setValor("expiration", "null");
            else
                sanctumCfg.setValor("expiration",
                    QString::number(widgetAMinutos(ui->spnExpiracionSanctum, ui->cmbExpiracionUnidad)));
            sanctumCfg.guardar(rutaSanctum);
        }

        // Rutas de almacenamiento
        if (ui->grpRutasAlmacenamiento->isEnabled()) {
            auto buildPhpRuta = [](const QString &ruta, const QString &defPhp) -> QString {
                return ruta.isEmpty() ? defPhp : "'" + ruta + "'";
            };
            filesystemsCfg.setValorDisco("local", "root",
                buildPhpRuta(ui->edtRutaPrivada->text(), "storage_path('app/private')"));
            filesystemsCfg.setValorDisco("public", "root",
                buildPhpRuta(ui->edtRutaPublica->text(), "storage_path('app/public')"));
            filesystemsCfg.guardar(rutaFilesystems);
        }
    }

    // --- Tab PHP -------------------------------------------------------------
    if (ui->PhpSettings->isEnabled()) {
        for (auto it = extensionCheckboxes.constBegin(); it != extensionCheckboxes.constEnd(); ++it)
            phpIni.setExtensionActiva(it.key(), it.value()->isChecked());
        phpIni.setValor("max_execution_time", QString::number(ui->spnMaxExecTime->value()));
        phpIni.setValor("memory_limit", ui->edtMemoryLimit->text());
        phpIni.setValor("post_max_size", ui->edtPostMaxSize->text());
        phpIni.setValor("upload_max_filesize", ui->edtUploadMaxSize->text());
        phpIni.guardar(rutaPhpIni);
    }

    // --- Tab Aplicacion ------------------------------------------------------
    static const QString kModos[] = {"normal", "minimizado", "maximizado"};
    config->setModoInicio(kModos[ui->cmbModoInicio->currentIndex()]);

    const bool inicioSistema = ui->chkInicioConSistema->isChecked();
    config->setInicioConSistema(inicioSistema);
#ifdef Q_OS_WIN
    QSettings reg("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                  QSettings::NativeFormat);
    if (inicioSistema)
        reg.setValue("SuitApiLauncher", QCoreApplication::applicationFilePath().replace('/', '\\'));
    else
        reg.remove("SuitApiLauncher");
#elif defined(Q_OS_LINUX)
    const QString desktopPath = QStandardPaths::writableLocation(QStandardPaths::HomeLocation)
                                + "/.config/autostart/SuitApiLauncher.desktop";
    if (inicioSistema) {
        QFile f(desktopPath);
        if (f.open(QIODevice::WriteOnly | QIODevice::Text)) {
            QTextStream out(&f);
            out << "[Desktop Entry]\n"
                << "Type=Application\n"
                << "Name=SuitApiLauncher\n"
                << "Exec=" << QCoreApplication::applicationFilePath() << "\n"
                << "Hidden=false\n"
                << "X-GNOME-Autostart-enabled=true\n";
        }
    } else {
        QFile::remove(desktopPath);
    }
#endif

    config->guardar();
}

bool MenuConfiguraciones::servidorRequiereReinicio() const
{
    if (!ui->ServerSettings->isEnabled() || originalPuerto == -1)
        return false;
    return ui->spnPuertoServidor->value() != originalPuerto
        || ui->edtHostname->text() != originalHostname
        || ui->chkTls->isChecked() != originalTls;
}

void MenuConfiguraciones::accept()
{
    const bool requiereReinicio = phpIniCambiado || servidorRequiereReinicio();

    if (requiereReinicio) {
        const int r = QMessageBox::question(
            this,
            "Reinicio requerido",
            "Los cambios en PHP o en la configuración del servidor requieren reiniciar "
            "FrankenPHP para aplicarse.\n\n¿Guardar cambios y reiniciar ahora?",
            QMessageBox::Yes | QMessageBox::Cancel
        );
        if (r != QMessageBox::Yes)
            return; // volver al diálogo sin guardar
        guardarCambios();
        emit reinicioRequerido();
    } else {
        guardarCambios();
    }
    QDialog::accept();
}

// --- Slots -------------------------------------------------------------------

void MenuConfiguraciones::onCrearBackup()
{
    emit backupSolicitado();
    QDialog::accept();
}

void MenuConfiguraciones::onRecuperarBackup()
{
    DialogRecuperacion dlg(config->rutaBackups(), this);
    if (dlg.exec() == QDialog::Accepted) {
        guardarCambios();
        emit restaurarSolicitado(dlg.archivoSeleccionado());
        QDialog::accept();
    }
}

void MenuConfiguraciones::onCambiarRutaBackups()
{
    QString dir = QFileDialog::getExistingDirectory(
        this, "Elegir carpeta de backups de BD", ui->edtRutaBackups->text());
    if (!dir.isEmpty())
        ui->edtRutaBackups->setText(dir);
}

void MenuConfiguraciones::onCambiarRutaStorageBackup()
{
    QString dir = QFileDialog::getExistingDirectory(
        this, "Elegir carpeta de destino para backups de storage",
        ui->edtRutaStorageBackup->text());
    if (!dir.isEmpty())
        ui->edtRutaStorageBackup->setText(dir);
}

void MenuConfiguraciones::onCrearStorageBackup()
{
    QString ruta = ui->edtRutaStorageBackup->text();
    if (ruta.isEmpty()) {
        ruta = QFileDialog::getExistingDirectory(
            this, "Elegir destino para el backup de storage");
        if (ruta.isEmpty()) return;
    }
    emit storageBackupSolicitado(ruta);
    QDialog::accept();
}

void MenuConfiguraciones::onExplorarRutaPrivada()
{
    QString dir = QFileDialog::getExistingDirectory(
        this, "Elegir ruta del disco privado", ui->edtRutaPrivada->text());
    if (!dir.isEmpty())
        ui->edtRutaPrivada->setText(dir);
}

void MenuConfiguraciones::onExplorarRutaPublica()
{
    QString dir = QFileDialog::getExistingDirectory(
        this, "Elegir ruta del disco público", ui->edtRutaPublica->text());
    if (!dir.isEmpty())
        ui->edtRutaPublica->setText(dir);
}

void MenuConfiguraciones::onRestablecerRutaPrivada()
{
    ui->edtRutaPrivada->clear();
}

void MenuConfiguraciones::onRestablecerRutaPublica()
{
    ui->edtRutaPublica->clear();
}

void MenuConfiguraciones::onCambiarExpiracionSanctum(int index)
{
    const bool personalizada = (index == 1);
    ui->spnExpiracionSanctum->setEnabled(personalizada);
    ui->cmbExpiracionUnidad->setEnabled(personalizada);
}
