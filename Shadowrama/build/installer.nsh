; Thème Shadowrama pour la fenêtre d'installation (NSIS oneClick).
; Palette reprise de src/styles/theme.css : fond #0f1020, panneau #15162a,
; accent #7c6cff, texte #f2f1fb. NSIS attend les couleurs en RGB hexadécimal.

!define SR_BG      0x0f1020
!define SR_TEXT    0xf2f1fb
!define SR_MUTED   0x9a9cc0
!define SR_ACCENT  0x7c6cff
!define SR_TRACK   0x23254a
; PBM_* attendent du BGR (COLORREF), pas du RGB
!define SR_ACCENT_BGR 0xff6c7c
!define SR_TRACK_BGR  0x4a2523
!define SR_PBM_SETBARCOLOR 0x0409
!define SR_PBM_SETBKCOLOR  0x2001

!macro customHeader
!ifndef BUILD_UNINSTALLER
  ; Fonts du thème : Segoe UI est toujours présent sous Windows 10/11.
  BrandingText "Shadowrama"

  ; Appelée depuis la section d'installation, quand la page de progression existe.
  Function SRThemeInstFiles
    SetCtlColors $HWNDPARENT ${SR_TEXT} ${SR_BG}
    ; Barre de titre sombre (Windows 10 1809+ / 11), ignorée sinon
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 20, *i 1, i 4)'
    System::Call 'dwmapi::DwmSetWindowAttribute(i $HWNDPARENT, i 35, *i 0x20100f, i 4)'
    FindWindow $0 "#32770" "" $HWNDPARENT
    ; Fond + texte de la page
    SetCtlColors $0 ${SR_TEXT} ${SR_BG}
    ; Texte d'état (1006) et liste de détails (1016)
    GetDlgItem $1 $0 1006
    SetCtlColors $1 ${SR_MUTED} ${SR_BG}
    GetDlgItem $1 $0 1016
    SetCtlColors $1 ${SR_MUTED} ${SR_BG}
    ; Barre de progression : on retire le thème visuel pour pouvoir la colorer
    GetDlgItem $1 $0 1004
    System::Call 'uxtheme::SetWindowTheme(i $1, w "", w "")'
    SendMessage $1 ${SR_PBM_SETBARCOLOR} 0 ${SR_ACCENT_BGR}
    SendMessage $1 ${SR_PBM_SETBKCOLOR} 0 ${SR_TRACK_BGR}
  FunctionEnd
!endif
!macroend

!macro customInstall
  !ifndef BUILD_UNINSTALLER
    Call SRThemeInstFiles
  !endif
!macroend
