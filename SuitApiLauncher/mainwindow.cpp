#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "dialogfunciones.h"
#include "menuconfiguraciones.h"
#include "envparser.h"
#include <QApplication>
#include <QCloseEvent>
#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QIcon>
#include <QMessageBox>
#include <QProcessEnvironment>
#include <QStandardPaths>
#include <QStyle>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    this->setWindowTitle("SuitAPI Consola");

    basePath = QCoreApplication::applicationDirPath();
    QString laravelPath = basePath + "/frankenphp/SuitAPI";

    // Crear directorios de datos en AppDataLocation
    logDirPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/logs";
    QDir().mkpath(logDirPath);
    QDir().mkpath(QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/SuitAPI");

    // Inicializar configuración
    QString configPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation)
                         + "/SuitAPI/config.ini";
    config = new ConfigManager(configPath);

    QIcon appIcon(":/icons/SuitLogo.ico");
    if (appIcon.isNull())
        appIcon = QIcon(":/icons/SuitLogo.png");
    if (!appIcon.isNull()) {
        setWindowIcon(appIcon);
        QApplication::setWindowIcon(appIcon);
    }

    postgresProcess = new QProcess(this);
    apiProcess = new QProcess(this);
    discoveryProcess = new QProcess(this);
    migrationProcess = new QProcess(this);
    cleanupProcess = new QProcess(this);
    backupProcess = new QProcess(this);
    storageBackupProcess = new QProcess(this);

    postgresProcess->setWorkingDirectory(basePath);
    apiProcess->setWorkingDirectory(laravelPath);
    discoveryProcess->setWorkingDirectory(laravelPath);
    migrationProcess->setWorkingDirectory(laravelPath);
    cleanupProcess->setWorkingDirectory(laravelPath);
    backupProcess->setWorkingDirectory(basePath);

    // Fusionar stderr con stdout para PostgreSQL
    postgresProcess->setProcessChannelMode(QProcess::MergedChannels);

    // 1. Conexion de botones
    connect(ui->stop, &QPushButton::clicked, this, &MainWindow::pararServidor);
    connect(ui->restart, &QPushButton::clicked, this, &MainWindow::reiniciarServidor);
    connect(ui->close, &QPushButton::clicked, this, &MainWindow::cerrarServidor);
    connect(ui->start, &QPushButton::clicked, this, &MainWindow::arrancarServidor);
    connect(ui->actionBotonesDev, &QAction::triggered, this, [this]() {
        DialogFunciones dialog(this);
        connect(&dialog, &DialogFunciones::correrMigracionesSolicitado, this, &MainWindow::correrMigraciones);
        connect(&dialog, &DialogFunciones::iniciarUdpSolicitado, this, &MainWindow::iniciarServidorUdp);
        connect(&dialog, &DialogFunciones::apagarUdpSolicitado, this, &MainWindow::apagarServidorUdp);
        connect(&dialog, &DialogFunciones::reiniciarApiSolicitado, this, &MainWindow::reiniciarApi);
        connect(&dialog, &DialogFunciones::reiniciarBdSolicitado, this, &MainWindow::reiniciarBaseDeDatos);
        connect(&dialog, &DialogFunciones::limpiarDatosSolicitado, this, &MainWindow::limpiarDatosViejos);
        dialog.exec();
    });

    // 2. Salida de texto de los procesos a la consola visual
    connect(postgresProcess, &QProcess::readyReadStandardOutput, this, &MainWindow::leerLogsPostgres);

    connect(apiProcess, &QProcess::readyReadStandardOutput, this, &MainWindow::leerLogsApi);
    connect(apiProcess, &QProcess::readyReadStandardError, this, &MainWindow::leerLogsApi);

    connect(discoveryProcess, &QProcess::readyReadStandardOutput, this, &MainWindow::leerLogsDiscovery);
    connect(discoveryProcess, &QProcess::readyReadStandardError, this, &MainWindow::leerLogsDiscovery);
    connect(migrationProcess, &QProcess::readyReadStandardOutput, this, &MainWindow::leerLogsMigraciones);
    connect(migrationProcess, &QProcess::readyReadStandardError, this, &MainWindow::leerLogsMigraciones);
    connect(migrationProcess, &QProcess::finished, this, &MainWindow::migracionesFinalizadas);
    connect(migrationProcess, &QProcess::errorOccurred, this, &MainWindow::errorMigraciones);

    connect(cleanupProcess, &QProcess::readyReadStandardOutput, this, &MainWindow::leerLogsLimpieza);
    connect(cleanupProcess, &QProcess::readyReadStandardError, this, &MainWindow::leerLogsLimpieza);
    connect(cleanupProcess, &QProcess::finished, this, &MainWindow::limpiezaFinalizada);

    connect(backupProcess, &QProcess::readyReadStandardOutput, this, &MainWindow::leerLogsBackup);
    connect(backupProcess, &QProcess::readyReadStandardError, this, &MainWindow::leerLogsBackup);
    connect(backupProcess, &QProcess::finished, this, &MainWindow::backupFinalizado);

    connect(storageBackupProcess, &QProcess::finished,
            this, &MainWindow::storageBackupFinalizado);
    connect(&storageBackupTimer, &QTimer::timeout,
            this, &MainWindow::ejecutarStorageBackupProgramado);

    // pg_ctl start -w termina cuando PG está listo (exit 0) o falla (exit != 0)
    connect(postgresProcess, &QProcess::finished, this, [this](int exitCode, QProcess::ExitStatus exitStatus) {
        if (exitStatus == QProcess::CrashExit) {
            ui->console->appendPlainText("[DB ERR] pg_ctl crasheó inesperadamente.");
            return;
        }

        if (exitCode != 0) {
            ui->console->appendPlainText(
                QString("[DB ERR] pg_ctl finalizó con código %1. "
                        "Revisá el log en: %2/postgres.log")
                    .arg(exitCode)
                    .arg(logDirPath));
            return;
        }

        ui->console->appendPlainText("[DB] PostgreSQL iniciado correctamente.");

        if (!apiIniciada) {
            apiIniciada = true;
            arrancarAPIs();
        }
    });

    connect(apiProcess, &QProcess::finished, this, [this](int exitCode, QProcess::ExitStatus exitStatus) {
        ui->console->appendPlainText(QString("[API] Finalizó. exitCode=%1 status=%2")
                                         .arg(exitCode)
                                         .arg(exitStatus == QProcess::NormalExit ? "Normal" : "Crash"));
    });

    connect(discoveryProcess, &QProcess::finished, this, [this](int exitCode, QProcess::ExitStatus exitStatus) {
        ui->console->appendPlainText(QString("[UDP] Finalizó. exitCode=%1 status=%2")
                                         .arg(exitCode)
                                         .arg(exitStatus == QProcess::NormalExit ? "Normal" : "Crash"));
    });

    connect(apiProcess, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
        ui->console->appendPlainText(QString("[API ERR] %1").arg(procesoErrorATexto(error)));
    });

    connect(discoveryProcess, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
        ui->console->appendPlainText(QString("[UDP ERR] %1").arg(procesoErrorATexto(error)));
    });

    connect(postgresProcess, &QProcess::errorOccurred, this, [this](QProcess::ProcessError error) {
        ui->console->appendPlainText(QString("[DB ERR] %1").arg(procesoErrorATexto(error)));
    });

    // Configuración
    connect(ui->actionConfiguracion, &QAction::triggered, this, [this]() {
        const QString rutaEnv       = basePath + "/frankenphp/SuitAPI/.env";
        const QString rutaCaddyfile = basePath + "/frankenphp/SuitAPI/Caddyfile";

        int oldBackupSecs        = config->intervaloBackupSegundos();
        int oldLimpiezaSecs      = config->intervaloLimpiezaSegundos();
        int oldStorageBackupSecs = config->intervaloStorageBackupSegundos();

        MenuConfiguraciones dialog(
            rutaEnv, rutaCaddyfile,
            rutaPhpIni(), rutaSanctum(), rutaFilesystems(),
            config, this
        );
        connect(&dialog, &MenuConfiguraciones::restaurarSolicitado,
                this, &MainWindow::restaurarBackup);
        connect(&dialog, &MenuConfiguraciones::backupSolicitado,
                this, &MainWindow::ejecutarBackupReal);
        connect(&dialog, &MenuConfiguraciones::storageBackupSolicitado,
                this, &MainWindow::ejecutarStorageBackup);
        connect(&dialog, &MenuConfiguraciones::reinicioRequerido,
                this, &MainWindow::reiniciarApi);

        if (dialog.exec() == QDialog::Accepted) {
            actualizarTimers(oldBackupSecs, oldLimpiezaSecs);
            actualizarTimerStorageBackup(oldStorageBackupSecs);
        }
    });

    configurarSystemTray();
    configurarTimers();
    this->arrancarServidor();
}

