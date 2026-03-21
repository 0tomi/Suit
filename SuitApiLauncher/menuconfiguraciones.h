#ifndef MENUCONFIGURACIONES_H
#define MENUCONFIGURACIONES_H

#include <QCheckBox>
#include <QDialog>
#include <QMap>
#include "phpiniparser.h"
#include "phpconfigparser.h"

class ConfigManager;

namespace Ui {
class MenuConfiguraciones;
}

class MenuConfiguraciones : public QDialog
{
    Q_OBJECT

public:
    explicit MenuConfiguraciones(
        const QString &rutaEnv,
        const QString &rutaCaddyfile,
        const QString &rutaPhpIni,
        const QString &rutaSanctum,
        const QString &rutaFilesystems,
        ConfigManager *config,
        QWidget *parent = nullptr
    );
    ~MenuConfiguraciones();

signals:
    void restaurarSolicitado(const QString &rutaArchivo);
    void backupSolicitado();
    void storageBackupSolicitado(const QString &rutaDestino);
    void reinicioRequerido();

protected:
    void accept() override;

private slots:
    void onRecuperarBackup();
    void onCrearBackup();
    void onCambiarRutaBackups();
    void onCambiarRutaStorageBackup();
    void onCrearStorageBackup();
    void onExplorarRutaPrivada();
    void onExplorarRutaPublica();
    void onRestablecerRutaPrivada();
    void onRestablecerRutaPublica();
    void onCambiarExpiracionSanctum(int index);

private:
    void cargarValores();
    void guardarCambios();
    bool servidorRequiereReinicio() const;
    void inicializarExtensiones();

    Ui::MenuConfiguraciones *ui;
    ConfigManager *config;
    QString rutaEnv;
    QString rutaCaddyfile;
    QString rutaPhpIni;
    QString rutaSanctum;
    QString rutaFilesystems;

    PhpIniParser phpIni;
    PhpConfigParser sanctumCfg;
    PhpConfigParser filesystemsCfg;
    QMap<QString, QCheckBox *> extensionCheckboxes;

    bool phpIniCambiado = false;
    int originalPuerto = -1;
    QString originalHostname;
    bool originalTls = false;
};

#endif // MENUCONFIGURACIONES_H
