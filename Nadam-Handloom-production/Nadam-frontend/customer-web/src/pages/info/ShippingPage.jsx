import Policy from './Policy.jsx';

export default function ShippingPage() {
  return (
    <Policy
      title="Shipping policy"
      intro="Every order from nandamhandlooms.com is packed at our store in Old Mangalagiri and sent by courier. Delivery is free across India."
      sections={[
        ['When we ship', ['We pack and hand your order to DTDC within 2 working days of payment.', 'Orders paid on a Sunday or a festival holiday are packed the next working day.']],
        ['How long it takes', ['Usually 3 to 7 days after shipping, depending on your pincode.', 'We send the tracking number as soon as it ships, and it shows on your order page.']],
        ['Delivery charges', 'None. Delivery is free on every order, anywhere in India.'],
        ['Your address', ['Please check your address and mobile number at checkout. To change it after paying, message us on WhatsApp before the order ships.', 'If the courier can\'t deliver after several tries, the parcel comes back to us and we contact you.']],
        ['Outside India', 'We don\'t ship outside India yet.'],
      ]}
    />
  );
}
