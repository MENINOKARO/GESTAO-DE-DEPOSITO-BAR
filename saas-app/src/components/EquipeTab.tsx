import { useState, type FormEvent } from 'react';
import {
  ChevronUp,
  KeyRound,
  Pencil,
  ShieldAlert,
  UserCheck,
  UserPlus,
  UserX,
  X
} from 'lucide-react';
import type { PerfilUsuario, SessaoAtiva, Usuario } from '../types/domain';
import {
  alternarStatusUsuario,
  criarUsuarioEquipe,
  editarUsuarioEquipe
} from '../services/dataRepository';

interface EquipeTabProps {
  sessao: SessaoAtiva;
  usuarios: Usuario[];
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
  onAtualizar: () => Promise<void>;
}

export function EquipeTab({ sessao, usuarios, onNotify, onAtualizar }: EquipeTabProps) {
  const isDonoOuAdmin = sessao.usuario.perfil === 'DONO' || sessao.usuario.perfil === 'ADMIN';
  const [busy, setBusy] = useState(false);

  // Painel expansível: + Novo Colaborador
  const [painelNovoAberto, setPainelNovoAberto] = useState(false);
  const [novoUsername, setNovoUsername] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<PerfilUsuario>('VENDEDOR');
  const [novaSenhaInicial, setNovaSenhaInicial] = useState('');

  // Modal Editar Colaborador
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPerfil, setEditPerfil] = useState<PerfilUsuario>('VENDEDOR');
  const [editAtivo, setEditAtivo] = useState(true);
  const [editNovaSenha, setEditNovaSenha] = useState('');

  // Modal Redefinir Senha (focado)
  const [usuarioSenhaModal, setUsuarioSenhaModal] = useState<Usuario | null>(null);
  const [senhaReset, setSenhaReset] = useState('');
  const [senhaResetConfirm, setSenhaResetConfirm] = useState('');

  function limparNovoForm() {
    setNovoUsername('');
    setNovoNome('');
    setNovoEmail('');
    setNovoPerfil('VENDEDOR');
    setNovaSenhaInicial('');
  }

  async function handleCriarColaborador(e: FormEvent) {
    e.preventDefault();
    if (!novoUsername.trim() || !novoNome.trim() || novaSenhaInicial.length < 4) {
      onNotify('Preencha usuário, nome e senha com mínimo de 4 caracteres.', 'warning');
      return;
    }

    setBusy(true);
    try {
      const res = await criarUsuarioEquipe(sessao, {
        username: novoUsername,
        nome: novoNome,
        email: novoEmail,
        perfil: novoPerfil,
        senha: novaSenhaInicial
      });
      if (res.ok) {
        limparNovoForm();
        setPainelNovoAberto(false);
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  function abrirModalEditar(u: Usuario) {
    setUsuarioEditando(u);
    setEditUsername(u.username);
    setEditNome(u.nome);
    setEditEmail(u.email || '');
    setEditPerfil(u.perfil);
    setEditAtivo(u.ativo !== false);
    setEditNovaSenha('');
  }

  async function handleSalvarEdicaoModal(e: FormEvent) {
    e.preventDefault();
    if (!usuarioEditando) return;
    if (!editUsername.trim()) {
      onNotify('Informe o usuário de acesso (login) do colaborador.', 'warning');
      return;
    }
    if (!editNome.trim()) {
      onNotify('Informe o nome completo do colaborador.', 'warning');
      return;
    }
    if (editNovaSenha.trim() && editNovaSenha.trim().length < 4) {
      onNotify('A nova senha deve ter no mínimo 4 caracteres.', 'warning');
      return;
    }

    setBusy(true);
    try {
      const res = await editarUsuarioEquipe(sessao, usuarioEditando, {
        username: editUsername.trim().toLowerCase(),
        nome: editNome,
        email: editEmail,
        perfil: editPerfil,
        ativo: editAtivo,
        novaSenha: editNovaSenha.trim() ? editNovaSenha.trim() : undefined
      });
      if (res.ok) {
        setUsuarioEditando(null);
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  function abrirModalSenha(u: Usuario) {
    setUsuarioSenhaModal(u);
    setSenhaReset('');
    setSenhaResetConfirm('');
  }

  async function handleRedefinirSenhaModal(e: FormEvent) {
    e.preventDefault();
    if (!usuarioSenhaModal) return;
    if (senhaReset.length < 4) {
      onNotify('A nova senha deve ter no mínimo 4 caracteres.', 'warning');
      return;
    }
    if (senhaReset !== senhaResetConfirm) {
      onNotify('A confirmação da senha não confere.', 'error');
      return;
    }

    setBusy(true);
    try {
      const res = await editarUsuarioEquipe(sessao, usuarioSenhaModal, {
        nome: usuarioSenhaModal.nome,
        email: usuarioSenhaModal.email || '',
        perfil: usuarioSenhaModal.perfil,
        ativo: usuarioSenhaModal.ativo !== false,
        novaSenha: senhaReset
      });
      if (res.ok) {
        setUsuarioSenhaModal(null);
        onNotify(`Senha de ${usuarioSenhaModal.nome} redefinida com sucesso!`, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAlternar(u: Usuario) {
    setBusy(true);
    try {
      const res = await alternarStatusUsuario(sessao, u);
      onNotify(res.msg, res.ok ? 'success' : 'error');
      await onAtualizar();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* CARD PRINCIPAL DA EQUIPE + BOTÃO EXPANSÍVEL */}
      <div className="panel-card">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 10
          }}
        >
          <div>
            <h3 style={{ fontSize: 16 }}>Equipe da Unidade ({usuarios.length})</h3>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <ShieldAlert size={14} color="#c4b5fd" />
              <span>
                Governança ativa: existe apenas 1 usuário ADMIN técnico no sistema. Cadastros aqui criam Vendedores, Gerentes ou Donos.
              </span>
            </div>
          </div>

          <button
            type="button"
            className={`btn ${painelNovoAberto ? '' : 'btn-primary'}`}
            onClick={() => setPainelNovoAberto((v) => !v)}
          >
            {painelNovoAberto ? <ChevronUp size={15} /> : <UserPlus size={15} />}
            <span>{painelNovoAberto ? 'Fechar Cadastro' : '➕ Novo Colaborador'}</span>
          </button>
        </div>

        {/* PAINEL EXPANSÍVEL: + NOVO COLABORADOR */}
        {painelNovoAberto && (
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.58)',
              border: '1px solid var(--border-accent)',
              borderRadius: 12,
              padding: 14,
              marginBottom: 16
            }}
          >
            <h4 style={{ fontSize: 14, marginBottom: 10, color: '#c4b5fd' }}>
              Cadastrar Novo Colaborador
            </h4>
            <form
              onSubmit={handleCriarColaborador}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 10
              }}
            >
              <div>
                <label className="field-label">Usuário de Acesso *</label>
                <input
                  className="field-input"
                  placeholder="Ex: joao.vendas"
                  value={novoUsername}
                  onChange={(e) => setNovoUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label">Nome Completo *</label>
                <input
                  className="field-input"
                  placeholder="Nome do colaborador"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label">E-mail</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="opcional@empresa.com"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Perfil</label>
                <select
                  className="field-select"
                  value={novoPerfil}
                  onChange={(e) => setNovoPerfil(e.target.value as PerfilUsuario)}
                >
                  <option value="VENDEDOR">Vendedor / Operador</option>
                  {isDonoOuAdmin && <option value="GERENTE">Gerente</option>}
                  {isDonoOuAdmin && <option value="DONO">Dono / Sócio</option>}
                </select>
              </div>
              <div>
                <label className="field-label">Senha Inicial *</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="Mínimo 4 caracteres"
                  minLength={4}
                  value={novaSenhaInicial}
                  onChange={(e) => setNovaSenhaInicial(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }} disabled={busy}>
                  <UserPlus size={14} /> {busy ? 'Salvando...' : 'Salvar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TABELA DA EQUIPE */}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.username}</td>
                  <td>{u.nome}</td>
                  <td>{u.email || '--'}</td>
                  <td>
                    <span className="badge badge-purple">{u.perfil}</span>
                  </td>
                  <td>
                    <span className={`badge ${u.ativo ? 'badge-ok' : 'badge-danger'}`}>
                      {u.ativo ? 'ATIVO' : 'BLOQUEADO'}
                    </span>
                  </td>
                  <td>
                    {u.perfil !== 'ADMIN' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '4px 9px', fontSize: 11.5 }}
                          onClick={() => abrirModalEditar(u)}
                          disabled={busy}
                          title="Editar dados, perfil e status"
                        >
                          <Pencil size={12} /> Editar
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '4px 9px', fontSize: 11.5 }}
                          onClick={() => abrirModalSenha(u)}
                          disabled={busy}
                          title="Redefinir senha rapidamente"
                        >
                          <KeyRound size={12} color="#fbbf24" /> Senha
                        </button>
                        <button
                          type="button"
                          className={`btn ${u.ativo ? 'btn-danger' : 'btn-success'}`}
                          style={{ padding: '4px 10px', fontSize: 11.5 }}
                          onClick={() => handleAlternar(u)}
                          disabled={busy}
                        >
                          {u.ativo ? <UserX size={13} /> : <UserCheck size={13} />}
                          <span>{u.ativo ? 'Bloquear' : 'Ativar'}</span>
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                        Conta raiz protegida
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL EDITAR COLABORADOR ================= */}
      {usuarioEditando && (
        <div className="modal-overlay" style={{ zIndex: 85 }}>
          <div className="panel-card" style={{ maxWidth: 480, width: '100%', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Pencil size={17} color="#c4b5fd" />
                <span>Editar Colaborador</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => setUsuarioEditando(null)}
              >
                <X size={15} />
              </button>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 11 }} onSubmit={handleSalvarEdicaoModal}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">ID Interno</label>
                  <input className="field-input" value={usuarioEditando.id} readOnly disabled />
                </div>
                <div>
                  <label className="field-label">Usuário (Login) *</label>
                  <input
                    className="field-input"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Nome Completo *</label>
                <input
                  className="field-input"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label">E-mail</label>
                <input
                  type="email"
                  className="field-input"
                  placeholder="opcional@empresa.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Perfil</label>
                  <select
                    className="field-select"
                    value={editPerfil}
                    onChange={(e) => setEditPerfil(e.target.value as PerfilUsuario)}
                  >
                    <option value="VENDEDOR">Vendedor / Operador</option>
                    {isDonoOuAdmin && <option value="GERENTE">Gerente</option>}
                    {isDonoOuAdmin && <option value="DONO">Dono / Sócio</option>}
                  </select>
                </div>

                <div>
                  <label className="field-label">Status</label>
                  <select
                    className="field-select"
                    value={editAtivo ? 'ATIVO' : 'BLOQUEADO'}
                    onChange={(e) => setEditAtivo(e.target.value === 'ATIVO')}
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="BLOQUEADO">BLOQUEADO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Nova Senha (opcional)</label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="Deixe vazio para manter a senha atual"
                  value={editNovaSenha}
                  onChange={(e) => setEditNovaSenha(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => setUsuarioEditando(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Salvando...' : '💾 Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL REDEFINIR SENHA (FOCADO) ================= */}
      {usuarioSenhaModal && (
        <div className="modal-overlay" style={{ zIndex: 85 }}>
          <div className="panel-card" style={{ maxWidth: 420, width: '100%', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <KeyRound size={17} color="#fbbf24" />
                <span>Redefinir Senha</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => setUsuarioSenhaModal(null)}
              >
                <X size={15} />
              </button>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleRedefinirSenhaModal}>
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.72)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 13
                }}
              >
                Colaborador: <strong>{usuarioSenhaModal.nome}</strong> (
                <span style={{ fontFamily: 'monospace' }}>{usuarioSenhaModal.username}</span>)
              </div>

              <div>
                <label className="field-label">Nova Senha (mín. 4 caracteres) *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  autoFocus
                  className="field-input"
                  placeholder="Digite a nova senha"
                  value={senhaReset}
                  onChange={(e) => setSenhaReset(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label">Confirmar Nova Senha *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  className="field-input"
                  placeholder="Repita a nova senha"
                  value={senhaResetConfirm}
                  onChange={(e) => setSenhaResetConfirm(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setUsuarioSenhaModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Atualizando...' : '🔑 Alterar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
