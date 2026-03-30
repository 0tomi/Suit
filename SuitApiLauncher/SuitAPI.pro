QT       += core gui

greaterThan(QT_MAJOR_VERSION, 4): QT += widgets

CONFIG += c++17

# You can make your code fail to compile if it uses deprecated APIs.
# In order to do so, uncomment the following line.
#DEFINES += QT_DISABLE_DEPRECATED_BEFORE=0x060000    # disables all the APIs deprecated before Qt 6.0.0

SOURCES += \
    caddyfileparser.cpp \
    configmanager.cpp \
    dialogfunciones.cpp \
    dialogrecuperacion.cpp \
    envparser.cpp \
    main.cpp \
    mainwindow.cpp \
    menuconfiguraciones.cpp \
    phpconfigparser.cpp \
    phpiniparser.cpp \
    switchrow.cpp

HEADERS += \
    caddyfileparser.h \
    configmanager.h \
    dialogfunciones.h \
    dialogrecuperacion.h \
    envparser.h \
    mainwindow.h \
    menuconfiguraciones.h \
    phpconfigparser.h \
    phpiniparser.h \
    switchrow.h

FORMS += \
    mainwindow.ui \
    menuconfiguraciones.ui

# Default rules for deployment.
qnx: target.path = /tmp/$${TARGET}/bin
else: unix:!android: target.path = /opt/$${TARGET}/bin
!isEmpty(target.path): INSTALLS += target

RESOURCES += \
    Icono.qrc

win32:RC_ICONS += SuitLogo.ico