MainWindow::~MainWindow()
{
    persistirTiemposRestantes();
    pararServidor();
    delete ui;
}

// --- Timers ------------------------------------------------------------------

void MainWindow::configurarTimers()
{
    connect(&backupTime, &QTimer::timeout, this, &MainWindow::ejecutarBackup);
    connect(&cleanUpTime, &QTimer::timeout, this, &MainWindow::ejecutarLimpieza);
    connect(&persistenciaTimer, &QTimer::timeout, this, &MainWindow::persistirTiemposRestantes);

    int backupIntervalMs = config->intervaloBackupSegundos() * 1000;
    int backupRestanteMs = config->tiempoRestanteBackupMs();

    if (backupRestanteMs > 0 && backupRestanteMs < backupIntervalMs) {
        backupTime.setInterval(backupRestanteMs);
    } else {
        backupTime.setInterval(backupIntervalMs);
    }
    backupTime.start();

    int limpiezaIntervalMs = config->intervaloLimpiezaSegundos() * 1000;
    int limpiezaRestanteMs = config->tiempoRestanteLimpiezaMs();

    if (limpiezaRestanteMs > 0 && limpiezaRestanteMs < limpiezaIntervalMs) {
        cleanUpTime.setInterval(limpiezaRestanteMs);
    } else {
        cleanUpTime.setInterval(limpiezaIntervalMs);
    }
    cleanUpTime.start();

    persistenciaTimer.setInterval(600000); // 10 minutos
    persistenciaTimer.start();

    configurarStorageBackupTimer();
}

