// "Send bag on WhatsApp" (5.8 A): shows the message first, then WhatsApp opens with it filled
// in. The customer presses send there; the bag stays until they clear it (rule 15).
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { useToast } from './Toasts.jsx';
import { useConfig } from '../config/useConfig.js';
import { useBag, bagLines } from '../bag/useBag.js';
import { closeWhatsApp, setSent } from '../bag/store.js';
import { bagMessage, whatsAppLink } from '../bag/message.js';

export default function BagWhatsApp() {
  const bag = useBag();
  const { config } = useConfig();
  const toast = useToast();
  if (!bag.whatsapp) return null;
  const lines = bagLines(bag);
  const can = lines.some((l) => l.buyable);
  const text = bagMessage(lines);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast('Message copied');
    } catch {
      toast('Couldn\'t copy. Select the message and copy it.', { tone: 'bad' });
    }
  }
  return (
    <Modal title="Send your bag on WhatsApp" onClose={closeWhatsApp} wide labelledBy="wa-title">
      <div className="head">
        <span className="tone wa"><Icon name="whatsapp" /></span>
        <div style={{ display: 'grid', gap: '.35rem' }}>
          <h3 id="wa-title">Send your bag on WhatsApp</h3>
          <p className="muted">{can ? 'WhatsApp opens with this message. Check it and press send: we reply with the payment details.' : 'Nothing in your bag can be bought right now.'}</p>
        </div>
      </div>
      {can ? <div className="wa-preview" tabIndex={0} aria-label="The message">{text}</div> : null}
      <div className="acts">
        {can ? (
          <>
            <button type="button" className="btn" onClick={copy}><Icon name="copy" size="sm" />Copy text</button>
            <a className="btn btn-wa" href={whatsAppLink(config.store.whatsapp, text)} target="_blank" rel="noopener noreferrer" onClick={() => { setSent(true); closeWhatsApp(); }}>
              <Icon name="whatsapp" size="sm" />Open WhatsApp
            </a>
          </>
        ) : <button type="button" className="btn" onClick={closeWhatsApp}>Close</button>}
      </div>
    </Modal>
  );
}
