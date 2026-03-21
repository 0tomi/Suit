#ifndef DIALOGFUNCIONES_H
#define DIALOGFUNCIONES_H

#include <QDialog>

class DialogFunciones : public QDialog
{
    Q_OBJECT

public:
    explicit DialogFunciones(QWidget *parent = nullptr);

signals:
    void correrMigracionesSolicitado();
    void iniciarUdpSolicitado();
    void apagarUdpSolicitado();
    void reiniciarApiSolicitado();
    void reiniciarBdSolicitado();
    void limpiarDatosSolicitado();
};

#endif // DIALOGFUNCIONES_H
