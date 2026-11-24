import type { CategoriaRelatorio } from '../types/domain';
import { obterSubpastaMesAtual } from '../utils/formatters';

export interface LocalFolderStatus {
  suportado: boolean;
  conectado: boolean;
  nomePasta: string;
}

export interface LocalFolderAdapter {
  suportado(): boolean;
  conectarPasta(nomeEmpresa: string): Promise<LocalFolderStatus>;
  obterStatus(): Promise<LocalFolderStatus>;
  desconectar(): Promise<void>;
  garantirEstruturaPastas(nomeEmpresa: string, mesRef?: string): Promise<boolean>;
  salvarArquivo(subCaminho: string[], nomeArquivo: string, conteudo: Blob | string): Promise<{ ok: boolean; msg: string }>;
}

interface DirectoryHandleExtended extends FileSystemDirectoryHandle {
  queryPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

const IDB_NAME = 'gn360_local_fs';
const IDB_STORE = 'handles';
const IDB_KEY = 'root_dir';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleIdb(handle: DirectoryHandleExtended): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // fallback silently
  }
}

async function loadHandleIdb(): Promise<DirectoryHandleExtended | null> {
  try {
    const db = await openIdb();
    const res = await new Promise<DirectoryHandleExtended | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve((req.result as DirectoryHandleExtended) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return res;
  } catch {
    return null;
  }
}

async function clearHandleIdb(): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

let activeRootHandle: DirectoryHandleExtended | null = null;

function sanitizeSegment(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Padrao';
}

async function ensureDirPath(
  root: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const seg of segments) {
    const clean = sanitizeSegment(seg);
    current = await current.getDirectoryHandle(clean, { create: true });
  }
  return current;
}

async function resolveGrantedHandle(): Promise<DirectoryHandleExtended | null> {
  const handle = activeRootHandle || (await loadHandleIdb());
  if (!handle) return null;

  if (typeof handle.queryPermission === 'function') {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      activeRootHandle = handle;
      return handle;
    }
    if (perm === 'prompt' && typeof handle.requestPermission === 'function') {
      const req = await handle.requestPermission({ mode: 'readwrite' });
      if (req === 'granted') {
        activeRootHandle = handle;
        return handle;
      }
    }
    return null;
  }
  activeRootHandle = handle;
  return handle;
}

class BrowserFileSystemAdapter implements LocalFolderAdapter {
  suportado(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  async obterStatus(): Promise<LocalFolderStatus> {
    if (!this.suportado()) {
      return { suportado: false, conectado: false, nomePasta: '' };
    }
    const cached = activeRootHandle || (await loadHandleIdb());
    if (!cached) {
      return { suportado: true, conectado: false, nomePasta: '' };
    }
    let granted = true;
    if (typeof cached.queryPermission === 'function') {
      granted = (await cached.queryPermission({ mode: 'readwrite' })) === 'granted';
    }
    return {
      suportado: true,
      conectado: granted,
      nomePasta: cached.name
    };
  }

  async conectarPasta(nomeEmpresa: string): Promise<LocalFolderStatus> {
    if (!this.suportado()) {
      throw new Error('Seu navegador não suporta gravação direta em pasta local. Utilize Chrome, Edge ou o app desktop.');
    }
    const picker = (window as unknown as {
      showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<DirectoryHandleExtended>;
    }).showDirectoryPicker;

    const handle = await picker({ mode: 'readwrite', id: 'gn360-raiz' });
    activeRootHandle = handle;
    await saveHandleIdb(handle);
    await this.garantirEstruturaPastas(nomeEmpresa);
    return {
      suportado: true,
      conectado: true,
      nomePasta: handle.name
    };
  }

  async desconectar(): Promise<void> {
    activeRootHandle = null;
    await clearHandleIdb();
  }

  async garantirEstruturaPastas(nomeEmpresa: string, mesRef?: string): Promise<boolean> {
    const root = await resolveGrantedHandle();
    if (!root) return false;

    const empresaPasta = sanitizeSegment(nomeEmpresa || 'Gestao de Negocios');
    const subMes = mesRef || obterSubpastaMesAtual();
    const agora = new Date();
    const ano = String(agora.getFullYear());
    const mes = String(agora.getMonth() + 1).padStart(2, '0');

    const base = await ensureDirPath(root, [empresaPasta]);
    const categorias: CategoriaRelatorio[] = ['Financeiro', 'Estoque', 'Compras', 'Auditoria_Logs'];
    for (const cat of categorias) {
      await ensureDirPath(base, ['Relatorios', cat, subMes]);
    }
    await ensureDirPath(base, ['Compras', 'Notas', ano, mes]);
    await ensureDirPath(base, ['Backup']);
    await ensureDirPath(base, ['Logs', 'PDF']);
    return true;
  }

  async salvarArquivo(
    subCaminho: string[],
    nomeArquivo: string,
    conteudo: Blob | string
  ): Promise<{ ok: boolean; msg: string }> {
    const root = await resolveGrantedHandle();
    if (!root) {
      return {
        ok: false,
        msg: 'Nenhuma pasta local conectada (ou permissão expirada). Conecte a pasta em Configurações.'
      };
    }

    const dir = await ensureDirPath(root, subCaminho);
    const nomeLimpo = sanitizeSegment(nomeArquivo);
    const fileHandle = await dir.getFileHandle(nomeLimpo, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(conteudo);
    await writable.close();

    return {
      ok: true,
      msg: `Arquivo salvo em ${subCaminho.join('/')}/${nomeLimpo}`
    };
  }
}

export const localFolderService: LocalFolderAdapter = new BrowserFileSystemAdapter();

export async function salvarArquivoNaPastaLocal(
  nomeEmpresa: string,
  categoria: CategoriaRelatorio | 'Backup' | 'Notas',
  subpastaMes: string,
  nomeArquivo: string,
  blob: Blob | string
): Promise<{ ok: boolean; msg: string }> {
  const empSeg = sanitizeSegment(nomeEmpresa || 'Gestao de Negocios');
  const caminho =
    categoria === 'Backup'
      ? [empSeg, 'Backup']
      : categoria === 'Notas'
      ? [empSeg, 'Compras', 'Notas', subpastaMes]
      : [empSeg, 'Relatorios', categoria, subpastaMes];

  return localFolderService.salvarArquivo(caminho, nomeArquivo, blob);
}
