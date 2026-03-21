#include "dialogfunciones.h"
#include <QGridLayout>
#include <QPushButton>
#include <QVBoxLayout>

DialogFunciones::DialogFunciones(QWidget *parent)
    : QDialog(parent)
{
    setWindowTitle("Funciones");
    setMinimumSize(400, 260);

    auto *grid = new QGridLayout;
    grid->setSpacing(8);

    struct { const char *texto; void (DialogFunciones::*signal)(); } botones[] = {
        { "Correr migraciones",  &DialogFunciones::correrMigracionesSolicitado },
        { "Iniciar servidor UDP",&DialogFunciones::iniciarUdpSolicitado        },
        { "Apagar servidor UDP", &DialogFunciones::apagarUdpSolicitado         },
        { "Reiniciar API",       &DialogFunciones::reiniciarApiSolicitado      },
        { "Reiniciar BD",        &DialogFunciones::reiniciarBdSolicitado       },
        { "Limpiar datos viejos",&DialogFunciones::limpiarDatosSolicitado      },
    };

    for (int i = 0; i < 6; ++i) {
        auto *btn = new QPushButton(botones[i].texto, this);
        btn->setMinimumHeight(40);
        connect(btn, &QPushButton::clicked, this, botones[i].signal);
        grid->addWidget(btn, i / 2, i % 2);
    }

    auto *btnCerrar = new QPushButton("Cerrar", this);
    connect(btnCerrar, &QPushButton::clicked, this, &QDialog::accept);

    auto *layout = new QVBoxLayout(this);
    layout->addLayout(grid);
    layout->addWidget(btnCerrar);
}