void MainWindow::actualizarTimers(int oldBackupSecs, int oldLimpiezaSecs)
{
    int nuevoBackupSecs = config->intervaloBackupSegundos();
    int nuevoLimpiezaSecs = config->intervaloLimpiezaSegundos();

    if (nuevoBackupSecs != oldBackupSecs) {
        auto resp = QMessageBox::question(
            this, "Resetear timer de backups",
            "El intervalo de backups cambió. ¿Querés reiniciar el período de backup ahora?"
        );
        if (resp == QMessageBox::Yes) {
            backupTime.setInterval(nuevoBackupSecs * 1000);
            backupTime.start();
        }
    }

    if (nuevoLimpiezaSecs != oldLimpiezaSecs) {
        auto resp = QMessageBox::question(
            this, "Resetear timer de limpieza",
            "El intervalo de limpieza cambió. ¿Querés reiniciar el período de limpieza ahora?"
        );
        if (resp == QMessageBox::Yes) {
            cleanUpTime.setInterval(nuevoLimpiezaSecs * 1000);
            cleanUpTime.start();
        }
    }
}

void MainWindow::persistirTiemposRestantes()
{
    if (!config) return;
    config->setTiempoRestanteBackupMs(backupTime.remainingTime());
    config->setTiempoRestanteLimpiezaMs(cleanUpTime.remainingTime());
    config->setTiempoRestanteStorageBackupMs(
        storageBackupTimer.isActive() ? storageBackupTimer.remainingTime() : 0
    );
    config->guardar();
}

void MainWindow::configurarStorageBackupTimer()
{
    if (!config->storageBackupActivado())
        return;

    const int intervalMs  = config->intervaloStorageBackupSegundos() * 1000;
    const int restanteMs  = config->tiempoRestanteStorageBackupMs();

    storageBackupTimer.setInterval(
        (restanteMs > 0 && restanteMs < intervalMs) ? restanteMs : intervalMs
    );
    storageBackupTimer.start();
}

void MainWindow::actualizarTimerStorageBackup(int oldSecs)
{
    const bool activado = config->storageBackupActivado();

    if (!activado) {
        storageBackupTimer.stop();
        return;
    }

    const int newSecs = config->intervaloStorageBackupSegundos();
    if (newSecs != oldSecs) {
        const auto resp = QMessageBox::question(
            this, "Resetear timer de storage backup",
            "El intervalo de backup de storage cambió. ¿Querés reiniciar el período ahora?"
        );
        if (resp == QMessageBox::Yes) {
            storageBackupTimer.setInterval(newSecs * 1000);
            storageBackupTimer.start();
        }
    } else if (!storageBackupTimer.isActive()) {
        // Se activó por primera vez (la señal ya está conectada desde el constructor)
        storageBackupTimer.setInterval(newSecs * 1000);
        storageBackupTimer.start();
    }
}

// --- Backup ------------------------------------------------------------------

void MainWindow::ejecutarBackup()
{
    // Si el timer estaba en modo recuperación (intervalo distinto al configurado),
    // reiniciarlo con el intervalo real para los disparos siguientes.
    int intervaloConfigMs = config->intervaloBackupSegundos() * 1000;
    if (backupTime.interval() != intervaloConfigMs) {
        backupTime.setInterval(intervaloConfigMs);
        backupTime.start();
    }
    ejecutarBackupReal();
}

