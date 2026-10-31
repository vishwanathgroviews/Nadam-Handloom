import Policy from './Policy.jsx';
import { useConfig } from '../../config/useConfig.js';
import { formatMobile } from '../../utils/format.js';

export default function ContactPage() {
  const { config } = useConfig();
  const st = config.store;
  const wa = st.whatsapp?.replace(/^91/, '') || '';
  return (
    <Policy
      title="Contact us"
      intro={`${config.shop.name}, a handloom store in Old Mangalagiri. We reply on WhatsApp the same day.`}
      sections={[
        ['Store', `${st.addressLines.join(', ')}. ${st.hours}.`],
        ['Phone and WhatsApp', [
          <a key="call" href={`tel:+91${config.shop.mobile}`}>Call +91 {formatMobile(config.shop.mobile)}</a>,
          <a key="wa" href={`https://wa.me/${st.whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp +91 {formatMobile(wa)}</a>,
        ]],
        ['Business details', `${config.shop.name} · GSTIN ${config.shop.gstin} · ${config.shop.address}`],
      ]}
    />
  );
}
