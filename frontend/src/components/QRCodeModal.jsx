import { useRef } from 'react';
import { X, Smartphone, QrCode, Download, RefreshCw } from 'lucide-react';
import { Button, Card } from './UI';
import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeModal({ qrCode, sessionId, onClose, onRefresh }) {
  const qrRef = useRef(null);

  // Debug logging
  console.log('🎨 QRCodeModal render - qrCode:', qrCode);
  console.log('🎨 qrCode type:', typeof qrCode);
  console.log('🎨 qrCode length:', qrCode?.length);

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const link = document.createElement('a');
      link.download = `whatsapp-qr-${sessionId}.svg`;
      link.href = svgUrl;
      link.click();

      URL.revokeObjectURL(svgUrl);
    }
  };

  if (!qrCode) {
    console.log('❌ QRCodeModal: No qrCode provided, returning null');
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <Card className="max-w-md w-full relative animate-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={20} className="text-slate-400" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 mb-4 shadow-lg shadow-purple-500/30">
            <Smartphone className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Scan QR Code</h2>
          <p className="text-slate-400 text-sm">
            Session: <span className="text-purple-400 font-medium">{sessionId}</span>
          </p>
        </div>

        {/* QR Code Display */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-lg flex items-center justify-center">
          <div ref={qrRef}>
            <QRCodeSVG
              value={qrCode}
              size={250}
              level="M"
              includeMargin={true}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3 text-sm">
            <QrCode className="text-purple-400 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-slate-300">
              <p className="font-medium text-white mb-1">How to connect:</p>
              <ol className="space-y-1 text-slate-400 list-decimal list-inside">
                <li>Open WhatsApp on your phone</li>
                <li>Tap Menu or Settings → Linked Devices</li>
                <li>Tap "Link a Device"</li>
                <li>Point your camera at this QR code</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            icon={Download}
            className="flex-1"
            onClick={handleDownload}
          >
            Download QR
          </Button>
          <Button
            variant="secondary"
            icon={RefreshCw}
            className="flex-1"
            onClick={onRefresh}
          >
            Refresh
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        {/* Warning */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            ⚠️ Keep this page open. QR code expires in 30 seconds.
          </p>
        </div>
      </Card>
    </div>
  );
}
