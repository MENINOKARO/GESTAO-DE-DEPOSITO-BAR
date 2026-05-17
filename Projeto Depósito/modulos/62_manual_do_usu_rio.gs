// ===============================
// MANUAL DO USUÁRIO
// ===============================
  function abrirManualSistema(){

    // 🔗 ID do PDF no Google Drive
    const PDF_ID = '1u7Srgo_G6C4nRjZlP1VMcVg92KkiGnDw';

    const url = `https://drive.google.com/file/d/1u7Srgo_G6C4nRjZlP1VMcVg92KkiGnDw/view`;
    const html = `
      <html>
        <head>
          <style>
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: #020617;
            }

            .header {
              background: #020617;
              color: white;
              padding: 10px;
              text-align: center;
              font-weight: bold;
              font-size: 14px;
            }

            iframe {
              width: 100%;
              height: calc(100vh - 40px);
              border: none;
            }
          </style>
        </head>

        <body>
          <div class="header">
            📘 Manual do Sistema — Gestão de Depósito v1.0
          </div>

          <iframe src="${url}"></iframe>
        </body>
      </html>
    `;

    const ui = HtmlService
      .createHtmlOutput(html)
      .setWidth(900)
      .setHeight(650);

    SpreadsheetApp.getUi()
      .showModalDialog(ui, '📘 Manual do Sistema');
  }
