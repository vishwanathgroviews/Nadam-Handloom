import { env } from '../../config/env';
import { SmsProvider } from './sms.provider';
import { ConsoleSmsProvider } from './console.provider';
import { Msg91SmsProvider } from './msg91.provider';
import { MessageCentralSmsProvider } from './messagecentral.provider';

// The real gateways are wired up but stay inactive until SMS_PROVIDER is
// switched on — OTP delivery defaults to console-only (dev-echoed) until one
// gateway's credentials are supplied and SMS_PROVIDER names it.
function createSmsProvider(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case 'console':
      return new ConsoleSmsProvider();
    case 'msg91':
      if (!env.MSG91_AUTH_KEY || !env.MSG91_TEMPLATE_ID) {
        throw new Error('SMS_PROVIDER=msg91 requires MSG91_AUTH_KEY and MSG91_TEMPLATE_ID to be set.');
      }
      return new Msg91SmsProvider();
    case 'messagecentral':
      if (!env.MESSAGE_CENTRAL_CUSTOMER_ID || !env.MESSAGE_CENTRAL_KEY) {
        throw new Error(
          'SMS_PROVIDER=messagecentral requires MESSAGE_CENTRAL_CUSTOMER_ID and MESSAGE_CENTRAL_KEY to be set.'
        );
      }
      return new MessageCentralSmsProvider();
    default:
      throw new Error(
        `Unknown SMS_PROVIDER "${env.SMS_PROVIDER}". Supported: "console", "msg91", "messagecentral". ` +
          'Add a new provider implementing SmsProvider and register it here.'
      );
  }
}

export const smsProvider: SmsProvider = createSmsProvider();
export type { SmsProvider } from './sms.provider';
