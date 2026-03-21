#include "dialogrecuperacion.h"
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QDir>
#include <QFileInfo>
#include <QMessageBox>
#include <QHeaderView>

DialogRecuperacion::DialogRecuperacion(const QString &dirBackups, QWidget *parent)
    : QDialog(parent)
    , m_dirBackups(dirBackups)
{
    setWindowTitle("Recuperar backup");
    setMinimumSize(520, 380);

    QVBoxLayout *mainLayout = new QVBoxLayout(this);

    QLabel *label = new QLabel(
        "Seleccioná un backup para restaurar.\n"
        "Atención: esta operación reemplazará la base de datos actual con el backup elegido.",
        this
    );
    label->setWordWrap(true);
    mainLayout->addWidget(label);

    modeloArchivos = new QFileSystemModel(this);
    modeloArchivos->setRootPath(dirBackups);
    modeloArchivos->setNameFilters(QStringList() << "*.dump");
    modeloArchivos->setNameFilterDisables(false);

    vistaArchivos = new QTreeView(this);
    vistaArchivos->setModel(modeloArchivos);
    vistaArchivos->setRootIndex(modeloArchivos->index(dirBackups));
    vistaArchivos->setSortingEnabled(true);
    vistaArchivos->sortByColumn(3, Qt::DescendingOrder);
    vistaArchivos->header()->setSectionResizeMode(0, QHeaderView::Stretch);
    vistaArchivos->setColumnWidth(0, 250);
    mainLayout->addWidget(vistaArchivos);

    QHBoxLayout *botonesLayout = new QHBoxLayout();
    QPushButton *btnCancelar = new QPushButton("Cancelar", this);
    QPushButton *btnSeleccionado = new QPushButton("Elegir seleccionado", this);
    QPushButton *btnMasNuevo = new QPushButton("Elegir más nuevo", this);

    botonesLayout->addWidget(btnCancelar);
    botonesLayout->addStretch();
    botonesLayout->addWidget(btnSeleccionado);
    botonesLayout->addWidget(btnMasNuevo);
    mainLayout->addLayout(botonesLayout);

    connect(btnCancelar, &QPushButton::clicked, this, &QDialog::reject);
    connect(btnSeleccionado, &QPushButton::clicked, this, &DialogRecuperacion::elegirSeleccionado);
    connect(btnMasNuevo, &QPushButton::clicked, this, &DialogRecuperacion::elegirMasNuevo);
}

QString DialogRecuperacion::archivoSeleccionado() const
{
    return archivoElegido;
}

void DialogRecuperacion::elegirSeleccionado()
{
    QModelIndex index = vistaArchivos->currentIndex();
    if (!index.isValid()) {
        QMessageBox::warning(this, "Sin selección", "Por favor seleccioná un archivo de la lista.");
        return;
    }

    QString filePath = modeloArchivos->filePath(index);
    QFileInfo info(filePath);
    if (!info.isFile() || !filePath.endsWith(".dump")) {
        QMessageBox::warning(this, "Selección inválida", "Por favor seleccioná un archivo .dump válido.");
        return;
    }

    archivoElegido = filePath;
    accept();
}

void DialogRecuperacion::elegirMasNuevo()
{
    QDir dir(m_dirBackups);
    QFileInfoList archivos = dir.entryInfoList(
        QStringList() << "*.dump", QDir::Files, QDir::Time
    );
    if (archivos.isEmpty()) {
        QMessageBox::warning(this, "Sin backups", "No se encontraron archivos de backup.");
        return;
    }

    archivoElegido = archivos.first().absoluteFilePath();
    accept();
}
