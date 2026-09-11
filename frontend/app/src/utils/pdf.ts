import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const saveBytes = (bytes: Uint8Array, filename: string): string => {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  return file.uri;
};

export const savePdfBytes = (bytes: Uint8Array, filename: string): string => saveBytes(bytes, filename);

export const printPdf = async (uri: string): Promise<void> => {
  await Print.printAsync({ uri });
};

export const shareFile = async (uri: string, mimeType: string, uti?: string): Promise<void> => {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType, UTI: uti });
};

export const sharePdf = (uri: string): Promise<void> => shareFile(uri, 'application/pdf', 'com.adobe.pdf');
