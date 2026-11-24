import type { CategoriaRelatorio, PainelSnapshot } from '../types/domain';
import { formatarDataHoraBr, formatarMoeda, obterSubpastaMesAtual } from '../utils/formatters';

const SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

const STORAGE_CLIENT_ID = 'gn360_google_client_id';
const STORAGE_META_PREFIX = 'gn360_drive_meta_';
const SESSION_TOKEN_KEY = 'gn360_google_oauth_token';

interface DriveEmpresaMeta {
  rootFolderId: string;
  rootFolderUrl: string;
  planilhaId: string;
  planilhaUrl: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: GoogleTokenResponse) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

export function getGoogleClientId(): string {
  const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  if (envId) return envId;
  return (localStorage.getItem(STORAGE_CLIENT_ID) || '').trim();
}

export function saveGoogleClientId(clientId: string): void {
  const clean = String(clientId || '').trim();
  if (!clean) {
    localStorage.removeItem(STORAGE_CLIENT_ID);
  } else {
    localStorage.setItem(STORAGE_CLIENT_ID, clean);
  }
}

export function getDriveMetaEmpresa(empresaId: string): DriveEmpresaMeta {
  try {
    const raw = localStorage.getItem(STORAGE_META_PREFIX + empresaId);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DriveEmpresaMeta>;
      return {
        rootFolderId: parsed.rootFolderId || '',
        rootFolderUrl: parsed.rootFolderUrl || '',
        planilhaId: parsed.planilhaId || '',
        planilhaUrl: parsed.planilhaUrl || ''
      };
    }
  } catch {
    // ignore
  }
  return { rootFolderId: '', rootFolderUrl: '', planilhaId: '', planilhaUrl: '' };
}

function saveDriveMetaEmpresa(empresaId: string, meta: DriveEmpresaMeta): void {
  localStorage.setItem(STORAGE_META_PREFIX + empresaId, JSON.stringify(meta));
}

function getActiveOAuthToken(): string {
  try {
    const raw = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { token: string; exp: number };
    if (parsed.exp > Date.now() + 30000) return parsed.token;
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignore
  }
  return '';
}

export function isGoogleDriveConectado(): boolean {
  return Boolean(getActiveOAuthToken());
}

export function desconectarGoogleDrive(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

async function fetchGoogleJson<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Google API (${resp.status}): ${txt}`);
  }
  return (await resp.json()) as T;
}

async function obterOuCriarPastaDrive(
  token: string,
  nome: string,
  parentId?: string
): Promise<string> {
  const nomeEscaped = nome.replace(/'/g, "\\'");
  const qParent = parentId ? ` and '${parentId}' in parents` : ` and 'root' in parents`;
  const q = encodeURIComponent(
    `name='${nomeEscaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false${qParent}`
  );
  const search = await fetchGoogleJson<{ files?: Array<{ id: string }> }>(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`,
    token
  );
  if (search.files && search.files.length > 0) {
    return search.files[0].id;
  }

  const created = await fetchGoogleJson<{ id: string }>(
    'https://www.googleapis.com/drive/v3/files',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {})
      })
    }
  );
  return created.id;
}

async function garantirEstruturaDriveEmpresa(
  token: string,
  empresaId: string,
  nomeEmpresa: string
): Promise<DriveEmpresaMeta> {
  const metaAtual = getDriveMetaEmpresa(empresaId);
  const nomePastaRaiz = `Gestão de Negócios 360 - ${nomeEmpresa || 'Empresa'}`;
  const rootId = metaAtual.rootFolderId || (await obterOuCriarPastaDrive(token, nomePastaRaiz));
  const rootUrl = `https://drive.google.com/drive/folders/${rootId}`;

  const relId = await obterOuCriarPastaDrive(token, 'Relatorios', rootId);
  const mesAtual = obterSubpastaMesAtual();
  const categorias: CategoriaRelatorio[] = ['Financeiro', 'Estoque', 'Compras', 'Auditoria_Logs'];
  for (const cat of categorias) {
    const catId = await obterOuCriarPastaDrive(token, cat, relId);
    await obterOuCriarPastaDrive(token, mesAtual, catId);
  }

  const comprasId = await obterOuCriarPastaDrive(token, 'Compras', rootId);
  const notasId = await obterOuCriarPastaDrive(token, 'Notas', comprasId);
  const anoStr = String(new Date().getFullYear());
  const mesStr = String(new Date().getMonth() + 1).padStart(2, '0');
  const anoId = await obterOuCriarPastaDrive(token, anoStr, notasId);
  await obterOuCriarPastaDrive(token, mesStr, anoId);

  await obterOuCriarPastaDrive(token, 'Backup', rootId);
  const logsId = await obterOuCriarPastaDrive(token, 'Logs', rootId);
  await obterOuCriarPastaDrive(token, 'PDF', logsId);

  let planilhaId = metaAtual.planilhaId;
  if (!planilhaId) {
    const sheetsTitulos = ['PRODUTOS', 'ESTOQUE', 'VENDAS', 'CAIXA', 'FINANCEIRO', 'CLIENTES'];
    const ssCreated = await fetchGoogleJson<{ spreadsheetId: string }>(
      'https://sheets.googleapis.com/v4/spreadsheets',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          properties: { title: (nomeEmpresa || 'Gestão de Negócios 360°').trim() },
          sheets: sheetsTitulos.map((title) => ({ properties: { title } }))
        })
      }
    );
    planilhaId = ssCreated.spreadsheetId;

    // Move a planilha espelho limpa para dentro da pasta raiz do usuário
    await fetchGoogleJson(
      `https://www.googleapis.com/drive/v3/files/${planilhaId}?addParents=${rootId}`,
      token,
      { method: 'PATCH', body: JSON.stringify({}) }
    );
  }

  const metaNova: DriveEmpresaMeta = {
    rootFolderId: rootId,
    rootFolderUrl: rootUrl,
    planilhaId,
    planilhaUrl: `https://docs.google.com/spreadsheets/d/${planilhaId}`
  };
  saveDriveMetaEmpresa(empresaId, metaNova);
  return metaNova;
}

