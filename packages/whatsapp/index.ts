import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

export class WhatsAppEngine {
  private sock: any;
  private qrCallback: (qr: string) => void;
  
  constructor(qrCallback: (qr: string) => void) {
    this.qrCallback = qrCallback;
  }

  async initialize() {
    const { state, saveCreds } = await useMultiFileAuthState('sessions');
    const { version } = await fetchLatestBaileysVersion();
    
    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      browser: ['Chrome (Linux)', '', ''],
      generateHighQualityLinkPreview: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', (update: any) => {
      const { qr, connection, lastDisconnect } = update;
      
      if (qr) {
        this.qrCallback(qr);
      }
      
      if (connection === 'close') {
        const shouldReconnect = 
          (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) this.initialize();
      }
    });

    this.sock.ev.on('messages.upsert', async (m: any) => {
      const message = m.messages[0];
      if (!message.key.fromMe && m.type === 'notify') {
        console.log('Incoming message:', message);
      }
    });
  }
  
  async sendMessage(to: string, text: string) {
    await this.sock.sendMessage(to + '@s.whatsapp.net', { text });
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
