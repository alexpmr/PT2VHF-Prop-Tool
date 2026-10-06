Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
Name "PT2VHF Prop Tool"
OutFile "${OUTPUT}"
RequestExecutionLevel user
SetCompressor zlib
VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=1046 "ProductName" "PT2VHF Prop Tool"
VIAddVersionKey /LANG=1046 "FileDescription" "PT2VHF Prop Tool"
VIAddVersionKey /LANG=1046 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1046 "LegalCopyright" "Alex Rodrigues, PT2VHF"
!ifdef PORTABLE
  SilentInstall silent
  AutoCloseWindow true
  Section
    InitPluginsDir
    SetOutPath "$PLUGINSDIR\app"
    File /r "${APP_FILES}"
    System::Call 'kernel32::SetEnvironmentVariable(t "PORTABLE_EXECUTABLE_DIR", t "$EXEDIR") i.r0'
    System::Call 'kernel32::SetEnvironmentVariable(t "PORTABLE_EXECUTABLE_FILE", t "$EXEPATH") i.r0'
    System::Call 'kernel32::GetCurrentProcessId() i.r0'
    System::Call 'kernel32::SetEnvironmentVariable(t "PORTABLE_LAUNCHER_PID", t r0) i.r1'
    ${GetParameters} $0
    ExecWait '"$PLUGINSDIR\app\PT2VHF Prop Tool.exe" $0' $1
    SetErrorLevel $1
    SetOutPath "$TEMP"
    RMDir /r "$PLUGINSDIR\app"
  SectionEnd
!else
  InstallDir "$LOCALAPPDATA\Programs\PT2VHF Prop Tool"
  InstallDirRegKey HKCU "Software\PT2VHF\PropTool" "InstallDir"
  !define MUI_ABORTWARNING
  !define MUI_FINISHPAGE_RUN "$INSTDIR\PT2VHF Prop Tool.exe"
  !insertmacro MUI_PAGE_WELCOME
  !insertmacro MUI_PAGE_DIRECTORY
  !insertmacro MUI_PAGE_INSTFILES
  !insertmacro MUI_PAGE_FINISH
  !insertmacro MUI_UNPAGE_CONFIRM
  !insertmacro MUI_UNPAGE_INSTFILES
  !define MUI_LANGDLL_REGISTRY_ROOT HKCU
  !define MUI_LANGDLL_REGISTRY_KEY "Software\PT2VHF\PropTool"
  !define MUI_LANGDLL_REGISTRY_VALUENAME "InstallerLanguage"
  !insertmacro MUI_LANGUAGE "PortugueseBR"
  !insertmacro MUI_LANGUAGE "English"
  !insertmacro MUI_LANGUAGE "Spanish"
  !insertmacro MUI_LANGUAGE "French"
  !insertmacro MUI_LANGUAGE "German"
  !insertmacro MUI_LANGUAGE "Italian"
  Function .onInit
    IfSilent skipLanguage
    !insertmacro MUI_LANGDLL_DISPLAY
    skipLanguage:
  FunctionEnd
  Section "Aplicativo"
    SetShellVarContext current
    SetOutPath "$INSTDIR"
    File /r "${APP_FILES}"
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "Software\PT2VHF\PropTool" "InstallDir" "$INSTDIR"
    CreateDirectory "$SMPROGRAMS\PT2VHF Prop Tool"
    CreateShortcut "$SMPROGRAMS\PT2VHF Prop Tool\PT2VHF Prop Tool.lnk" "$INSTDIR\PT2VHF Prop Tool.exe"
    CreateShortcut "$DESKTOP\PT2VHF Prop Tool.lnk" "$INSTDIR\PT2VHF Prop Tool.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PT2VHFPropTool" "DisplayName" "PT2VHF Prop Tool"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PT2VHFPropTool" "DisplayVersion" "${VERSION}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PT2VHFPropTool" "Publisher" "Alex Rodrigues, PT2VHF"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PT2VHFPropTool" "UninstallString" '"$INSTDIR\Uninstall.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PT2VHFPropTool" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PT2VHFPropTool" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PT2VHFPropTool" "NoRepair" 1
  SectionEnd
  Function .onInstSuccess
    IfSilent 0 done
    ${GetParameters} $0
    ${GetOptions} $0 "--force-run" $1
    IfErrors done
    Exec '"$INSTDIR\PT2VHF Prop Tool.exe"'
    done:
  FunctionEnd
  Section "Uninstall"
    SetShellVarContext current
    !include "${UNINSTALL_INCLUDE}"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"
    Delete "$DESKTOP\PT2VHF Prop Tool.lnk"
    Delete "$SMPROGRAMS\PT2VHF Prop Tool\PT2VHF Prop Tool.lnk"
    RMDir "$SMPROGRAMS\PT2VHF Prop Tool"
    DeleteRegKey HKCU "Software\PT2VHF\PropTool"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PT2VHFPropTool"
  SectionEnd
!endif
