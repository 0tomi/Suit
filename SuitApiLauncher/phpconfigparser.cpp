#include "phpconfigparser.h"

#include <QFile>
#include <QRegularExpression>
#include <QTextStream>

bool PhpConfigParser::cargar(const QString &ruta)
{
    QFile file(ruta);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text))
        return false;

    QTextStream in(&file);
    lineas = in.readAll().split('\n');
    return true;
}

bool PhpConfigParser::guardar(const QString &ruta)
{
    QFile file(ruta);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text))
        return false;

    QTextStream out(&file);
    out << lineas.join('\n');
    return true;
}

// Busca la primera línea que coincida con  'clave' => valor,
QString PhpConfigParser::valor(const QString &clave) const
{
    QRegularExpression re(
        QString("^\\s*'%1'\\s*=>\\s*(.*?)\\s*,\\s*$")
            .arg(QRegularExpression::escape(clave))
    );
    for (const QString &linea : lineas) {
        auto m = re.match(linea);
        if (m.hasMatch())
            return m.captured(1).trimmed();
    }
    return {};
}

void PhpConfigParser::setValor(const QString &clave, const QString &phpValue)
{
    QRegularExpression re(
        QString("^(\\s*'%1'\\s*=>\\s*).*?(,\\s*)$")
            .arg(QRegularExpression::escape(clave))
    );
    for (QString &linea : lineas) {
        auto m = re.match(linea);
        if (m.hasMatch()) {
            linea = m.captured(1) + phpValue + m.captured(2);
            return;
        }
    }
}

// Busca 'disco' => [ y dentro del bloque encuentra 'clave' => valor,
QString PhpConfigParser::valorDisco(const QString &disco, const QString &clave) const
{
    QRegularExpression reBloque(
        QString("^\\s*'%1'\\s*=>\\s*\\[")
            .arg(QRegularExpression::escape(disco))
    );
    QRegularExpression reClave(
        QString("^\\s*'%1'\\s*=>\\s*(.*?)\\s*,")
            .arg(QRegularExpression::escape(clave))
    );

    bool enBloque = false;
    int profundidad = 0;

    for (const QString &linea : lineas) {
        if (!enBloque) {
            if (reBloque.match(linea).hasMatch()) {
                enBloque = true;
                profundidad = 1;
            }
        } else {
            profundidad += linea.count('[') - linea.count(']');
            if (profundidad <= 0)
                break;
            auto m = reClave.match(linea);
            if (m.hasMatch())
                return m.captured(1).trimmed();
        }
    }
    return {};
}

void PhpConfigParser::setValorDisco(const QString &disco, const QString &clave, const QString &phpValue)
{
    QRegularExpression reBloque(
        QString("^\\s*'%1'\\s*=>\\s*\\[")
            .arg(QRegularExpression::escape(disco))
    );
    QRegularExpression reClave(
        QString("^(\\s*'%1'\\s*=>\\s*).*?(,\\s*)$")
            .arg(QRegularExpression::escape(clave))
    );

    bool enBloque = false;
    int profundidad = 0;

    for (QString &linea : lineas) {
        if (!enBloque) {
            if (reBloque.match(linea).hasMatch()) {
                enBloque = true;
                profundidad = 1;
            }
        } else {
            profundidad += linea.count('[') - linea.count(']');
            if (profundidad <= 0)
                break;
            auto m = reClave.match(linea);
            if (m.hasMatch()) {
                linea = m.captured(1) + phpValue + m.captured(2);
                return;
            }
        }
    }
}
