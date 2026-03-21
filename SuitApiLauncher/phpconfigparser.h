#ifndef PHPCONFIGPARSER_H
#define PHPCONFIGPARSER_H

#include <QString>
#include <QStringList>

class PhpConfigParser
{
public:
    bool cargar(const QString &ruta);
    bool guardar(const QString &ruta);

    // Lectura/escritura de claves simples: 'clave' => valor,
    QString valor(const QString &clave) const;
    void setValor(const QString &clave, const QString &phpValue);

    // Lectura/escritura de claves dentro de un bloque de disco de filesystems.php
    // disco = "local" | "public",  clave = "root"
    QString valorDisco(const QString &disco, const QString &clave) const;
    void setValorDisco(const QString &disco, const QString &clave, const QString &phpValue);

private:
    QStringList lineas;
};

#endif // PHPCONFIGPARSER_H
