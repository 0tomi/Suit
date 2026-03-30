;===============================================================================
; SuitAPI Server - Instalador Inno Setup
; Empaqueta: Qt Console + FrankenPHP (Laravel) + PostgreSQL embebido
;
; NOTA: Los binarios (initdb, pg_ctl, createdb, frankenphp) se ejecutan
; directamente, NO envueltos en "cmd /c", para evitar problemas con
; comillas y espacios en rutas.
; El logging se hace desde Pascal Script capturando stdout/stderr.
;===============================================================================

#define VCRedistX64Path "C:\Users\Tomas\Downloads\VC_redist.x64.exe"
#define AppVer "1.1.2"

[Setup]
AppName=SuitAPI Server
AppVersion={#AppVer}
AppPublisher=SuitAPI
DefaultDirName={sd}\SuitAPI
DefaultGroupName=SuitAPI
OutputDir=C:\Salida_Instalador
OutputBaseFilename=Instalar_SuitAPI
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
UninstallDisplayIcon={app}\SuitAPI.exe
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
MinVersion=10.0

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el escritorio"

[Files]
; Se excluye pgsql\data y el .env de desarrollo
Source: "C:\Users\Tomas\Desktop\SuitApiConsole\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "pgsql\data\*,frankenphp\SuitAPI\.env,frankenphp\SuitAPI\storage\app\*"
Source: "{#VCRedistX64Path}"; DestDir: "{tmp}"; DestName: "vc_redist.x64.exe"; Flags: deleteafterinstall; Check: NeedToInstallVCRedist

[Dirs]
Name: "{app}\pgsql\data"; Permissions: users-full
Name: "{app}\frankenphp\SuitAPI\storage"; Permissions: users-full
Name: "{app}\frankenphp\SuitAPI\storage\logs"; Permissions: users-full
Name: "{app}\frankenphp\SuitAPI\storage\framework"; Permissions: users-full
Name: "{app}\frankenphp\SuitAPI\bootstrap\cache"; Permissions: users-full

[Icons]
Name: "{autodesktop}\Panel de Control SuitAPI"; Filename: "{app}\SuitAPI.exe"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{group}\Panel de Control SuitAPI"; Filename: "{app}\SuitAPI.exe"; WorkingDir: "{app}"
Name: "{group}\Desinstalar SuitAPI"; Filename: "{uninstallexe}"

[Run]
; Solo VC++ Redist se ejecuta desde [Run] — el resto lo maneja CurStepChanged
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /passive /norestart"; StatusMsg: "Instalando Microsoft Visual C++ Redistributable 2015-2022 (x64)..."; Flags: waituntilterminated; Check: NeedToInstallVCRedist

[UninstallRun]
Filename: "{app}\pgsql\bin\pg_ctl.exe"; Parameters: "stop -m immediate -D ""{app}\pgsql\data"""; Flags: runhidden waituntilterminated
Filename: "{cmd}"; Parameters: "/c ping -n 3 127.0.0.1 > nul"; Flags: runhidden waituntilterminated
Filename: "{cmd}"; Parameters: "/c netsh advfirewall firewall delete rule name=""SuitAPI PostgreSQL (TCP)"""; Flags: runhidden waituntilterminated
Filename: "{cmd}"; Parameters: "/c netsh advfirewall firewall delete rule name=""SuitAPI Server (TCP)"""; Flags: runhidden waituntilterminated
Filename: "{cmd}"; Parameters: "/c netsh advfirewall firewall delete rule name=""SuitAPI Discovery (UDP)"""; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{app}\pgsql\data"
Type: filesandordirs; Name: "{app}\frankenphp\SuitAPI\storage\logs"
Type: files; Name: "{app}\frankenphp\SuitAPI\.env"
; install_log.txt se elimina solo si la instalación fue exitosa (ver CurUninstallStepChanged)

[Code]
var
  InstallVCRedist: Boolean;
  IsUpgrade: Boolean;
  PreviousInstallDir: String;
  DbPasswordPage: TInputQueryWizardPage;
  RunSeedPage: TInputOptionWizardPage;

// ================================================================
//  UTILIDAD: Ejecutar un proceso y capturar su resultado
// ================================================================
// Ejecuta un .exe directamente (sin cmd /c), espera a que termine,
// y escribe stdout+stderr en el log. Devuelve True si exitCode = 0.
function RunAndLog(const Exe, Params, WorkDir, StepName: String): Boolean;
var
  ResultCode: Integer;
  LogPath, ErrorMsg: String;
begin
  LogPath := ExpandConstant('{app}\install_log.txt');

  // Registrar qué estamos ejecutando
  SaveStringToFile(LogPath,
    '[' + StepName + '] Ejecutando: ' + Exe + ' ' + Params + #13#10, True);

  Result := Exec(Exe, Params, WorkDir,
                 SW_HIDE, ewWaitUntilTerminated, ResultCode);

  if not Result then
  begin
    ErrorMsg := '[ERROR] ' + StepName + ': No se pudo iniciar el proceso.';
    SaveStringToFile(LogPath, ErrorMsg + #13#10, True);
    MsgBox(ErrorMsg + #13#10#13#10 + 'Revisá el log en: ' + LogPath, mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if ResultCode <> 0 then
  begin
    ErrorMsg := '[ERROR] ' + StepName + ' fallo con codigo ' + IntToStr(ResultCode);
    SaveStringToFile(LogPath, ErrorMsg + #13#10, True);
    MsgBox(ErrorMsg + #13#10#13#10 + 'Revisá el log en: ' + LogPath, mbError, MB_OK);
    Result := False;
  end else
  begin
    SaveStringToFile(LogPath,
      '[OK] ' + StepName + ' finalizo correctamente.' + #13#10, True);
    Result := True;
  end;
end;

// Ejecuta un comando cmd /c (solo para cosas simples como netsh, del, echo)
function RunCmd(const CmdParams, StepName: String): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/c ' + CmdParams, '',
                 SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

// ================================================================
//  DETECCIÓN DE INSTALACIÓN PREVIA (vía registro de Inno Setup)
// ================================================================
// Busca en el registro la ruta de una instalación previa registrada
// por Inno Setup. Si existe Y contiene el .env, es una instalación
// válida. Devuelve la ruta en PreviousInstallDir.
function FindPreviousInstall(out InstallDir: String): Boolean;
var
  Dir: String;
begin
  Result := False;
  InstallDir := '';
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}_is1',
                         'InstallLocation', Dir) then
  begin
    // RemoveBackslashUnlessRoot para limpiar trailing backslash
    Dir := RemoveBackslashUnlessRoot(Dir);
    if FileExists(Dir + '\frankenphp\SuitAPI\.env') then
    begin
      InstallDir := Dir;
      Result := True;
    end;
  end;
end;

// ================================================================
//  PÁGINAS PERSONALIZADAS
// ================================================================
procedure InitializeWizard;
begin
  // Página de contraseña — ubicada DESPUÉS de wpSelectDir.
  DbPasswordPage := CreateInputQueryPage(
    wpSelectDir,
    'Configuración de Base de Datos',
    'Elegí una contraseña para la base de datos PostgreSQL interna.',
    'Esta contraseña se usará internamente para que la aplicación se conecte a su base de datos.' + #13#10 +
    'Anotala en un lugar seguro por si necesitás acceder manualmente en el futuro.' + #13#10#13#10 +
    'La contraseña debe tener al menos 8 caracteres.'
  );
  DbPasswordPage.Add('Contraseña de la base de datos:', False);
  DbPasswordPage.Values[0] := '';

  // Página de seeds — solo visible en upgrade, ubicada después de la de contraseña.
  RunSeedPage := CreateInputOptionPage(
    DbPasswordPage.ID,
    'Ejecutar Seeds',
    'Seleccioná si querés correr los seeders de base de datos en esta actualización.',
    'Los seeders pueden usarse para insertar nuevos datos iniciales introducidos en esta versión.' + #13#10 +
    'Si los datos que siembran los seeders ya existen, pueden generar duplicados o errores.' + #13#10#13#10 +
    'Solo activá esta opción si sabés que hay seeds nuevos que necesitás aplicar.',
    True,   // exclusive (radio buttons)
    False   // no listbox
  );
  RunSeedPage.Add('No correr seeds (recomendado)');
  RunSeedPage.Add('Correr seeds igualmente');
  RunSeedPage.SelectedValueIndex := 0; // Por defecto: NO correr seeds

  // Si InitializeSetup ya determinó que es upgrade, pre-llenar el directorio
  // para que {app} resuelva correctamente durante todo el wizard.
  if IsUpgrade and (PreviousInstallDir <> '') then
    WizardForm.DirEdit.Text := PreviousInstallDir;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;

  // En upgrade: saltar selección de directorio (ya está fijado), contraseña
  // y tasks (acceso directo ya existe).
  if IsUpgrade then
  begin
    if (PageID = wpSelectDir) or (PageID = DbPasswordPage.ID) or (PageID = wpSelectTasks) then
      Result := True;
  end;

  // En instalación nueva: salteamos la página de seeds (siempre se corren).
  if (not IsUpgrade) and (PageID = RunSeedPage.ID) then
    Result := True;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Pw: String;
begin
  Result := True;

  // Si NO es upgrade y el usuario eligió un directorio que ya tiene una
  // instalación, advertirle. Esto cubre el caso de instalación nueva donde
  // el usuario manualmente navega a una carpeta que ya tiene SuitAPI.
  if (CurPageID = wpSelectDir) and (not IsUpgrade) then
  begin
    if FileExists(WizardDirValue + '\frankenphp\SuitAPI\.env') then
    begin
      MsgBox(
        'La carpeta seleccionada ya contiene una instalación de SuitAPI.' + #13#10#13#10 +
        'Para actualizar una instalación existente, cerrá el instalador y volvé a abrirlo;' + #13#10 +
        'se te ofrecerá la opción de actualizar automáticamente.' + #13#10#13#10 +
        'Si querés una instalación nueva, elegí otra carpeta.',
        mbError, MB_OK
      );
      Result := False;
      Exit;
    end;
  end;

  // Validar contraseña solo si NO es upgrade
  if (CurPageID = DbPasswordPage.ID) and (not IsUpgrade) then
  begin
    Pw := DbPasswordPage.Values[0];

    if Length(Pw) < 8 then
    begin
      MsgBox('La contraseña debe tener al menos 8 caracteres.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    if (Pos('"', Pw) > 0) or (Pos('%', Pw) > 0) or
       (Pos('&', Pw) > 0) or (Pos('|', Pw) > 0) or
       (Pos('<', Pw) > 0) or (Pos('>', Pw) > 0) or
       (Pos('^', Pw) > 0) then
    begin
      MsgBox(
        'La contraseña no puede contener estos caracteres especiales:' + #13#10 +
        '"  %  &  |  <  >  ^' + #13#10#13#10 +
        'Usá letras, números, guiones, puntos o signos como ! @ # $',
        mbError, MB_OK
      );
      Result := False;
      Exit;
    end;
  end;
end;

function GetDbPassword(Param: String): String;
begin
  Result := DbPasswordPage.Values[0];
end;

// ================================================================
//  GENERACIÓN DEL .env
// ================================================================
procedure GenerateEnvFile;
var
  EnvPath: String;
  Content: String;
begin
  EnvPath := ExpandConstant('{app}\frankenphp\SuitAPI\.env');

  Content :=
    'APP_NAME=SuitAPI' + #13#10 +
    'APP_ENV=production' + #13#10 +
    'APP_DEBUG=false' + #13#10 +
    'APP_URL=http://localhost' + #13#10 +
    'APP_PORT=8443' + #13#10 +
    'APP_LOCALE=es' + #13#10 +
    'APP_KEY=' + #13#10 +
    '' + #13#10 +
    'LOG_CHANNEL=daily' + #13#10 +
    '' + #13#10 +
    'DB_CONNECTION=pgsql' + #13#10 +
    'DB_HOST=127.0.0.1' + #13#10 +
    'DB_PORT=5432' + #13#10 +
    'DB_DATABASE=suitapi' + #13#10 +
    'DB_USERNAME=SuitApiBD' + #13#10 +
    'DB_PASSWORD=' + GetDbPassword('') + #13#10 +
    '' + #13#10 +
    'DISCOVERY_PORT=41234' + #13#10 +
    '' + #13#10 +
    'SESSION_DRIVER=database' + #13#10 +
    'QUEUE_CONNECTION=database' + #13#10 +
    'CACHE_STORE=database' + #13#10 +
    'SESSION_LIFETIME=720' + #13#10 +
    '' + #13#10 +
    'FILESYSTEM_DISK=local' + #13#10 + 
    'FILE_CLEANUP_DAYS=30' + #13#10;

  if not SaveStringToFile(EnvPath, Content, False) then
    SaveStringToFile(ExpandConstant('{app}\install_log.txt'),
      '[ERROR] No se pudo crear el archivo .env' + #13#10, True);
end;

// ================================================================
//  VC++ REDIST CHECK
// ================================================================
function IsVCRedistX64Installed: Boolean;
var
  Installed: Cardinal;
begin
  Result :=
    RegQueryDWordValue(
      HKLM64,
      'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
      'Installed',
      Installed
    ) and (Installed = 1);
end;

function NeedToInstallVCRedist: Boolean;
begin
  Result := InstallVCRedist;
end;

// ================================================================
//  CHECKS
// ================================================================
function IsPort5432InUse: Boolean;
var
  ResultCode: Integer;
begin
  Result := False;
  if Exec('cmd.exe', '/c netstat -an | findstr "0.0.0.0:5432" >nul 2>&1', '',
           SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    Result := (ResultCode = 0);
end;

function ShouldRunInitDB: Boolean;
begin
  Result := not DirExists(ExpandConstant('{app}\pgsql\data\base'));
end;

// ================================================================
//  PROCESO PRINCIPAL DE INSTALACIÓN
// ================================================================
procedure DoPostInstall;
var
  AppDir, PgCtl, PgData, InitDb, CreateDb, Franken, LaravelDir: String;
  PgPassFile, LogPath: String;
  Password: String;
  AllOk: Boolean;
begin
  AppDir     := ExpandConstant('{app}');
  PgCtl      := AppDir + '\pgsql\bin\pg_ctl.exe';
  PgData     := AppDir + '\pgsql\data';
  InitDb     := AppDir + '\pgsql\bin\initdb.exe';
  CreateDb   := AppDir + '\pgsql\bin\createdb.exe';
  Franken    := AppDir + '\frankenphp\frankenphp.exe';
  LaravelDir := AppDir + '\frankenphp\SuitAPI';
  PgPassFile := AppDir + '\pgsql\pgpass.txt';
  LogPath    := AppDir + '\install_log.txt';
  Password   := GetDbPassword('');
  AllOk      := True;

  // ----- 1. FIREWALL -----
  WizardForm.StatusLabel.Caption := 'Configurando firewall...';
  RunCmd('netsh advfirewall firewall add rule name="SuitAPI PostgreSQL (TCP)" dir=in action=allow protocol=TCP localport=5432 profile=private', 'FIREWALL-PG');
  RunCmd('netsh advfirewall firewall add rule name="SuitAPI Server (TCP)" dir=in action=allow protocol=TCP localport=8443 profile=private', 'FIREWALL-API');
  RunCmd('netsh advfirewall firewall add rule name="SuitAPI Discovery (UDP)" dir=in action=allow protocol=UDP localport=41234 profile=private', 'FIREWALL-UDP');

  // ----- 2. GENERAR .env -----
  if not IsUpgrade then
  begin
    WizardForm.StatusLabel.Caption := 'Generando archivo de configuración...';
    GenerateEnvFile;
  end else
    SaveStringToFile(LogPath, '[SKIP] .env conservado - instalación sobre versión existente' + #13#10, True);

  // ----- 3. INITDB (solo si no hay data dir previo) -----
  if ShouldRunInitDB then
  begin
    WizardForm.StatusLabel.Caption := 'Inicializando base de datos PostgreSQL...';

    // Escribir la contraseña al archivo temporal (sin trailing space/newline)
    SaveStringToFile(PgPassFile, Password, False);

    if not RunAndLog(InitDb,
         '-D "' + PgData + '" -U SuitApiBD --pwfile="' + PgPassFile + '" -A scram-sha-256',
         AppDir, 'INITDB') then
    begin
      AllOk := False;
    end;

    DeleteFile(PgPassFile);
  end else
  begin
    SaveStringToFile(LogPath,
      '[SKIP] initdb omitido - ya existe data dir' + #13#10, True);
  end;

  // ----- 4. ARRANCAR POSTGRESQL (ejecución directa, igual que la versión vieja) -----
  WizardForm.StatusLabel.Caption := 'Iniciando servidor PostgreSQL...';
  if not RunAndLog(PgCtl,
       'start -w -D "' + PgData + '"',
       AppDir, 'PG_CTL START') then
  begin
    AllOk := False;
    // Intentar mostrar el log de postgres para dar contexto
    SaveStringToFile(LogPath,
      '[INFO] Revisá el archivo pgsql\postgres.log para mas detalles del error.' + #13#10, True);
  end;

  // ----- 5. CREATEDB -----
  if AllOk and (not IsUpgrade) then
  begin
    WizardForm.StatusLabel.Caption := 'Creando base de datos suitapi...';

    // Seteamos PGPASSWORD en el entorno del proceso actual antes de llamar a createdb
    // Nota: Inno Setup no permite setear env vars directamente, así que usamos cmd /c
    // PERO solo para el set+createdb, con la ruta ya expandida.
    if not RunAndLog('cmd.exe',
         '/c set PGPASSWORD=' + Password + '&& "' + CreateDb + '" -h 127.0.0.1 -p 5432 -U SuitApiBD -w suitapi',
         AppDir, 'CREATEDB') then
    begin
      AllOk := False;
    end;
  end;

  // ----- 6. KEY GENERATE -----
  if IsUpgrade then
    SaveStringToFile(LogPath, '[SKIP] key:generate omitido - se conserva APP_KEY existente' + #13#10, True)
  else if AllOk then
  begin
    WizardForm.StatusLabel.Caption := 'Generando clave de aplicación...';
    if not RunAndLog(Franken,
         'php-cli artisan key:generate --force',
         LaravelDir, 'KEY_GENERATE') then
    begin
      AllOk := False;
    end;
  end;

  // ----- 7. MIGRACIONES -----
  if AllOk then
  begin
    WizardForm.StatusLabel.Caption := 'Ejecutando migraciones de base de datos...';
    // En upgrade: migrate sin seed por defecto, salvo que el usuario lo haya pedido explícitamente.
    // En instalación nueva: siempre migrate + seed.
    if IsUpgrade then
    begin
      if RunSeedPage.SelectedValueIndex = 1 then
      begin
        SaveStringToFile(LogPath, '[INFO] Upgrade con seed solicitado por el usuario.' + #13#10, True);
        if not RunAndLog(Franken,
             'php-cli artisan migrate --force --seed --seeder=ProductionSeeder',
             LaravelDir, 'MIGRATE') then
          AllOk := False;
      end else
      begin
        SaveStringToFile(LogPath, '[INFO] Upgrade: ejecutando migrate sin seed.' + #13#10, True);
        if not RunAndLog(Franken,
             'php-cli artisan migrate --force',
             LaravelDir, 'MIGRATE') then
          AllOk := False;
      end;
    end else
    begin
      if not RunAndLog(Franken,
           'php-cli artisan migrate --force --seed --seeder=ProductionSeeder',
           LaravelDir, 'MIGRATE') then
        AllOk := False;
    end;
    if FileExists(AppDir + '\migrate_out.txt') then
    begin
      SaveStringToFile(LogPath, '--- OUTPUT MIGRATE ---' + #13#10, True);
      RunCmd('type "' + AppDir + '\migrate_out.txt" >> "' + LogPath + '"', 'MIGRATE_OUTPUT');
      DeleteFile(AppDir + '\migrate_out.txt');
    end;
  end else
  begin
    if IsUpgrade then
      SaveStringToFile(LogPath, '[SKIP] migrate omitido por error previo.' + #13#10, True);
  end;

  // ----- 8. APAGAR POSTGRESQL -----
  WizardForm.StatusLabel.Caption := 'Deteniendo servidor PostgreSQL...';
  RunAndLog(PgCtl,
    'stop -m fast -D "' + PgData + '"',
    AppDir, 'PG_CTL STOP');
end;

// ================================================================
//  EVENTOS DEL INSTALADOR
// ================================================================
procedure CurStepChanged(CurStep: TSetupStep);
var
  LogPath: String;
  LogContent: TArrayOfString;
  HasErrors: Boolean;
  i: Integer;
begin
  // Ejecutar la instalación de DB + APIs después de copiar archivos
  if CurStep = ssPostInstall then
  begin
    DoPostInstall;
  end;

  if CurStep = ssDone then
  begin
    LogPath := ExpandConstant('{app}\install_log.txt');
    HasErrors := False;

    if FileExists(LogPath) then
    begin
      if LoadStringsFromFile(LogPath, LogContent) then
      begin
        for i := 0 to GetArrayLength(LogContent) - 1 do
        begin
          if Pos('[ERROR]', LogContent[i]) > 0 then
          begin
            HasErrors := True;
          end;
        end;
      end;
    end;

    if HasErrors then
      MsgBox(
        'La instalación finalizó con errores.' + #13#10#13#10 +
        'Revisá el archivo de log completo en:' + #13#10 + LogPath,
        mbError,
        MB_OK
      );
    // Si no hubo errores, no mostramos nada — Inno Setup ya muestra su pantalla final.
  end;
end;

// ================================================================
//  INICIALIZACIÓN: Detección temprana de instalación previa
// ================================================================
// Se ejecuta ANTES de cualquier página del wizard.
// Si hay una instalación previa, ofrece: Actualizar / Nueva carpeta / Cancelar.
function InitializeSetup(): Boolean;
var
  Choice: Integer;
begin
  Result := True;
  IsUpgrade := False;
  PreviousInstallDir := '';
  InstallVCRedist := not IsVCRedistX64Installed;

  // --- Detección de instalación previa vía registro ---
  if FindPreviousInstall(PreviousInstallDir) then
  begin
    Choice := MsgBox(
      'Se detectó una instalación existente de SuitAPI en:' + #13#10 +
      PreviousInstallDir + #13#10#13#10 +
      'Podés actualizar la instalación existente (se conservan la base de datos,' + #13#10 +
      'el archivo de configuración y el almacenamiento), o instalar una copia' + #13#10 +
      'nueva e independiente en otra carpeta.' + #13#10#13#10 +
      '¿Querés ACTUALIZAR la instalación existente?' + #13#10#13#10 +
      'Sí = Actualizar    /    No = Instalar en otra carpeta',
      mbConfirmation, MB_YESNOCANCEL
    );

    if Choice = IDYES then
    begin
      // Actualizar: marcar como upgrade, el directorio se fija en InitializeWizard
      IsUpgrade := True;
    end
    else if Choice = IDNO then
    begin
      // Instalación nueva en otra carpeta: flujo normal completo
      IsUpgrade := False;
      PreviousInstallDir := '';
    end
    else
    begin
      // Cancelar: cerrar el instalador
      Result := False;
      Exit;
    end;
  end;

  // --- Chequeo de puerto 5432 ---
  if IsPort5432InUse then
  begin
    if MsgBox(
      'Se detectó que el puerto 5432 ya está en uso.' + #13#10 +
      'Puede haber otra instancia de PostgreSQL corriendo.' + #13#10#13#10 +
      'Si es una instalación previa de SuitAPI, ciérrela primero.' + #13#10#13#10 +
      '¿Desea continuar de todas formas?',
      mbConfirmation,
      MB_YESNO
    ) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;

  // --- Chequeo de VC++ Redistributable ---
  if InstallVCRedist then
  begin
    if MsgBox(
      'No se detectó Microsoft Visual C++ Redistributable 2015-2022 (x64).' + #13#10#13#10 +
      'Este componente es necesario para ejecutar PostgreSQL.' + #13#10#13#10 +
      '¿Desea instalarlo ahora?',
      mbConfirmation,
      MB_YESNO
    ) = IDNO then
    begin
      MsgBox(
        'La instalación se cancelará porque PostgreSQL necesita Visual C++ Redistributable.',
        mbCriticalError,
        MB_OK
      );
      Result := False;
      Exit;
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
  LogPath: String;
  LogContent: TArrayOfString;
  HasErrors: Boolean;
  i: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    Exec('cmd.exe', '/c taskkill /F /IM SuitAPI.exe 2>nul', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec('cmd.exe', '/c taskkill /F /IM frankenphp.exe 2>nul', '',
         SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Borrar el log de instalación solo si no hubo errores
    LogPath := ExpandConstant('{app}\install_log.txt');
    HasErrors := False;
    if FileExists(LogPath) then
    begin
      if LoadStringsFromFile(LogPath, LogContent) then
      begin
        for i := 0 to GetArrayLength(LogContent) - 1 do
        begin
          if Pos('[ERROR]', LogContent[i]) > 0 then
          begin
            HasErrors := True;
            Break;
          end;
        end;
      end;
    end;

    if not HasErrors then
      DeleteFile(LogPath);
    // Si hubo errores, el log queda en {app}\install_log.txt para diagnóstico
  end;
end;
