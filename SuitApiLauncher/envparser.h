#ifndef ENVPARSER_H
#define ENVPARSER_H

#include <QMap>
#include <QString>
#include <QStringList>

class EnvParser
{
public:
    bool cargar(const QString &path);
    QString valor(const QString &key, const QString &defaultVal = QString()) const;
    void setValor(const QString &key, const QString &value);
    bool guardar(const QString &path) const;

private:
    QStringList lineas;
    QMap<QString, int> indicesPorClave;
};

#endif // ENVPARSER_H