export async function conectarGoogleDriveOAuth(
  empresaId: string,
  nomeEmpresa: string
): Promise<{ ok: boolean; msg: string; meta?: DriveEmpresaMeta }> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    return {
      ok: false,
      msg: 'Informe seu Google OAuth Client ID (Web) nas configurações para conectar ao Google Drive.'
    };
  }

  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    return {
      ok: false,
      msg: 'Biblioteca Google Identity Services ainda não carregou ou está offline.'
    };
  }

  const token = await new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'Autorização Google Drive cancelada.'));
          return;
        }
        const exp = Date.now() + (Number(resp.expires_in || 3600) * 1000);
        sessionStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify({ token: resp.access_token, exp }));
        resolve(resp.access_token);
      }
    });
    client.requestAccessToken({ prompt: 'consent' });
  });

  const meta = await garantirEstruturaDriveEmpresa(token, empresaId, nomeEmpresa);
  return {
    ok: true,
    msg: 'Google Drive conectado! Estrutura de pastas e Planilha Espelho Limpa (sem código) prontas.',
    meta
  };
}

export async function sincronizarPlanilhaEspelhoLimpa(
  empresaId: string,
  snapshot: PainelSnapshot
): Promise<{ ok: boolean; msg: string; planilhaUrl?: string }> {
  const token = getActiveOAuthToken();
  if (!token) {
    return { ok: false, msg: 'Conecte primeiro sua conta Google Drive na aba Configurações.' };
  }

  const meta = await garantirEstruturaDriveEmpresa(token, empresaId, snapshot.empresa.nome);

  const abasDados: Array<{ range: string; values: (string | number)[][] }> = [
    {
      range: 'PRODUTOS!A1',
      values: [
        ['ID', 'Nome', 'Categoria', 'Marca', 'Volume', 'Preço Venda', 'Custo Médio', 'Estoque Atual', 'Estoque Mínimo'],
        ...snapshot.produtos.map((p) => [
          p.id,
          p.nome,
          p.categoria,
          p.marca,
          p.volume,
          p.preco_venda,
          p.custo_medio,
          p.estoque_atual,
          p.estoque_minimo
        ])
      ]
    },
    {
      range: 'ESTOQUE!A1',
      values: [
        ['Produto', 'Quantidade Atual', 'Estoque Mínimo', 'Valor Custo Total', 'Valor Venda Total', 'Status'],
        ...snapshot.produtos.map((p) => [
          p.nome,
          p.estoque_atual,
          p.estoque_minimo,
          Number((p.estoque_atual * p.custo_medio).toFixed(2)),
          Number((p.estoque_atual * p.preco_venda).toFixed(2)),
          p.estoque_atual <= 0 ? 'ZERADO' : p.estoque_atual <= p.estoque_minimo ? 'BAIXO' : 'OK'
        ])
      ]
    },
    {
      range: 'VENDAS!A1',
      values: [
        ['Data/Hora', 'Pedido', 'Produto', 'Quantidade', 'Valor Total', 'Pagamento', 'Origem', 'Cliente', 'Vendedor'],
        ...snapshot.vendas.map((v) => [
          formatarDataHoraBr(v.data_hora),
          v.pedido_id,
          v.produto_nome,
          v.quantidade,
          v.valor_total,
          v.forma_pagamento,
          v.origem,
          v.cliente_nome || '--',
          v.vendedor || '--'
        ])
      ]
    },
    {
      range: 'CAIXA!A1',
      values: [
        ['Data/Hora', 'Tipo', 'Valor', 'Forma Pagamento', 'Descrição', 'Origem', 'Operador'],
        ...snapshot.caixa.map((c) => [
          formatarDataHoraBr(c.data_hora),
          c.tipo,
          c.valor,
          c.forma_pagamento,
          c.descricao,
          c.origem,
          c.operador
        ])
      ]
    },
    {
      range: 'FINANCEIRO!A1',
      values: [
        ['Tipo', 'Descrição / Cliente', 'Categoria / Origem', 'Valor', 'Vencimento / Data', 'Status'],
        ...snapshot.contasPagar.map((cp) => [
          'A PAGAR',
          cp.descricao,
          cp.fornecedor || cp.categoria,
          cp.valor,
          cp.vencimento,
          cp.status
        ]),
        ...snapshot.contasReceber.map((cr) => [
          'A RECEBER',
          cr.cliente,
          cr.descricao,
          cr.valor,
          formatarDataHoraBr(cr.data),
          cr.status
        ])
      ]
    },
    {
      range: 'CLIENTES!A1',
      values: [
        ['ID', 'Nome', 'Telefone', 'Endereço', 'Limite Fiado', 'Saldo Devedor', 'Status'],
        ...snapshot.clientes.map((cl) => [
          cl.id,
          cl.nome,
          cl.telefone,
          cl.endereco,
          cl.limite_fiado,
          formatarMoeda(cl.saldo_devedor),
          cl.status
        ])
      ]
    }
  ];

  // Limpa ranges anteriores e atualiza com os dados espelhados do sistema
  await fetchGoogleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${meta.planilhaId}/values:batchClear`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        ranges: ['PRODUTOS!A:Z', 'ESTOQUE!A:Z', 'VENDAS!A:Z', 'CAIXA!A:Z', 'FINANCEIRO!A:Z', 'CLIENTES!A:Z']
      })
    }
  );

  await fetchGoogleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${meta.planilhaId}/values:batchUpdate`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: abasDados
      })
    }
  );

  return {
    ok: true,
    msg: 'Planilha Espelho (100% limpa, zero Apps Script) sincronizada no seu Google Drive!',
    planilhaUrl: meta.planilhaUrl
  };
}

