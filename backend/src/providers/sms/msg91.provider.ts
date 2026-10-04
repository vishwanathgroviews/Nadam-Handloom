import { env } from '../../config/env';
import { SmsProvider } from './sms.provider';

// MSG91's v5 SendOTP API. It sends the template set up under OTP → Templates
// in the MSG91 dashboard (MSG91_TEMPLATE_ID), which is tied there to its DLT
// registration and sender ID — the registration Indian telecom regulation
// requires for any transactional SMS. This call only supplies the code for
// the template's ##OTP## variable: the backend generates and verifies its own
// codes (modules/auth/otp.service.ts), so MSG91's verify/retry endpoints are
// never used. MSG91_SENDER_ID is kept as a documented/reference value (which
// sender the template above is expected to use) rather than passed on this
// call.
//
// MSG91 answers "success" as soon as it has queued the request — even for an
// auth key it does not recognise — so a clean return here means "accepted",
// not "delivered". Real delivery failures only show in the dashboard's
// OTP → Logs.
const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';

export class Msg91SmsProvider implements SmsProvider {
  async sendOtp(mobile: string, code: string): Promise<void> {
    const params = new URLSearchParams({
      template_id: env.MSG91_TEMPLATE_ID!,
      mobile: `91${mobile}`,
      otp: code,
    });
    const response = await fetch(`${MSG91_OTP_URL}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: env.MSG91_AUTH_KEY!,
      },
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
