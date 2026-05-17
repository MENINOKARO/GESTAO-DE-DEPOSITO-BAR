      // =========================
      // 7️⃣ RENOVA SENHA DE RESET (sempre)
      // =========================
      const props = PropertiesService.getScriptProperties();

      // 🔄 limpa senha atual e força padrão + troca obrigatória
      props.deleteProperty('SENHA_RESET');
      props.setProperty('RESET_SENHA_OBRIGATORIA', 'SIM');

      if(typeof garantirSenhaResetObrigatoria === 'function'){
        garantirSenhaResetObrigatoria();
      } else {
        props.setProperty('SENHA_RESET', SENHA_RESET_PADRAO);
      }

