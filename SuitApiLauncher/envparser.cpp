#include "envparser.h"
#include <QFile>
#include <QTextStream>

bool EnvParser::cargar(const QString &path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text))
        return false;

    lineas.clear();
    indicesPorClave.clear();

    QTextStream in(&file);
    int lineIndex = 0;
    while (!in.atEnd()) {
        QString line = in.readLine();
        lineas.append(line);

        QString trimmed = line.trimmed();
        if (!trimmed.isEmpty() && !trimmed.startsWith('#')) {
            int eqPos = trimmed.indexOf('=');
            if (eqPos > 0) {
                QString key = trimmed.left(eqPos).trimmed();
                indicesPorClave[key] = lineIndex;
            }
        }
        lineIndex++;
    }

    file.close();
    return true;
}

QString EnvParser::valor(const QString &key, const QString &defaultVal) const
{
    if (!indicesPorClave.contains(key))
        return defaultVal;

    const QString &line = lineas[indicesPorClave[key]];
    int eqPos = line.indexOf('=');
    if (eqPos < 0)
        return defaultVal;

    return line.mid(eqPos + 1);
}

void EnvParser::setValor(const QString &key, const QString &value)
{
    if (indicesPorClave.contains(key)) {
        lineas[indicesPorClave[key]] = key + "=" + value;
    } else {
        lineas.append(key + "=" + value);
        indicesPorClave[key] = lineas.size() - 1;
    }
}

bool EnvParser::guardar(const QString &path) const
{
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text))
        return false;

    QTextStream out(&file);
    for (const QString &line : lineas)
        out << line << "\n";

    file.close();
    return true;
}
