// ===============================
// PROTEÇÃO
// ===============================
  function protegerRange(sheet, rangeA1){
    const range = sheet.getRange(rangeA1);
    const prot = range.protect();

    prot.setDescription(`Protegido pelo sistema`);
    prot.removeEditors(prot.getEditors());

    if(prot.canDomainEdit()){
      prot.setDomainEdit(false);
    }
  }
  function protegerAbaInteira(nome){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(nome);
    if(!sh) return;

    const range = sh.getDataRange();
    const prot = range.protect();

    prot.setDescription(`Aba ${nome} protegida pelo sistema`);
    prot.removeEditors(prot.getEditors());

    if(prot.canDomainEdit()){
      prot.setDomainEdit(false);
    }
  }
