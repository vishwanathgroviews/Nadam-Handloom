import type { BarcodeType } from 'expo-camera';

// The external device that prints barcodes for physical units isn't
// guaranteed to use Code128 — support every symbology expo-camera can read
// so scanning works regardless of what the device outputs.
export const SUPPORTED_BARCODE_TYPES: BarcodeType[] = [
  'code128', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code93', 'itf14', 'codabar', 'qr',
];
