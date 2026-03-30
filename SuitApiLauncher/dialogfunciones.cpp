#include "dialogfunciones.h"
#include "switchrow.h"
#include <QFileInfo>
#include <QFrame>
#include <QLabel>
#include <QMessageBox>
#include <QProcess>
#include <QPushButton>
#include <QVBoxLayout>

DialogFunciones::DialogFunciones(
    std::function<bool()> udpActivo,
    std::function<bool()> apiActivo,
    std::function<bool()> bdActivo,
    int diasLimpieza,
    QWidget *parent)
    : QDialog(parent)
{
    setWindowTitle("Funciones");
    setMinimumWidth(520);

    auto *mainLayout = new QVBoxLayout(this);
    mainLayout->setSpacing(10);
    mainLayout->setContentsMargins(16, 14, 16, 14);

    // ── Sección de servicios ──────────────────────────────────────────────────
    auto *lblServicios = new QLabel("Servicios", this);
    lblServicios->setStyleSheet("font-weight: bold; font-size: 13px; color: #555555;");
    mainLayout->addWidget(lblServicios);

    mainLayout->addWidget(new SwitchRow(
        "Servidor UDP",
        "Desactivarlo cuando el servidor tiene IP fija y todos los dispositivos "
        "ya encontraron la dirección del servidor, evitando tener un proceso abierto innecesario.",
        std::move(udpActivo),
        [this]() { emit encenderUdpSolicitado(); },
        [this]() { emit apagarUdpSolicitado(); },
        this
    ));

    mainLayout->addWidget(new SwitchRow(
        "API",
        "Servidor HTTP principal (FrankenPHP). Detenerlo interrumpe el servicio para todos los clientes.",
        std::move(apiActivo),
        [this]() { emit encenderApiSolicitado(); },
        [this]() { emit apagarApiSolicitado(); },
        this
    ));

    mainLayout->addWidget(new SwitchRow(
        "Base de datos",
        "PostgreSQL. Detenerlo también interrumpe la API. Úselo solo para mantenimiento.",
        std::move(bdActivo),
        [this]() { emit encenderBdSolicitado(); },
        [this]() { emit apagarBdSolicitado(); },
        this
    ));

    // ── Separador ─────────────────────────────────────────────────────────────
    auto *sep1 = new QFrame(this);
    sep1->setFrameShape(QFrame::HLine);
    sep1->setFrameShadow(QFrame::Sunken);
    mainLayout->addWidget(sep1);

    // ── Limpiar soft-deletes ──────────────────────────────────────────────────
    auto *lblLimpiar = new QLabel("Limpiar soft-deletes", this);
    lblLimpiar->setStyleSheet("font-weight: bold;");
    mainLayout->addWidget(lblLimpiar);

    auto *lblLimpiarDesc = new QLabel(
        QString("Limpia los registros de la tabla de registros eliminados que sean anteriores a %1 días. "
                "Los logs de Laravel se mostrarán en la consola principal.")
            .arg(diasLimpieza),
        this
    );
    lblLimpiarDesc->setStyleSheet("color: #888888; font-size: 11px;");
    lblLimpiarDesc->setWordWrap(true);
    mainLayout->addWidget(lblLimpiarDesc);

    auto *btnLimpiar = new QPushButton("Limpiar soft-deletes", this);
    btnLimpiar->setMinimumHeight(36);
    connect(btnLimpiar, &QPushButton::clicked, this, [this]() {
        emit limpiarSoftDeletesSolicitado();
    });
    mainLayout->addWidget(btnLimpiar);

    // ── Separador ─────────────────────────────────────────────────────────────
    auto *sep2 = new QFrame(this);
    sep2->setFrameShape(QFrame::HLine);
    sep2->setFrameShadow(QFrame::Sunken);
    mainLayout->addWidget(sep2);

    // ── Correr migraciones (rojo) ─────────────────────────────────────────────
    auto *btnMigraciones = new QPushButton("Correr migraciones", this);
    btnMigraciones->setMinimumHeight(38);
    btnMigraciones->setStyleSheet(
        "QPushButton {"
        "  background-color: #c0392b;"
        "  color: white;"
        "  border-radius: 4px;"
        "  font-weight: bold;"
        "}"
        "QPushButton:hover { background-color: #e74c3c; }"
        "QPushButton:pressed { background-color: #a93226; }"
    );
    connect(btnMigraciones, &QPushButton::clicked, this, [this]() {
        auto ret = QMessageBox::warning(
            this,
            "Confirmar migraciones",
            "¿Está seguro de correr las migraciones?\n\n"
            "Esta operación modifica la estructura de la base de datos en producción y puede "
            "ser irreversible. Se recomienda hacer un backup antes de continuar.",
            QMessageBox::Yes | QMessageBox::No,
            QMessageBox::No
        );
        if (ret == QMessageBox::Yes)
            emit correrMigracionesSolicitado();
    });
    mainLayout->addWidget(btnMigraciones);

    // ── Correr semillas ───────────────────────────────────────────────────────
    auto *btnSemillas = new QPushButton("Correr semillas de producción", this);
    btnSemillas->setMinimumHeight(38);
    btnSemillas->setStyleSheet(
        "QPushButton {"
        "  background-color: #e67e22;"
        "  color: white;"
        "  border-radius: 4px;"
        "  font-weight: bold;"
        "}"
        "QPushButton:hover { background-color: #f39c12; }"
        "QPushButton:pressed { background-color: #ca6f1e; }"
    );
    connect(btnSemillas, &QPushButton::clicked, this, [this]() {
        auto ret = QMessageBox::warning(
            this,
            "Confirmar semillas de producción",
            "¿Está seguro de correr las semillas de producción?\n\n"
            "Esta operación puede sobrescribir o duplicar datos existentes en la base de datos. "
            "Se recomienda hacer un backup antes de continuar.",
            QMessageBox::Yes | QMessageBox::No,
            QMessageBox::No
        );
        if (ret == QMessageBox::Yes)
            emit correrSemillasSolicitado();
    });
    mainLayout->addWidget(btnSemillas);

    // ── Separador ─────────────────────────────────────────────────────────────
    auto *sep3 = new QFrame(this);
    sep3->setFrameShape(QFrame::HLine);
    sep3->setFrameShadow(QFrame::Sunken);
    mainLayout->addWidget(sep3);

    mainLayout->addStretch();

    // ── Cerrar ────────────────────────────────────────────────────────────────
    auto *btnCerrar = new QPushButton("Cerrar", this);
    btnCerrar->setMinimumHeight(34);
    connect(btnCerrar, &QPushButton::clicked, this, &QDialog::accept);
    mainLayout->addWidget(btnCerrar);
}