void MainWindow::ejecutarBackupReal()
{
    if (backupProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[BACKUP] Ya hay un backup en curso.");
        return;
    }

    if (!QFile::exists(rutaPgDump())) {
        ui->console->appendPlainText("[BACKUP ERR] No se encontró pg_dump en: " + rutaPgDump());
        return;
    }

    // Crear directorio de backups
    QString backupDir = rutaBackups();
    QDir().mkpath(backupDir);

    // Rotación: borrar el más antiguo si se alcanzó el límite
    QDir dir(backupDir);
    QFileInfoList archivos = dir.entryInfoList(
        QStringList() << "*.dump", QDir::Files, QDir::Time | QDir::Reversed
    );
    while (archivos.size() >= config->rotacionBackups()) {
        QFile::remove(archivos.first().absoluteFilePath());
        archivos.removeFirst();
    }

    // Nombre del archivo
    QString timestamp = QDateTime::currentDateTime().toString("yyyyMMdd_HHmmss");
    backupArchivoActual = backupDir + "/backup_" + timestamp + ".dump";

    // Leer credenciales del .env
    QString pgUser = "SuitApiBD";
    QString pgPassword = "SuitApiBd4438";
    QString pgDatabase = "suitapi";
    QString pgPort = "5432";
    QString pgHost = "127.0.0.1";

    EnvParser env;
    if (env.cargar(basePath + "/frankenphp/SuitAPI/.env")) {
        pgUser = env.valor("DB_USERNAME", pgUser);
        pgPassword = env.valor("DB_PASSWORD", pgPassword);
        pgDatabase = env.valor("DB_DATABASE", pgDatabase);
        pgPort = env.valor("DB_PORT", pgPort);
        pgHost = env.valor("DB_HOST", pgHost);
    }

    QProcessEnvironment procEnv = QProcessEnvironment::systemEnvironment();
    procEnv.insert("PGPASSWORD", pgPassword);
    backupProcess->setProcessEnvironment(procEnv);

    QStringList args;
    args << "--format=custom"
         << "--file=" + backupArchivoActual
         << "-U" << pgUser
         << "-p" << pgPort
         << "-h" << pgHost
         << pgDatabase;

    ui->console->appendPlainText("[BACKUP] Iniciando backup de la base de datos...");
    backupProcess->start(rutaPgDump(), args);
}

void MainWindow::backupFinalizado(int exitCode, QProcess::ExitStatus)
{
    if (exitCode == 0) {
        ui->console->appendPlainText("[BACKUP] Backup completado: " + backupArchivoActual);
    } else {
        QString err = QString::fromLocal8Bit(backupProcess->readAllStandardError()).trimmed();
        ui->console->appendPlainText(
            QString("[BACKUP ERR] pg_dump falló (código %1): %2").arg(exitCode).arg(err)
        );
    }
}

void MainWindow::leerLogsBackup()
{
    QByteArray out = backupProcess->readAllStandardOutput();
    QByteArray err = backupProcess->readAllStandardError();
    if (!out.isEmpty()) ui->console->appendPlainText("[BACKUP] " + QString::fromLocal8Bit(out).trimmed());
    if (!err.isEmpty()) ui->console->appendPlainText("[BACKUP ERR] " + QString::fromLocal8Bit(err).trimmed());
}

void MainWindow::restaurarBackup(const QString &rutaArchivo)
{
    if (rutaArchivo.isEmpty() || !QFile::exists(rutaArchivo))
        return;

    if (!QFile::exists(rutaPgRestore())) {
        ui->console->appendPlainText("[RESTORE ERR] No se encontró pg_restore en: " + rutaPgRestore());
        return;
    }

    ui->console->appendPlainText("--- INICIANDO RESTAURACIÓN DE BACKUP ---");

    // Detener servicios que consumen conexiones a la BD
    detenerProceso(discoveryProcess, "UDP", 3000, 2000);
    detenerProceso(apiProcess, "API", 10000, 2000);

    // Leer credenciales del .env
    QString pgUser = "SuitApiBD";
    QString pgPassword = "SuitApiBd4438";
    QString pgDatabase = "suitapi";
    QString pgPort = "5432";
    QString pgHost = "127.0.0.1";

    EnvParser env;
    if (env.cargar(basePath + "/frankenphp/SuitAPI/.env")) {
        pgUser = env.valor("DB_USERNAME", pgUser);
        pgPassword = env.valor("DB_PASSWORD", pgPassword);
        pgDatabase = env.valor("DB_DATABASE", pgDatabase);
        pgPort = env.valor("DB_PORT", pgPort);
        pgHost = env.valor("DB_HOST", pgHost);
    }

    QProcess restoreProcess;
    QProcessEnvironment procEnv = QProcessEnvironment::systemEnvironment();
    procEnv.insert("PGPASSWORD", pgPassword);
    restoreProcess.setProcessEnvironment(procEnv);

    QStringList args;
    args << "--clean" << "--if-exists"
         << "--dbname=" + pgDatabase
         << "-U" << pgUser
         << "-p" << pgPort
         << "-h" << pgHost
         << rutaArchivo;

    ui->console->appendPlainText("[RESTORE] Restaurando desde: " + rutaArchivo);
    restoreProcess.start(rutaPgRestore(), args);

    if (!restoreProcess.waitForFinished(120000)) {
        ui->console->appendPlainText("[RESTORE ERR] pg_restore no respondió a tiempo.");
        restoreProcess.kill();
    } else if (restoreProcess.exitCode() == 0) {
        ui->console->appendPlainText("[RESTORE] Restauración completada correctamente.");
    } else {
        QString err = QString::fromLocal8Bit(restoreProcess.readAllStandardError()).trimmed();
        ui->console->appendPlainText("[RESTORE ERR] pg_restore falló: " + err);
    }

    // Reiniciar servicios
    arrancarApiIndependiente();
    arrancarDiscoveryIndependiente();

    ui->console->appendPlainText("--- RESTAURACIÓN FINALIZADA ---");
}

