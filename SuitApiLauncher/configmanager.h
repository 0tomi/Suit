#ifndef CONFIGMANAGER_H
#define CONFIGMANAGER_H

#include <QSettings>
#include <QString>

class ConfigManager
{
public:
    explicit ConfigManager(const QString &filePath);

    int intervaloBackupSegundos() const;
    void setIntervaloBackupSegundos(int secs);

    int rotacionBackups() const;
    void setRotacionBackups(int n);

    int intervaloLimpiezaSegundos() const;
    void setIntervaloLimpiezaSegundos(int secs);

    int tiempoRestanteBackupMs() const;
    void setTiempoRestanteBackupMs(int ms);

    int tiempoRestanteLimpiezaMs() const;
    void setTiempoRestanteLimpiezaMs(int ms);

    QString rutaBackups() const;
    void setRutaBackups(const QString &ruta);

    QString modoInicio() const;
    void setModoInicio(const QString &modo);

    bool inicioConSistema() const;
    void setInicioConSistema(bool enabled);

    bool timeoutApiActivado() const;
    void setTimeoutApiActivado(bool activado);

    int timeoutApiMinutos() const;
    void setTimeoutApiMinutos(int minutos);

    bool timeoutPostgresActivado() const;
    void setTimeoutPostgresActivado(bool activado);

    int timeoutPostgresMinutos() const;
    void setTimeoutPostgresMinutos(int minutos);

    bool storageBackupActivado() const;
    void setStorageBackupActivado(bool activado);

    int intervaloStorageBackupSegundos() const;
    void setIntervaloStorageBackupSegundos(int secs);

    QString rutaStorageBackup() const;
    void setRutaStorageBackup(const QString &ruta);

    int tiempoRestanteStorageBackupMs() const;
    void setTiempoRestanteStorageBackupMs(int ms);

    void guardar();

private:
    mutable QSettings settings;
};

#endif // CONFIGMANAGER_H
