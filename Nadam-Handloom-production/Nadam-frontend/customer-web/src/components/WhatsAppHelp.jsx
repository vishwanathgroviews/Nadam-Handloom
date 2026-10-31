import Icon from './Icon.jsx';
import { useConfig } from '../config/useConfig.js';

// "Message us on WhatsApp": the way forward when the website can't finish something
// itself (a closed shop account, an email someone else used, SMS paused).
export default function WhatsAppHelp({ text = 'Message us on WhatsApp', message, button = false }) {
  const { config } = useConfig();
  const href = `https://wa.me/${config.store.whatsapp}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  return (
    <a className={button ? 'btn btn-sm' : 'link small'} href={href} target="_blank" rel="noopener noreferrer">
      <Icon name="whatsapp" size="sm" />{text}
    </a>
  );
}