// --- Limpieza ----------------------------------------------------------------

void MainWindow::ejecutarLimpieza()
{
    int intervaloConfigMs = config->intervaloLimpiezaSegundos() * 1000;
    if (cleanUpTime.interval() != intervaloConfigMs) {
        cleanUpTime.setInterval(intervaloConfigMs);
        cleanUpTime.start();
    }
    limpiarDatosViejos();
}

void MainWindow::limpiarDatosViejos()
{
    if (cleanupProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[LIMPIEZA] Ya hay una limpieza en curso.");
        return;
    }

    ui->console->appendPlainText("[LIMPIEZA] Iniciando limpieza de archivos viejos...");
    cleanupProcess->start(
        rutaFrankenPhp(),
        QStringList() << "php-cli" << "artisan" << "app:cleanup-deleted-files"
    );
}

void MainWindow::leerLogsLimpieza()
{
    QByteArray out = cleanupProcess->readAllStandardOutput();
    QByteArray err = cleanupProcess->readAllStandardError();
    if (!out.isEmpty()) ui->console->appendPlainText("[LIMPIEZA] " + QString::fromLocal8Bit(out).trimmed());
    if (!err.isEmpty()) ui->console->appendPlainText("[LIMPIEZA ERR] " + QString::fromLocal8Bit(err).trimmed());
}

void MainWindow::limpiezaFinalizada(int exitCode, QProcess::ExitStatus exitStatus)
{
    ui->console->appendPlainText(
        QString("[LIMPIEZA] Finalizada. exitCode=%1 status=%2")
            .arg(exitCode)
            .arg(exitStatus == QProcess::NormalExit ? "Normal" : "Crash")
    );
}

// --- Arranque/parada ---------------------------------------------------------

void MainWindow::arrancarServidor()
{
    if (!QFile::exists(rutaPgCtl())) {
        ui->console->appendPlainText("[DB ERR] No se encontró pg_ctl.exe en: " + rutaPgCtl());
        return;
    }

    if (!QDir(rutaPgData()).exists()) {
        ui->console->appendPlainText("[DB ERR] No se encontró el directorio de datos: " + rutaPgData());
        return;
    }

    if (postgresProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[DB] pg_ctl ya está en ejecución.");
        return;
    }

    ui->console->appendPlainText("--- INICIANDO BASE DE DATOS ---");

    apiIniciada = false;

    postgresProcess->start(
        rutaPgCtl(),
        QStringList() << "start" << "-w"
                      << "-D" << rutaPgData()
                      << "-l" << rutaPgLog()
    );
}

void MainWindow::pararServidor()
{
    ui->console->appendPlainText("--- DETENIENDO SERVIDORES ---");

    if (discoveryProcess && discoveryProcess->state() == QProcess::Running) {
        ui->console->appendPlainText("[UDP] Deteniendo proceso discovery...");
        discoveryProcess->terminate();
        if (!discoveryProcess->waitForFinished(2000)) {
            ui->console->appendPlainText("[UDP] Cierre forzado.");
            discoveryProcess->kill();
            discoveryProcess->waitForFinished(2000);
        }
    }

    if (apiProcess && apiProcess->state() == QProcess::Running) {
        ui->console->appendPlainText("[API] Deteniendo servidor HTTP...");
        apiProcess->terminate();
        if (!apiProcess->waitForFinished(3000)) {
            ui->console->appendPlainText("[API] Cierre forzado.");
            apiProcess->kill();
            apiProcess->waitForFinished(2000);
        }
    }

    detenerPostgres();

    ui->console->appendPlainText("--- SERVIDORES DETENIDOS ---");
}

void MainWindow::reiniciarServidor()
{
    ui->console->appendPlainText("--- REINICIANDO... ---");
    pararServidor();
    arrancarServidor();
}