export async function enviarPdfParaGoogleDrive(
  empresaId: string,
  nomeEmpresa: string,
  categoria: CategoriaRelatorio,
  subpastaMes: string,
  nomeArquivo: string,
  blob: Blob
): Promise<{ ok: boolean; msg: string; fileUrl?: string }> {
  const token = getActiveOAuthToken();
  if (!token) {
    return { ok: false, msg: 'Conecte sua conta Google Drive na aba Configurações para enviar arquivos à nuvem.' };
  }

  const meta = await garantirEstruturaDriveEmpresa(token, empresaId, nomeEmpresa);
  const relId = await obterOuCriarPastaDrive(token, 'Relatorios', meta.rootFolderId);
  const catId = await obterOuCriarPastaDrive(token, categoria, relId);
  const mesId = await obterOuCriarPastaDrive(token, subpastaMes, catId);

  const form = new FormData();
  form.append(
    'metadata',
    new Blob(
      [
        JSON.stringify({
          name: nomeArquivo,
          parents: [mesId],
          mimeType: 'application/pdf'
        })
      ],
      { type: 'application/json' }
    )
  );
  form.append('file', blob);

  const resp = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    }
  );

  if (!resp.ok) {
    const txt = await resp.text();
    return { ok: false, msg: `Falha ao enviar para o Drive (${resp.status}): ${txt}` };
  }

  const data = (await resp.json()) as { id: string; webViewLink?: string };
  return {
    ok: true,
    msg: `PDF salvo no Google Drive em Relatorios/${categoria}/${subpastaMes}!`,
    fileUrl: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`
  };
}
