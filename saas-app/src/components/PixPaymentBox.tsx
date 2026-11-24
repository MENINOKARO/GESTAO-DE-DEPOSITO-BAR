import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, QrCode } from 'lucide-react';
import { gerarPixCopiaCola, normalizarChavePixBCB } from '../utils/pixPayload';
import { formatarMoeda } from '../utils/formatters';

interface PixPaymentBoxProps {
  chavePix?: string;
  donoNome?: string;
  nomeRecebedor: string;
  cidade?: string;
  valor: number;
  txid?: string;
  mostrarQrPorPadrao?: boolean;
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
}

export function PixPaymentBox({
  chavePix,
  donoNome,
  nomeRecebedor,
  cidade,
  valor,
  txid,
  mostrarQrPorPadrao = true,
  onNotify
}: PixPaymentBoxProps) {
  const [mostrarQr, setMostrarQr] = useState(mostrarQrPorPadrao);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const chaveNormalizada = useMemo(() => normalizarChavePixBCB(chavePix || ''), [chavePix]);
  const recebedorFinal = (donoNome || '').trim() || nomeRecebedor || 'DEPOSITO';

  const payload = useMemo(() => {
    if (!chaveNormalizada || !(valor > 0)) return '';
    return gerarPixCopiaCola({
      chave: chaveNormalizada,
      nomeRecebedor: recebedorFinal,
      cidade: cidade || 'SALVADOR',
      valor,
      txid
    });
  }, [chaveNormalizada, recebedorFinal, cidade, valor, txid]);

  useEffect(() => {
    let ativo = true;
    if (!mostrarQr || !payload) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(payload, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (ativo) setQrDataUrl(url);
      })
      .catch(() => {
        if (ativo) setQrDataUrl('');
      });
    return () => {
      ativo = false;
    };
  }, [mostrarQr, payload]);

  if (!chaveNormalizada) {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          fontSize: 12,
          color: '#fca5a5'
        }}
      >
        ⚠️ Nenhuma <strong>Chave PIX</strong> cadastrada. Configure em <em>Config</em> para gerar QR Code e Copia e Cola.
      </div>
    );
  }

  if (!(valor > 0) || !payload) return null;

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(payload);
      onNotify(`Código Pix Copia e Cola (${formatarMoeda(valor)}) copiado!`, 'success');
    } catch {
      onNotify('Não foi possível copiar automaticamente.', 'warning');
    }
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: 'rgba(16, 185, 129, 0.07)',
        border: '1px dashed #10b981',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        textAlign: 'center'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#34d399' }}>
          📱 QR Code Pix com Valor Exato ({formatarMoeda(valor)})
        </span>
        <button
          type="button"
          className="btn btn-xs"
          onClick={() => setMostrarQr((prev) => !prev)}
        >
          <QrCode size={12} color="#38bdf8" /> {mostrarQr ? 'Ocultar QR' : 'Ver QR'}
        </button>
      </div>

      {mostrarQr && qrDataUrl && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
          <div
            style={{
              background: '#ffffff',
              padding: 8,
              borderRadius: 12,
              display: 'inline-block',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)'
            }}
          >
            <img src={qrDataUrl} alt="QR Code Pix" style={{ width: 165, height: 165, display: 'block' }} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
        Chave Pix (Padrão BCB): <strong style={{ color: '#34d399' }}>{chaveNormalizada}</strong>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          readOnly
          value={payload}
          onFocus={(e) => e.target.select()}
          className="field-input"
          style={{ flex: 1, fontSize: 11, padding: '6px 8px', color: '#cbd5e1' }}
        />
        <button
          type="button"
          className="btn btn-success btn-xs"
          style={{ whiteSpace: 'nowrap', padding: '6px 10px' }}
          onClick={handleCopiar}
        >
          <Copy size={12} /> 📋 Copiar
        </button>
      </div>
    </div>
  );
}
