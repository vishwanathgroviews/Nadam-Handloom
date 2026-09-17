interface ShipTo {
  fullName?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
}

/**
 * Name, street and locality as up to three lines, skipping whatever is blank.
 *
 * A WhatsApp order now carries its whole address as one block in line1 with
 * name/city/state/pincode empty, so the old fixed three-line template printed
 * a blank first line and a stray ", - " under it.
 */
export const formatShipTo = (shipTo: ShipTo): string => {
  const locality = [
    [shipTo.city, shipTo.state].filter(Boolean).join(', '),
    shipTo.pincode,
  ].filter(Boolean).join(' - ');

  return [
    shipTo.fullName,
    [shipTo.line1, shipTo.line2].filter(Boolean).join(', '),
    locality,
  ]
    .map((line) => (line || '').trim())
    .filter(Boolean)
    .join('\n');
};