void MainWindow::cerrarServidor()
{
    persistirTiemposRestantes();
    pararServidor();
    permitirCierreReal = true;
    QCoreApplication::quit();
}

void MainWindow::leerLogsPostgres()
{
    QByteArray output = postgresProcess->readAllStandardOutput();
    QString outputStr = QString::fromLocal8Bit(output).trimmed();

    if (!outputStr.isEmpty())
        ui->console->appendPlainText("[DB] " + outputStr);
}

void MainWindow::arrancarAPIs()
{
    if (!QFile::exists(rutaFrankenPhp())) {
        ui->console->appendPlainText("[API ERR] No se encontró frankenphp.exe en: " + rutaFrankenPhp());
        return;
    }

    ui->console->appendPlainText("--- BASE DE DATOS LISTA. INICIANDO APIs ---");

    apiProcess->start(rutaFrankenPhp(), QStringList() << "run");
    discoveryProcess->start(rutaFrankenPhp(), QStringList() << "php-cli" << "artisan" << "suitapi:discovery");
}

void MainWindow::leerLogsApi()
{
    QByteArray logs = apiProcess->readAllStandardOutput();
    QByteArray errores = apiProcess->readAllStandardError();

    if (!logs.isEmpty()) ui->console->appendPlainText("[API] " + QString::fromLocal8Bit(logs).trimmed());
    if (!errores.isEmpty()) ui->console->appendPlainText("[API ERR] " + QString::fromLocal8Bit(errores).trimmed());
}

void MainWindow::leerLogsDiscovery()
{
    QByteArray logs = discoveryProcess->readAllStandardOutput();
    QByteArray errores = discoveryProcess->readAllStandardError();

    if (!logs.isEmpty()) ui->console->appendPlainText("[UDP] " + QString::fromLocal8Bit(logs).trimmed());
    if (!errores.isEmpty()) ui->console->appendPlainText("[UDP ERR] " + QString::fromLocal8Bit(errores).trimmed());
}

void MainWindow::correrMigraciones()
{
    if (migrationProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[MIGRATIONS] Ya hay una migracion en ejecucion.");
        return;
    }

    ui->console->appendPlainText("--- CORRIENDO MIGRACIONES ---");
    migrationProcess->start(rutaFrankenPhp(), QStringList() << "php-cli" << "artisan" << "migrate" << "--force");
}

void MainWindow::iniciarServidorUdp()
{
    if (discoveryProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[UDP] El servidor discovery ya esta corriendo.");
        return;
    }

    arrancarDiscoveryIndependiente();
}

void MainWindow::apagarServidorUdp()
{
    if (!detenerProceso(discoveryProcess, "UDP", 3000, 2000))
        ui->console->appendPlainText("[UDP] El servidor discovery no esta corriendo.");
}

void MainWindow::reiniciarApi()
{
    ui->console->appendPlainText("--- REINICIANDO API ---");

    if (postgresProcess->state() == QProcess::NotRunning)
        ui->console->appendPlainText("[API] Advertencia: PostgreSQL no parece estar corriendo.");

    detenerProceso(apiProcess, "API", 10000, 2000);
    arrancarApiIndependiente();
}

void MainWindow::reiniciarBaseDeDatos()
{
    ui->console->appendPlainText("--- REINICIANDO BASE DE DATOS ---");
    detenerPostgres();
    arrancarBaseDeDatosIndependiente(false);
}

void MainWindow::leerLogsMigraciones()
{
    QByteArray logs = migrationProcess->readAllStandardOutput();
    QByteArray errores = migrationProcess->readAllStandardError();

    if (!logs.isEmpty()) ui->console->appendPlainText("[MIGRATIONS] " + QString::fromLocal8Bit(logs).trimmed());
    if (!errores.isEmpty()) ui->console->appendPlainText("[MIGRATIONS ERR] " + QString::fromLocal8Bit(errores).trimmed());
}

void MainWindow::migracionesFinalizadas(int exitCode, QProcess::ExitStatus exitStatus)
{
    ui->console->appendPlainText(QString("[MIGRATIONS] Finalizaron. exitCode=%1 status=%2")
                                     .arg(exitCode)
                                     .arg(exitStatus == QProcess::NormalExit ? "Normal" : "Crash"));
}

void MainWindow::errorMigraciones(QProcess::ProcessError error)
{
    ui->console->appendPlainText(QString("[MIGRATIONS ERR] %1").arg(procesoErrorATexto(error)));
}

bool MainWindow::detenerProceso(QProcess *process, const QString &prefix, int terminateWaitMs, int killWaitMs)
{
    if (!process || process->state() == QProcess::NotRunning)
        return false;

    ui->console->appendPlainText(QString("[%1] Deteniendo proceso...").arg(prefix));
    process->terminate();

    if (!process->waitForFinished(terminateWaitMs)) {
        ui->console->appendPlainText(QString("[%1] No cerro a tiempo, forzando cierre...").arg(prefix));
        process->kill();
        process->waitForFinished(killWaitMs);
    }

    return true;
}

