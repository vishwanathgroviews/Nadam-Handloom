import Policy from './Policy.jsx';

export default function RefundsPage() {
  return (
    <Policy
      title="Cancellation and refunds"
      intro="Each saree is handwoven, and many are the only piece of their design. Here is how cancelling and refunds work."
      sections={[
        ['Cancelling an order', ['Before it ships: message us on WhatsApp with your order number and we cancel it with a full refund.', 'After it ships: it can\'t be cancelled, but see damaged or wrong sarees below.']],
        ['Damaged or wrong saree', ['Tell us on WhatsApp within 48 hours of delivery, with photos and an unboxing video.', 'We arrange a replacement if the same design is available, or a full refund.']],
        ['What isn\'t a defect', 'Small differences in weave, colour or motif are part of a handloom. Colours can also look a little different on screens.'],
        ['How refunds are paid', ['To the same account or card you paid from, through Razorpay.', 'Usually 5 to 7 working days after we start it; your bank may take a little longer to show it.']],
        ['A payment we couldn\'t use', 'If your payment reaches us after the 15 minutes your sarees were held, and one has sold meanwhile, we refund the whole amount automatically.'],
      ]}
    />
  );
}
