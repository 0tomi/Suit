#ifndef CADDYFILEPARSER_H
#define CADDYFILEPARSER_H

#include <QString>
#include <QStringList>

class CaddyfileParser
{
public:
    bool cargar(const QString &path);
    bool guardar(const QString &path) const;

    QString host() const;
    void setHost(const QString &h);

    int puerto() const;
    void setPuerto(int p);

    bool tlsActivo() const;
    void setTlsActivo(bool on);

private:
    QStringList lineas;
    int indiceBloqueServidor = -1;

    void actualizarLineaServidor(const QString &newHost, int newPort);
    int encontrarFinBloque(int inicio) const;
};

#endif // CADDYFILEPARSER_H
