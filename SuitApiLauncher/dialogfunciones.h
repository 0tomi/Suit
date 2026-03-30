#ifndef DIALOGFUNCIONES_H
#define DIALOGFUNCIONES_H

#include <QDialog>
#include <functional>

class DialogFunciones : public QDialog
{
    Q_OBJECT

public:
    explicit DialogFunciones(
        std::function<bool()> udpActivo,
        std::function<bool()> apiActivo,
        std::function<bool()> bdActivo,
        int diasLimpieza,
        QWidget *parent = nullptr
    );

signals:
    void encenderUdpSolicitado();
    void apagarUdpSolicitado();
    void encenderApiSolicitado();
    void apagarApiSolicitado();
    void encenderBdSolicitado();
    void apagarBdSolicitado();
    void limpiarSoftDeletesSolicitado();
    void correrMigracionesSolicitado();
    void correrSemillasSolicitado();
};

#endif // DIALOGFUNCIONES_H
