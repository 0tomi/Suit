#include "phpiniparser.h"

#include <QFile>
#include <QRegularExpression>
#include <QTextStream>
#include <algorithm>

bool PhpIniParser::cargar(const QString &ruta)
{
    QFile file(ruta);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text))
        return false;

    QTextStream in(&file);
    lineas = in.readAll().split('\n');
    indicesExtensiones.clear();
    indicesClaves.clear();

    static const QRegularExpression reExt("^;?extension=(\\w+)\\s*$");
    static const QRegularExpression reClave("^([a-z_][a-z_0-9]*)\\s*=");

    for (int i = 0; i < lineas.size(); ++i) {
        auto mExt = reExt.match(lineas[i]);
        if (mExt.hasMatch()) {
            indicesExtensiones[mExt.captured(1)] = i;
            continue;
        }
        auto mClave = reClave.match(lineas[i]);
        if (mClave.hasMatch())
            indicesClaves[mClave.captured(1)] = i;
    }
    return true;
}

bool PhpIniParser::guardar(const QString &ruta)
{
    QFile file(ruta);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text))
        return false;

    QTextStream out(&file);
    out << lineas.join('\n');
    return true;
}

QList<QPair<QString, bool>> PhpIniParser::extensiones() const
{
    QList<QPair<QString, bool>> result;
    for (auto it = indicesExtensiones.constBegin(); it != indicesExtensiones.constEnd(); ++it) {
        bool activa = !lineas[it.value()].startsWith(';');
        result.append({it.key(), activa});
    }
    std::sort(result.begin(), result.end(), [](const auto &a, const auto &b) {
        return a.first < b.first;
    });
    return result;
}

void PhpIniParser::setExtensionActiva(const QString &nombre, bool activa)
{
    auto it = indicesExtensiones.find(nombre);
    if (it == indicesExtensiones.end())
        return;

    QString &linea = lineas[it.value()];
    if (activa) {
        if (linea.startsWith(';'))
            linea.remove(0, 1);
    } else {
        if (!linea.startsWith(';'))
            linea.prepend(';');
    }
}

QString PhpIniParser::valor(const QString &clave, const QString &defecto) const
{
    auto it = indicesClaves.constFind(clave);
    if (it == indicesClaves.constEnd())
        return defecto;

    // Captura el valor luego del '=', ignorando comentarios inline (; ...)
    static const QRegularExpression re("^[a-z_][a-z_0-9]*\\s*=\\s*(.*?)\\s*(?:;.*)?$");
    auto m = re.match(lineas[it.value()]);
    if (!m.hasMatch())
        return defecto;
    return m.captured(1).trimmed();
}

void PhpIniParser::setValor(const QString &clave, const QString &valor)
{
    auto it = indicesClaves.find(clave);
    if (it == indicesClaves.end())
        return;
    lineas[it.value()] = clave + " = " + valor;
}
