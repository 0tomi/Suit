#include "switchrow.h"
#include <QFrame>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QTimer>
#include <QVBoxLayout>

SwitchRow::SwitchRow(const QString &servicio,
                     const QString &descripcion,
                     std::function<bool()> stateChecker,
                     std::function<void()> actionEncender,
                     std::function<void()> actionApagar,
                     QWidget *parent)
    : QWidget(parent)
    , stateChecker(std::move(stateChecker))
    , actionEncender(std::move(actionEncender))
    , actionApagar(std::move(actionApagar))
    , servicio(servicio)
{
    auto *hLayout = new QHBoxLayout(this);
    hLayout->setContentsMargins(0, 4, 0, 4);
    hLayout->setSpacing(10);

    // Barra indicadora de color (izquierda)
    indicador = new QFrame(this);
    indicador->setFixedWidth(6);
    indicador->setMinimumHeight(44);
    indicador->setFrameShape(QFrame::NoFrame);

    // Centro: nombre del servicio + estado, descripcion
    lblEstado = new QLabel(this);
    lblEstado->setStyleSheet("font-weight: bold;");

    auto *lblDesc = new QLabel(descripcion, this);
    lblDesc->setStyleSheet("color: #888888; font-size: 11px;");
    lblDesc->setWordWrap(true);

    auto *centerLayout = new QVBoxLayout;
    centerLayout->setSpacing(2);
    centerLayout->addWidget(lblEstado);
    centerLayout->addWidget(lblDesc);

    // Boton de toggle (derecha)
    btn = new QPushButton(this);
    btn->setFixedWidth(100);
    btn->setMinimumHeight(36);

    connect(btn, &QPushButton::clicked, this, [this]() {
        if (this->stateChecker())
            this->actionApagar();
        else
            this->actionEncender();
    });

    hLayout->addWidget(indicador);
    hLayout->addLayout(centerLayout, 1);
    hLayout->addWidget(btn);

    refreshTimer = new QTimer(this);
    refreshTimer->setInterval(800);
    connect(refreshTimer, &QTimer::timeout, this, &SwitchRow::refresh);
    refreshTimer->start();

    refresh();
}

void SwitchRow::refresh()
{
    bool corriendo = stateChecker();
    if (corriendo) {
        indicador->setStyleSheet("background-color: #2ecc71; border-radius: 3px;");
        lblEstado->setText(servicio + "   \u2014   ACTIVO");
        btn->setText("Apagar");
    } else {
        indicador->setStyleSheet("background-color: #e74c3c; border-radius: 3px;");
        lblEstado->setText(servicio + "   \u2014   INACTIVO");
        btn->setText("Iniciar");
    }
}