void MainWindow::arrancarApiIndependiente()
{
    if (apiProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[API] La API ya esta corriendo.");
        return;
    }

    ui->console->appendPlainText("[API] Iniciando servidor HTTP...");
    apiProcess->start(rutaFrankenPhp(), QStringList() << "run");
}

void MainWindow::arrancarDiscoveryIndependiente()
{
    if (discoveryProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[UDP] El servidor discovery ya esta corriendo.");
        return;
    }

    ui->console->appendPlainText("[UDP] Iniciando proceso discovery...");
    discoveryProcess->start(rutaFrankenPhp(), QStringList() << "php-cli" << "artisan" << "suitapi:discovery");
}

void MainWindow::arrancarBaseDeDatosIndependiente(bool iniciarApisCuandoEsteLista)
{
    if (postgresProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[DB] pg_ctl ya está en ejecución.");
        return;
    }

    apiIniciada = !iniciarApisCuandoEsteLista;

    ui->console->appendPlainText("[DB] Iniciando PostgreSQL...");
    postgresProcess->start(
        rutaPgCtl(),
        QStringList() << "start" << "-w"
                      << "-D" << rutaPgData()
                      << "-l" << rutaPgLog()
    );
}

// pg_ctl stop -w: apagado limpio, espera a que termine
bool MainWindow::detenerPostgres(int waitMs)
{
    QProcess stopProcess;
    stopProcess.setWorkingDirectory(basePath);

    ui->console->appendPlainText("[DB] Deteniendo PostgreSQL con pg_ctl...");
    stopProcess.start(rutaPgCtl(), QStringList() << "stop" << "-w" << "-D" << rutaPgData());

    if (!stopProcess.waitForFinished(waitMs)) {
        ui->console->appendPlainText("[DB ERR] pg_ctl stop no respondió a tiempo.");
        stopProcess.kill();
        stopProcess.waitForFinished(2000);
        return false;
    }

    QString out = QString::fromLocal8Bit(stopProcess.readAllStandardOutput()).trimmed();
    QString err = QString::fromLocal8Bit(stopProcess.readAllStandardError()).trimmed();

    if (!out.isEmpty()) ui->console->appendPlainText("[DB] " + out);
    if (!err.isEmpty()) ui->console->appendPlainText("[DB ERR] " + err);

    return stopProcess.exitCode() == 0;
}

// --- Rutas -------------------------------------------------------------------

QString MainWindow::procesoErrorATexto(QProcess::ProcessError error) const
{
    switch (error) {
    case QProcess::FailedToStart:
        return "No se pudo iniciar el proceso. Verificá que el ejecutable exista y tenga permisos.";
    case QProcess::Crashed:
        return "El proceso crasheó inesperadamente.";
    case QProcess::Timedout:
        return "El proceso no respondió a tiempo (timeout).";
    case QProcess::WriteError:
        return "Error al escribir datos al proceso.";
    case QProcess::ReadError:
        return "Error al leer datos del proceso.";
    case QProcess::UnknownError:
    default:
        return "Error desconocido.";
    }
}

QString MainWindow::rutaFrankenPhp() const
{
    return basePath + "/frankenphp/frankenphp.exe";
}

QString MainWindow::rutaPgCtl() const
{
    return basePath + "/pgsql/bin/pg_ctl.exe";
}

QString MainWindow::rutaPgData() const
{
    return basePath + "/pgsql/data";
}

QString MainWindow::rutaPgLog() const
{
    return logDirPath + "/postgres.log";
}

QString MainWindow::rutaPgDump() const
{
    return basePath + "/pgsql/bin/pg_dump.exe";
}

QString MainWindow::rutaPgRestore() const
{
    return basePath + "/pgsql/bin/pg_restore.exe";
}

QString MainWindow::rutaBackups() const
{
    return config->rutaBackups();
}

QString MainWindow::rutaPhpIni() const
{
    return basePath + "/frankenphp/php.ini";
}

QString MainWindow::rutaSanctum() const
{
    return basePath + "/frankenphp/SuitAPI/config/sanctum.php";
}

QString MainWindow::rutaFilesystems() const
{
    return basePath + "/frankenphp/SuitAPI/config/filesystems.php";
}

QString MainWindow::rutaStorage() const
{
    return basePath + "/frankenphp/SuitAPI/storage";
}

// --- Storage backup ----------------------------------------------------------

