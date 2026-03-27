#ifndef DIALOGRECUPERACION_H
#define DIALOGRECUPERACION_H

#include <QDialog>
#include <QFileSystemModel>
#include <QTreeView>

class DialogRecuperacion : public QDialog
{
    Q_OBJECT

public:
    explicit DialogRecuperacion(const QString &dirBackups, QWidget *parent = nullptr);

    QString archivoSeleccionado() const;

private slots:
    void elegirSeleccionado();
    void elegirMasNuevo();

private:
    QTreeView *vistaArchivos;
    QFileSystemModel *modeloArchivos;
    QString archivoElegido;
    QString m_dirBackups;
};

#endif // DIALOGRECUPERACION_H
