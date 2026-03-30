#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QAction>
#include <QMainWindow>
#include <QMenu>
#include <QProcess>
#include <QSystemTrayIcon>
#include <QDir>
#include <QFile>
#include <QTimer>
#include "configmanager.h"

class QCloseEvent;

QT_BEGIN_NAMESPACE
namespace Ui { class MainWindow; }
QT_END_NAMESPACE

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();
    bool trayDisponible() const;
    QString modoInicio() const;

private slots:
    void arrancarServidor();
    void pararServidor();
    void reiniciarServidor();
    void cerrarServidor();
    void arrancarAPIs();

    void leerLogsPostgres();
    void leerLogsApi();
    void leerLogsDiscovery();
    void correrMigraciones();
    void iniciarServidorUdp();
    void apagarServidorUdp();
    void reiniciarApi();
    void reiniciarBaseDeDatos();
    void leerLogsMigraciones();
    void migracionesFinalizadas(int exitCode, QProcess::ExitStatus exitStatus);
    void errorMigraciones(QProcess::ProcessError error);
    void mostrarVentanaDesdeTray();
    void ocultarVentanaEnTray();
    void cerrarAplicacionDesdeTray();
    void manejarClickTray(QSystemTrayIcon::ActivationReason reason);

    void ejecutarBackup();
    void ejecutarLimpieza();
    void persistirTiemposRestantes();
    void limpiarDatosViejos();
    void leerLogsLimpieza();
    void leerLogsBackup();
    void backupFinalizado(int exitCode, QProcess::ExitStatus exitStatus);
    void limpiezaFinalizada(int exitCode, QProcess::ExitStatus exitStatus);

    void ejecutarStorageBackupProgramado();
    void storageBackupFinalizado(int exitCode, QProcess::ExitStatus exitStatus);

    void apagarApi();
    void arrancarBd();
    void apagarBd();
    void correrSemillas();
    void leerLogsSemillas();
    void semillasFinalizadas(int exitCode, QProcess::ExitStatus exitStatus);

private:
    void closeEvent(QCloseEvent *event) override;
    void configurarSystemTray();
    void actualizarMenuTray();
    void configurarTimers();
    void actualizarTimers(int oldBackupSecs, int oldLimpiezaSecs);
    void configurarStorageBackupTimer();
    void actualizarTimerStorageBackup(int oldSecs);
    void ejecutarBackupReal();
    void restaurarBackup(const QString &rutaArchivo);
    void ejecutarStorageBackup(const QString &rutaDestino);

    Ui::MainWindow *ui;

    QProcess *postgresProcess;
    QProcess *apiProcess;
    QProcess *discoveryProcess;
    QProcess *migrationProcess;
    QProcess *cleanupProcess = nullptr;
    QProcess *backupProcess = nullptr;
    QProcess *storageBackupProcess = nullptr;
    QProcess *seedProcess = nullptr;

    QString basePath;
    QString logDirPath;
    QString backupArchivoActual;

    bool apiIniciada = false;
    bool bdActiva = false;
    bool permitirCierreReal = false;

    ConfigManager *config = nullptr;
    QTimer backupTime, cleanUpTime, persistenciaTimer, storageBackupTimer;

    enum class EstadoBoton { Detenido, EnProceso, Corriendo };
    void actualizarBotonServidor(EstadoBoton estado);

    bool detenerProceso(QProcess *process, const QString &prefix, int terminateWaitMs, int killWaitMs);
    bool detenerPostgres(int waitMs = 15000);
    void arrancarApiIndependiente();
    void arrancarDiscoveryIndependiente();
    void arrancarBaseDeDatosIndependiente(bool iniciarApisCuandoEsteLista);

    int timeoutApiMs() const;
    int timeoutPostgresMs() const;

    QString rutaFrankenPhp() const;
    QString rutaPgCtl() const;
    QString rutaPgData() const;
    QString rutaPgLog() const;
    QString rutaPgDump() const;
    QString rutaPgRestore() const;
    QString rutaBackups() const;
    QString rutaPhpIni() const;
    QString rutaSanctum() const;
    QString rutaFilesystems() const;
    QString rutaStorage() const;
    QString procesoErrorATexto(QProcess::ProcessError error) const;

    QSystemTrayIcon *trayIcon = nullptr;
    QMenu *trayMenu = nullptr;
    QAction *mostrarAction = nullptr;
    QAction *ocultarAction = nullptr;
    QAction *salirAction = nullptr;
};

#endif // MAINWINDOW_H
