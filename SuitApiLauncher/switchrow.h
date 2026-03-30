#ifndef SWITCHROW_H
#define SWITCHROW_H

#include <QWidget>
#include <functional>

class QFrame;
class QLabel;
class QPushButton;
class QTimer;

class SwitchRow : public QWidget
{
    Q_OBJECT
public:
    SwitchRow(const QString &servicio,
              const QString &descripcion,
              std::function<bool()> stateChecker,
              std::function<void()> actionEncender,
              std::function<void()> actionApagar,
              QWidget *parent = nullptr);

    void refresh();

private:
    std::function<bool()> stateChecker;
    std::function<void()> actionEncender;
    std::function<void()> actionApagar;
    QString servicio;

    QFrame *indicador;
    QLabel *lblEstado;
    QPushButton *btn;
    QTimer *refreshTimer;
};

#endif // SWITCHROW_H
