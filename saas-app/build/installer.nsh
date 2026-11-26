!macro customCheckAppRunning
  ; Fecha silenciosamente o app caso esteja aberto, evitando falso positivo na janela do instalador
  nsExec::ExecToLog 'taskkill /F /IM "Gestao de Negocios 360.exe" /T'
!macroend