void MainWindow::ejecutarStorageBackup(const QString &rutaDestino)
{
    if (storageBackupProcess->state() != QProcess::NotRunning) {
        ui->console->appendPlainText("[STORAGE] Ya hay un backup de storage en curso.");
        return;
    }

    const QString src = rutaStorage();
    if (!QDir(src).exists()) {
        ui->console->appendPlainText("[STORAGE ERR] No se encontró el directorio storage: " + src);
        return;
    }
    if (rutaDestino.isEmpty()) {
        ui->console->appendPlainText("[STORAGE ERR] No se configuró una ruta de destino.");
        return;
    }

    const QString dest = rutaDestino + "/storage_backup_"
                         + QDateTime::currentDateTime().toString("yyyyMMdd_HHmmss");
    QDir().mkpath(dest);

    ui->console->appendPlainText("[STORAGE] Iniciando backup → " + dest);

#ifdef Q_OS_WIN
    storageBackupProcess->start(
        "xcopy",
        QStringList() << QDir::toNativeSeparators(src)
                      << QDir::toNativeSeparators(dest)
                      << "/E" << "/I" << "/Y" << "/H"
    );
#else
    storageBackupProcess->start(
        "cp",
        QStringList() << "-rp" << src + "/." << dest
    );
#endif
}

void MainWindow::ejecutarStorageBackupProgramado()
{
    // Restablecer intervalo completo para los disparos siguientes
    storageBackupTimer.setInterval(config->intervaloStorageBackupSegundos() * 1000);
    storageBackupTimer.start();

    const QString ruta = config->rutaStorageBackup();
    if (ruta.isEmpty()) {
        ui->console->appendPlainText(
            "[STORAGE] Backup programado omitido: no hay ruta de destino configurada.");
        return;
    }
    ejecutarStorageBackup(ruta);
}

void MainWindow::storageBackupFinalizado(int exitCode, QProcess::ExitStatus exitStatus)
{
    if (exitCode == 0 && exitStatus == QProcess::NormalExit)
        ui->console->appendPlainText("[STORAGE] Backup de storage completado.");
    else
        ui->console->appendPlainText("[STORAGE ERR] El backup de storage finalizó con errores.");
}

// --- Tray --------------------------------------------------------------------

bool MainWindow::trayDisponible() const
{
    return trayIcon && trayIcon->isVisible();
}

QString MainWindow::modoInicio() const
{
    return config->modoInicio();
}

void MainWindow::closeEvent(QCloseEvent *event)
{
    if (!permitirCierreReal && trayDisponible()) {
        event->ignore();
        hide();
        actualizarMenuTray();
        return;
    }

    QMainWindow::closeEvent(event);
}

void MainWindow::configurarSystemTray()
{
    if (!QSystemTrayIcon::isSystemTrayAvailable()) {
        ui->console->appendPlainText("[TRAY] System tray no disponible.");
        return;
    }

    trayMenu = new QMenu(this);
    mostrarAction = trayMenu->addAction("Abrir launcher");
    ocultarAction = trayMenu->addAction("Ocultar launcher");
    trayMenu->addSeparator();
    salirAction = trayMenu->addAction("Salir");

    trayIcon = new QSystemTrayIcon(this);
    trayIcon->setContextMenu(trayMenu);
    trayIcon->setToolTip("Suit API Launcher");

    if (!windowIcon().isNull()) {
        trayIcon->setIcon(windowIcon());
    } else {
        trayIcon->setIcon(style()->standardIcon(QStyle::SP_ComputerIcon));
    }

    connect(mostrarAction, &QAction::triggered, this, &MainWindow::mostrarVentanaDesdeTray);
    connect(ocultarAction, &QAction::triggered, this, &MainWindow::ocultarVentanaEnTray);
    connect(salirAction, &QAction::triggered, this, &MainWindow::cerrarAplicacionDesdeTray);
    connect(trayIcon, &QSystemTrayIcon::activated, this, &MainWindow::manejarClickTray);

    trayIcon->show();
    actualizarMenuTray();
}

void MainWindow::actualizarMenuTray()
{
    if (!trayMenu) return;

    const bool visible = isVisible();
    if (mostrarAction) mostrarAction->setEnabled(!visible);
    if (ocultarAction) ocultarAction->setEnabled(visible);
}

void MainWindow::mostrarVentanaDesdeTray()
{
    showNormal();
    raise();
    activateWindow();
    actualizarMenuTray();
}

void MainWindow::ocultarVentanaEnTray()
{
    hide();
    actualizarMenuTray();
}

void MainWindow::cerrarAplicacionDesdeTray()
{
    this->cerrarServidor();
}

void MainWindow::manejarClickTray(QSystemTrayIcon::ActivationReason reason)
{
    if (reason == QSystemTrayIcon::Trigger || reason == QSystemTrayIcon::DoubleClick)
        mostrarVentanaDesdeTray();
}
