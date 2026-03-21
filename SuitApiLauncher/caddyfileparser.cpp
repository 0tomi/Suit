#include "caddyfileparser.h"
#include <QFile>
#include <QTextStream>

bool CaddyfileParser::cargar(const QString &path)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text))
        return false;

    lineas.clear();
    indiceBloqueServidor = -1;

    QTextStream in(&file);
    int lineIndex = 0;
    while (!in.atEnd()) {
        QString line = in.readLine();
        lineas.append(line);

        // Find the server block: a line like ":8443 {" or "host:port {"
        // Must contain ":" and end with "{" but NOT be the global block "{"
        QString trimmed = line.trimmed();
        if (trimmed.endsWith('{') && trimmed.contains(':') && !trimmed.startsWith('{')) {
            indiceBloqueServidor = lineIndex;
        }

        lineIndex++;
    }

    file.close();
    return indiceBloqueServidor >= 0;
}

bool CaddyfileParser::guardar(const QString &path) const
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

QString CaddyfileParser::host() const
{
    if (indiceBloqueServidor < 0)
        return QString();

    QString line = lineas[indiceBloqueServidor].trimmed();
    if (line.endsWith('{'))
        line = line.left(line.length() - 1).trimmed();

    int colonPos = line.lastIndexOf(':');
    if (colonPos < 0)
        return QString();

    return line.left(colonPos);
}

void CaddyfileParser::setHost(const QString &h)
{
    if (indiceBloqueServidor < 0)
        return;
    actualizarLineaServidor(h, puerto());
}

int CaddyfileParser::puerto() const
{
    if (indiceBloqueServidor < 0)
        return 8443;

    QString line = lineas[indiceBloqueServidor].trimmed();
    if (line.endsWith('{'))
        line = line.left(line.length() - 1).trimmed();

    int colonPos = line.lastIndexOf(':');
    if (colonPos < 0)
        return 8443;

    bool ok;
    int port = line.mid(colonPos + 1).toInt(&ok);
    return ok ? port : 8443;
}

void CaddyfileParser::setPuerto(int p)
{
    if (indiceBloqueServidor < 0)
        return;
    actualizarLineaServidor(host(), p);
}

bool CaddyfileParser::tlsActivo() const
{
    if (indiceBloqueServidor < 0)
        return false;

    int fin = encontrarFinBloque(indiceBloqueServidor);
    for (int i = indiceBloqueServidor + 1; i < fin; i++) {
        if (lineas[i].trimmed() == "tls internal")
            return true;
    }
    return false;
}

void CaddyfileParser::setTlsActivo(bool on)
{
    if (indiceBloqueServidor < 0)
        return;

    int fin = encontrarFinBloque(indiceBloqueServidor);

    if (on) {
        if (!tlsActivo())
            lineas.insert(indiceBloqueServidor + 1, "\ttls internal");
    } else {
        for (int i = indiceBloqueServidor + 1; i < fin; i++) {
            if (lineas[i].trimmed() == "tls internal") {
                lineas.removeAt(i);
                break;
            }
        }
    }
}

void CaddyfileParser::actualizarLineaServidor(const QString &newHost, int newPort)
{
    if (indiceBloqueServidor < 0)
        return;
    lineas[indiceBloqueServidor] = newHost + ":" + QString::number(newPort) + " {";
}

int CaddyfileParser::encontrarFinBloque(int inicio) const
{
    int depth = 0;
    for (int i = inicio; i < lineas.size(); i++) {
        for (const QChar &ch : lineas[i]) {
            if (ch == '{') depth++;
            else if (ch == '}') {
                depth--;
                if (depth == 0)
                    return i;
            }
        }
    }
    return lineas.size();
}
