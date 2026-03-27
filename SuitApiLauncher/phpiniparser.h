#ifndef PHPINIPARSER_H
#define PHPINIPARSER_H

#include <QList>
#include <QMap>
#include <QPair>
#include <QString>
#include <QStringList>

class PhpIniParser
{
public:
    bool cargar(const QString &ruta);
    bool guardar(const QString &ruta);

    // Devuelve lista de (nombre, activa) ordenada alfabéticamente
    QList<QPair<QString, bool>> extensiones() const;
    void setExtensionActiva(const QString &nombre, bool activa);

    QString valor(const QString &clave, const QString &defecto = QString()) const;
    void setValor(const QString &clave, const QString &valor);

private:
    QStringList lineas;
    QMap<QString, int> indicesExtensiones; // nombre → índice de línea
    QMap<QString, int> indicesClaves;      // clave   → índice de línea
};

#endif // PHPINIPARSER_H
