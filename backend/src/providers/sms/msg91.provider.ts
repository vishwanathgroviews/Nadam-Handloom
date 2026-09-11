import { env } from '../../config/env';
import { SmsProvider } from './sms.provider';

// MSG91's v5 Flow API — the DLT-compliant path required by Indian telecom
// regulation for transactional SMS (the older sendhttp.php API can't
// deliver without a registered DLT template either, so there's no simpler
// alternative). The template itself, and the sender ID it sends from, are
// configured once in the MSG91 dashboard against MSG91_TEMPLATE_ID — this
// call only fills in that template's OTP variable per send. MSG91_SENDER_ID
// is kept as a documented/reference value (which sender the template above
// is expected to use) rather than passed on this call, since the Flow API
// doesn't accept a per-request sender override.
const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';

export class Msg91SmsProvider implements SmsProvider {
  async sendOtp(mobile: string, code: string): Promise<void> {
    const response = await fetch(MSG91_FLOW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: env.MSG91_AUTH_KEY!,
      },
      body: JSON.stringify({
        template_id: env.MSG91_TEMPLATE_ID,
        short_url: '0',
        recipients: [{ mobiles: `91${mobile}`, OTP: code }],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`MSG91 send failed (${response.status}): ${body}`);
    }

    const data: any = await response.json().catch(() => ({}));
    if (data?.type === 'error') {
      throw new Error(`MSG91 send failed: ${data.message ?? 'unknown error'}`);
    }
  }
}
