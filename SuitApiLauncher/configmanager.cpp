#include "configmanager.h"
#include <QStandardPaths>

ConfigManager::ConfigManager(const QString &filePath)
    : settings(filePath, QSettings::IniFormat)
{
}

int ConfigManager::intervaloBackupSegundos() const
{
    return settings.value("Backup/IntervaloSegundos", 7200).toInt();
}

void ConfigManager::setIntervaloBackupSegundos(int secs)
{
    settings.setValue("Backup/IntervaloSegundos", secs);
}

int ConfigManager::rotacionBackups() const
{
    return settings.value("Backup/Rotacion", 5).toInt();
}

void ConfigManager::setRotacionBackups(int n)
{
    settings.setValue("Backup/Rotacion", n);
}

int ConfigManager::intervaloLimpiezaSegundos() const
{
    return settings.value("Limpieza/IntervaloSegundos", 604800).toInt();
}

void ConfigManager::setIntervaloLimpiezaSegundos(int secs)
{
    settings.setValue("Limpieza/IntervaloSegundos", secs);
}

int ConfigManager::tiempoRestanteBackupMs() const
{
    return settings.value("Backup/TiempoRestanteMs", 0).toInt();
}

void ConfigManager::setTiempoRestanteBackupMs(int ms)
{
    settings.setValue("Backup/TiempoRestanteMs", ms);
}

int ConfigManager::tiempoRestanteLimpiezaMs() const
{
    return settings.value("Limpieza/TiempoRestanteMs", 0).toInt();
}

void ConfigManager::setTiempoRestanteLimpiezaMs(int ms)
{
    settings.setValue("Limpieza/TiempoRestanteMs", ms);
}

QString ConfigManager::rutaBackups() const
{
    QString defecto = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation) + "/SuitAPI/backups";
    return settings.value("Backup/RutaBackups", defecto).toString();
}

void ConfigManager::setRutaBackups(const QString &ruta)
{
    settings.setValue("Backup/RutaBackups", ruta);
}

QString ConfigManager::modoInicio() const
{
    return settings.value("Aplicacion/ModoInicio", "normal").toString();
}

void ConfigManager::setModoInicio(const QString &modo)
{
    settings.setValue("Aplicacion/ModoInicio", modo);
}

bool ConfigManager::inicioConSistema() const
{
    return settings.value("Aplicacion/InicioConSistema", false).toBool();
}

void ConfigManager::setInicioConSistema(bool enabled)
{
    settings.setValue("Aplicacion/InicioConSistema", enabled);
}

bool ConfigManager::timeoutApiActivado() const
{
    return settings.value("Timeouts/ApiActivado", false).toBool();
}

void ConfigManager::setTimeoutApiActivado(bool activado)
{
    settings.setValue("Timeouts/ApiActivado", activado);
}

int ConfigManager::timeoutApiMinutos() const
{
    return settings.value("Timeouts/ApiMinutos", 1).toInt();
}

void ConfigManager::setTimeoutApiMinutos(int minutos)
{
    settings.setValue("Timeouts/ApiMinutos", minutos);
}

bool ConfigManager::timeoutPostgresActivado() const
{
    return settings.value("Timeouts/PostgresActivado", false).toBool();
}

void ConfigManager::setTimeoutPostgresActivado(bool activado)
{
    settings.setValue("Timeouts/PostgresActivado", activado);
}

int ConfigManager::timeoutPostgresMinutos() const
{
    return settings.value("Timeouts/PostgresMinutos", 1).toInt();
}

void ConfigManager::setTimeoutPostgresMinutos(int minutos)
{
    settings.setValue("Timeouts/PostgresMinutos", minutos);
}

bool ConfigManager::storageBackupActivado() const
{
    return settings.value("StorageBackup/Activado", false).toBool();
}

void ConfigManager::setStorageBackupActivado(bool activado)
{
    settings.setValue("StorageBackup/Activado", activado);
}

int ConfigManager::intervaloStorageBackupSegundos() const
{
    return settings.value("StorageBackup/IntervaloSegundos", 86400).toInt();
}

void ConfigManager::setIntervaloStorageBackupSegundos(int secs)
{
    settings.setValue("StorageBackup/IntervaloSegundos", secs);
}

QString ConfigManager::rutaStorageBackup() const
{
    return settings.value("StorageBackup/Ruta", QString()).toString();
}

void ConfigManager::setRutaStorageBackup(const QString &ruta)
{
    settings.setValue("StorageBackup/Ruta", ruta);
}

int ConfigManager::tiempoRestanteStorageBackupMs() const
{
    return settings.value("StorageBackup/TiempoRestanteMs", 0).toInt();
}

void ConfigManager::setTiempoRestanteStorageBackupMs(int ms)
{
    settings.setValue("StorageBackup/TiempoRestanteMs", ms);
}

void ConfigManager::guardar()
{
    settings.sync();
}
