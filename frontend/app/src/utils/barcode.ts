/**
 * Client-side mirror of the backend's canonical barcode form
 * (backend/src/utils/barcode.ts), which is what actually gets stored and
 * matched.
 *
 * Normalizing here too keeps the local pending/duplicate checks honest: the
 * manual-entry fields force-uppercase what staff type while the camera hands
 * back the label's raw value, so without this the same tag can look like two
 * different codes in a pending list that the server would then reject as one.
 */
export const normalizeBarcode = (code: string): string => code.trim().toUpperCase();
