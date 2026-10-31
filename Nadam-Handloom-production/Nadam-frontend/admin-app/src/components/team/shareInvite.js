// Sends the invite from the owner's own phone: WhatsApp to that number with the
// message typed in (free), or the phone's share menu for any other app.
import { Linking, Share } from 'react-native';

export async function shareOnWhatsApp(invite) {
  // wa.me opens WhatsApp when it is installed, otherwise WhatsApp's web page.
  await Linking.openURL(invite.whatsappUrl);
}

export async function shareAnotherWay(invite) {
  await Share.share({ message: invite.message });
}
