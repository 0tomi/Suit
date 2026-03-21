#include "mainwindow.h"

#include <QApplication>
#include <QSystemTrayIcon>

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    a.setQuitOnLastWindowClosed(false);
    MainWindow w;

    const QString modo = w.modoInicio();
    if (modo == "minimizado") {
        if (!QSystemTrayIcon::isSystemTrayAvailable())
            w.showMinimized();
        // con tray disponible: inicia oculto en bandeja
    } else if (modo == "maximizado") {
        w.showMaximized();
    } else {
        if (!QSystemTrayIcon::isSystemTrayAvailable())
            w.show();
        else
            w.showNormal();
    }

    return a.exec();
}
