-- Canonicalize existing piece barcodes to the trimmed-uppercase form the app
-- now writes and looks up (see src/utils/barcode.ts).
--
-- Piece.barcode is an exact, case-sensitive unique column, so a row stored as
-- "nandam2273" is unreachable once lookups normalize to "NANDAM2273" — the
-- tag scans as "No product found" even though the piece exists. Rewriting the
-- stored values keeps every already-received unit scannable.
--
-- If two pieces differ only by case/whitespace they are, physically, the same
-- tag claimed twice; the unique index will reject the update and this
-- migration fails loudly rather than silently picking a winner. Resolve by
-- deleting or re-tagging the duplicate unit, then re-run.
UPDATE "Piece"
SET "barcode" = UPPER(TRIM("barcode"))
WHERE "barcode" <> UPPER(TRIM("barcode"));
