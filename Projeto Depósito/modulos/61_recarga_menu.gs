// ===============================
// RECARGA MENU
// ===============================
  function recarregarMenu() {
    SpreadsheetApp.getUi().alert('Menu atualizado!');
    onOpen();
  }

  /*
  * Abre tela de login/criar conta (seguro, sem restrição de permissão)
  */
    function telaLoginOuCriar() {
      popupTelaInicial();
    }

