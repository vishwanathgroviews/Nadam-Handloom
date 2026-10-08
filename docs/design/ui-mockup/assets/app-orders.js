/* Checkout, stand-in payment window, order confirmation, My Orders, order detail, My Account. */
(() => {
  'use strict';
  const N = window.NH;
  const { C, $, $$, rupee, esc, byId, nm, bd, I, SHOP, STATUS, STATES, fmtDate, prettyPhone, maskPhone, crumbs, emptyBlock, snap, uid } = N;

  const pill = (status) => { const [t, k] = STATUS[status] || [status, '']; return `<span class="pill ${k}">${esc(t)}</span>`; };
  const addrText = (a) => `${esc(a.line1)}${a.line2 ? ', ' + esc(a.line2) : ''}, ${esc(a.city)}, ${esc(a.state)} – ${esc(a.pincode)}`;
  const requireSignIn = (next) => `<div class="wrap"><div class="gate"><div class="ring-icon" style="width:60px;height:60px;border-radius:50%;background:color-mix(in srgb,var(--accent) 8%,var(--bg));display:grid;place-items:center;color:var(--accent-ink)">${I.user}</div><h1 style="font-size:clamp(30px,3.4vw,46px)">Sign in to continue</h1><p>Sign in or create an account to ${next === 'checkout' ? 'complete your order. Your bag will be right here waiting.' : 'see your orders and account.'}</p><div class="acts" style="justify-content:center"><a class="btn btn-fill" href="#/login/${next}">Sign in</a><a class="btn" href="#/register/${next}">Create account</a></div></div></div>`;
  const steps = (now) => { const S = ['Bag', 'Address', 'Payment', 'Confirmation']; return `<div class="steps" aria-label="Checkout steps">${S.map((s, i) => `<div class="step ${i < now ? 'done' : i === now ? 'now' : ''}"><i></i><span>${i + 1}. ${s}</span></div>`).join('')}</div>`; };
  const addressForm = (a = {}, errs = {}, mode = 'add') => `<form class="form card" id="address-form" data-mode="${mode}" data-id="${a.id || ''}" novalidate style="padding:20px">
    <div class="row2"><div class="field"><label for="ad-name">Full name</label><input class="input${errs.fullName ? ' bad' : ''}" id="ad-name" name="fullName" value="${esc(a.fullName || '')}" autocomplete="name">${errs.fullName ? `<span class="err">${errs.fullName}</span>` : ''}</div><div class="field"><label for="ad-phone">Phone number</label><input class="input${errs.phone ? ' bad' : ''}" id="ad-phone" name="phone" inputmode="numeric" maxlength="10" value="${esc(a.phone || '')}" autocomplete="tel-national">${errs.phone ? `<span class="err">${errs.phone}</span>` : ''}</div></div>
    <div class="field"><label for="ad-line1">Address line 1</label><input class="input${errs.line1 ? ' bad' : ''}" id="ad-line1" name="line1" placeholder="House number, street" value="${esc(a.line1 || '')}" autocomplete="address-line1">${errs.line1 ? `<span class="err">${errs.line1}</span>` : ''}</div>
    <div class="field"><label for="ad-line2">Address line 2 <small>optional</small></label><input class="input" id="ad-line2" name="line2" placeholder="Landmark, area" value="${esc(a.line2 || '')}" autocomplete="address-line2"></div>
    <div class="row3"><div class="field"><label for="ad-city">City</label><input class="input${errs.city ? ' bad' : ''}" id="ad-city" name="city" value="${esc(a.city || '')}" autocomplete="address-level2">${errs.city ? `<span class="err">${errs.city}</span>` : ''}</div><div class="field"><label for="ad-state">State</label><select class="input${errs.state ? ' bad' : ''}" id="ad-state" name="state"><option value="">Select</option>${STATES.map((s) => `<option${s === a.state ? ' selected' : ''}>${s}</option>`).join('')}</select>${errs.state ? `<span class="err">${errs.state}</span>` : ''}</div><div class="field"><label for="ad-pin">Pincode</label><input class="input${errs.pincode ? ' bad' : ''}" id="ad-pin" name="pincode" inputmode="numeric" maxlength="6" value="${esc(a.pincode || '')}" autocomplete="postal-code">${errs.pincode ? `<span class="err">${errs.pincode}</span>` : ''}</div></div>
    <label class="check"><input type="checkbox" name="isDefault" ${a.isDefault ? 'checked' : ''}> Make this my default address</label>
    <div class="acts"><button class="btn btn-fill btn-sm" type="submit">${mode === 'edit' ? 'Update address' : 'Save address'}</button><button class="btn btn-ghost btn-sm" type="button" data-act="cancel-address">Cancel</button></div></form>`;
  const CO = { addressId: null, adding: false, editing: null, errs: {}, error: '' };
  const selectedAddress = () => N.data.addresses.find((a) => a.id === CO.addressId) || N.data.addresses.find((a) => a.isDefault) || N.data.addresses[0];
  N.checkoutState = CO;

  /* ---------- checkout ---------- */
  N.pages.checkout = {
    title: 'Checkout',
    render(route, UI) {
      if (!N.data.session) return requireSignIn('checkout');
      const bag = UI === 'empty' ? [] : N.data.bag;
      if (!bag.length) return `<div class="wrap">${emptyBlock(I.bag, 'Your bag is empty', 'Add something to your bag before checking out.', '<a class="btn btn-fill" href="#/shop">Shop now</a>', 'h1')}</div>`;
      if (UI === 'loading') return `<div class="wrap"><div class="page-head left"><div class="sk sk-text" style="height:40px;width:220px"></div></div><div class="two"><div class="stack"><div class="sk sk-line"></div><div class="sk sk-line"></div><div class="sk sk-line"></div></div><div class="card"><div class="sk sk-text w60"></div><div class="sk sk-line"></div></div></div></div>`;
      const addresses = UI === 'empty' ? [] : N.data.addresses; const sel = selectedAddress(); if (sel) CO.addressId = sel.id;
      const off = UI === 'warning' ? bag[0] : null;
      const showForm = CO.adding || !addresses.length;
      return `<div class="wrap">${crumbs([['Home', '#/'], ['Your bag', '#/cart'], ['Checkout']])}
        <div class="page-head left"><h1>Checkout</h1></div>${steps(1)}
        ${UI === 'error' || CO.error ? `<div class="alert bad" role="alert" style="margin-bottom:20px">${I.alert}<div><b>${esc(CO.error || 'Payment failed')}</b><p>${CO.error ? 'You can try again. Nothing has been charged.' : 'The payment did not go through. Nothing has been charged. Please try again or use another method.'}</p></div></div>` : ''}
        <div class="two"><div class="stack">
          <section class="card"><div class="card-head"><h3>${I.pin} Delivery address</h3>${addresses.length && !showForm ? `<button class="under" type="button" data-act="add-address">${I.plus} Add new</button>` : ''}</div>
            ${!showForm ? `<div class="addr-list">${addresses.map((a) => `<label class="addr${a.id === CO.addressId ? ' on' : ''}"><input type="radio" name="address" value="${a.id}" ${a.id === CO.addressId ? 'checked' : ''} data-act="select-address"><div><b>${esc(a.fullName)}</b> · ${prettyPhone(a.phone)} ${a.isDefault ? '<span class="pill gold" style="margin-left:8px">Default</span>' : ''}<p>${addrText(a)}</p></div>${a.id === CO.addressId ? I.checkCircle : '<span></span>'}</label>`).join('')}</div>` : addressForm(CO.editing || {}, CO.errs, 'add')}
          </section>
          <section class="card"><div class="card-head"><h3>${I.bag} Your sarees <span class="muted" style="font-family:var(--sans);font-size:13px">(${bag.length})</span></h3></div>
            ${off ? `<div class="alert warn" role="alert" style="margin-bottom:12px">${I.alert}<div><b>Can’t proceed, one saree is out of stock</b><p>It was sold in the shop a moment ago. Remove it to continue.</p></div></div>` : ''}
            ${bag.map((id) => { const p = byId[id]; return `<div class="line${id === off ? ' off' : ''}"><img src="${p.img}" alt=""><div><span class="line-name">${esc(nm(p))}</span><span class="label">${esc(bd(C[p.c]))} · Tag ${p.id}${id === off ? ' · <b style="color:var(--bad)">Out of stock</b>' : ''}</span><button class="under" type="button" data-remove="${id}" style="font-size:10px">Remove</button></div><span class="price">${rupee(C[p.c].price)}</span></div>`; }).join('')}
            <p class="note" style="margin-top:14px">Stock is checked once more when you tap Pay, and the pieces are held for you for 15 minutes while you pay.</p>
          </section>
        </div>
        <aside class="card summary"><h3>Order summary</h3><div class="rows"><div><span>Subtotal (${bag.length} ${bag.length === 1 ? 'item' : 'items'})</span><span class="rupee">${rupee(N.bagTotal())}</span></div><div><span>Delivery</span><span>No charge</span></div><div><span>GST</span><span>Included</span></div><div class="total"><span>Total</span><b class="rupee">${rupee(N.bagTotal())}</b></div></div>
          <div class="pay-sticky"><button class="btn btn-fill btn-block" type="button" data-act="pay" ${off || !sel ? 'disabled' : ''}>Pay ${rupee(N.bagTotal())} and place order</button></div>
          <p class="note" style="text-align:center">Payments are processed securely by Razorpay. <span class="sample">Mock</span> opens a stand-in window here.</p>
          <div class="assure"><div>${I.shield}<span>Your card details never reach our servers</span></div><div>${I.truck}<span>Delivered by DTDC across India</span></div></div></aside></div></div>`;
    },
    popup() { openPaySheet(); },
  };
  function openPaySheet() {
    const total = N.bagTotal(), order = { no: N.newOrderNo() };
    N.sheet(`<div class="pay" id="pay"><div class="pay-head"><div><span class="label muted">Nandam Handlooms</span><br><b>${rupee(total)}</b></div><div style="text-align:right"><span class="label muted">Order</span><br><span style="font-variant-numeric:tabular-nums">${order.no}</span></div></div>
      <div class="sample" style="justify-self:start">Stand-in for the Razorpay payment window</div>
      <div class="pay-tabs" role="tablist"><button type="button" role="tab" aria-pressed="true" data-tab="upi">UPI</button><button type="button" role="tab" aria-pressed="false" data-tab="card">Card</button><button type="button" role="tab" aria-pressed="false" data-tab="net">Netbanking</button></div>
      <div id="pay-body"><div class="field"><label for="upi-id">UPI ID</label><input class="input" id="upi-id" placeholder="name@bank" value="priya@okaxis"></div></div>
      <button class="btn btn-fill btn-block" type="button" data-act="pay-go" data-no="${order.no}">Pay ${rupee(total)}</button>
      <div class="acts" style="justify-content:center"><button class="link" type="button" data-act="pay-fail" data-no="${order.no}" style="font-size:12px">Simulate a failed payment (mock only)</button></div></div>`);
  }
  N.openPaySheet = openPaySheet;
  N.payTab = (tab) => {
    $$('#pay .pay-tabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === tab));
    $('#pay-body').innerHTML = tab === 'upi' ? `<div class="field"><label for="upi-id">UPI ID</label><input class="input" id="upi-id" placeholder="name@bank" value="priya@okaxis"></div>`
      : tab === 'card' ? `<div class="form"><div class="field"><label for="card-no">Card number</label><input class="input" id="card-no" inputmode="numeric" placeholder="1234 5678 9012 3456" value="4111 1111 1111 1111"></div><div class="row2"><div class="field"><label for="card-exp">Expiry</label><input class="input" id="card-exp" placeholder="MM / YY" value="09 / 28"></div><div class="field"><label for="card-cvv">CVV</label><input class="input" id="card-cvv" inputmode="numeric" maxlength="4" placeholder="•••" value="123" type="password"></div></div></div>`
      : `<div class="field"><label for="net-bank">Bank</label><select class="input" id="net-bank"><option>State Bank of India</option><option>HDFC Bank</option><option>ICICI Bank</option><option>Axis Bank</option><option>Union Bank of India</option></select></div>`;
  };
  function makeOrder(no, status) {
    const addr = { ...selectedAddress() };
    const order = { no, placedAt: new Date().toISOString(), status, items: N.data.bag.map((id) => snap(byId[id])), address: addr, shipment: { status: 'not_shipped' }, invoice: null, sample: false };
    order.subtotal = order.items.reduce((t, i) => t + i.price, 0); order.total = order.subtotal;
    N.data.orders = [order, ...N.data.orders]; return order;
  }
  N.payGo = (no) => {
    $('#pay').innerHTML = `<div class="pay-processing"><div class="spinner"></div><b style="font-family:var(--serif);font-size:24px;font-weight:500">Processing payment…</b><p class="note">Do not close this window.</p></div>`;
    setTimeout(() => {
      $('#pay').innerHTML = `<div class="pay-processing"><svg class="ok-mark" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M30 52l13 13 27-30"/></svg><b style="font-family:var(--serif);font-size:24px;font-weight:500">Payment received</b><p class="note">Confirming your order…</p></div>`;
      setTimeout(() => { const order = makeOrder(no, 'paid'); N.data.bag = []; CO.error = ''; N.persist(); N.renderBag(); N.hidePanel(); N.go('#/order-confirmation/' + no); setTimeout(() => { order.invoice = N.newInvoiceNo(); order.status = 'processing'; N.persist(); if (N.route.name === 'order-confirmation' && N.route.a === no) N.render(false); }, 3500); }, 1300);
    }, 1600);
  };
  N.payFail = (no) => { makeOrder(no, 'payment_failed'); N.persist(); N.hidePanel(); N.go('#/order-confirmation/' + no); };
  N.payDismiss = (no) => { CO.error = 'Payment was not completed'; makeOrder(no, 'pending_payment'); N.persist(); N.render(false); };

  /* ---------- confirmation ---------- */
  N.pages['order-confirmation'] = {
    title: 'Order confirmed',
    render(route, UI) {
      if (!N.data.session) return requireSignIn('account/orders');
      let o = N.data.orders.find((x) => x.no === route.a);
      if (!o && UI !== 'loading') return `<div class="wrap">${emptyBlock(I.search, 'We could not find this order', 'The link may be old. Your orders are listed under My Orders.', '<a class="btn" href="#/account/orders">View my orders</a>', 'h1')}</div>`;
      if (UI === 'loading') return `<div class="wrap"><div class="confirm"><div class="sk" style="width:92px;height:92px;border-radius:50%"></div><div class="sk sk-text" style="height:40px;width:320px"></div><div class="sk sk-text w60"></div></div></div>`;
      const status = UI === 'warning' ? 'pending_payment' : UI === 'error' ? 'payment_failed' : o.status;
      if (status === 'payment_failed' || status === 'pending_payment') {
        const failed = status === 'payment_failed';
        return `<div class="wrap"><div class="confirm"><svg class="ok-mark ${failed ? 'bad' : 'warn'}" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/>${failed ? '<path d="M35 35l30 30M65 35 35 65"/>' : '<path d="M50 28v24l14 10"/>'}</svg><h1>${failed ? 'Payment not completed' : 'Payment pending'}</h1><p class="muted" style="font-weight:300;max-width:46ch">${failed ? `Order <b>${o.no}</b> was not paid. The payment did not go through and nothing has been charged. The sarees are released back to the shop after 15 minutes.` : `Order <b>${o.no}</b> is still waiting for the payment confirmation. This can take a moment. If you closed the payment window, you can pay again.`}</p><div class="acts" style="justify-content:center"><a class="btn btn-fill" href="#/checkout">Try again</a><a class="btn" href="#/account/orders">View my orders</a></div></div></div>`;
      }
      return `<div class="wrap"><div class="confirm">${steps(3)}<svg class="ok-mark" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><path d="M30 52l13 13 27-30"/></svg><span class="label gold">Thank you</span><h1>Order confirmed</h1><p class="muted" style="font-weight:300;max-width:48ch">Your order <b style="font-weight:500;color:var(--ink)">${o.no}</b> is paid and with our team in Mangalagiri. We will message you on WhatsApp when it is packed and again when it ships, with the DTDC tracking number.</p>
        <div class="card lines" style="width:100%"><div class="card-head"><h3>Your sarees</h3><span class="muted">${fmtDate(o.placedAt, 'long')}</span></div>${o.items.map((it) => `<div class="line"><img src="${it.img}" alt=""><div><span class="line-name">${esc(it.name)}</span><span class="label">${esc(it.collection)} · Tag ${it.id}</span></div><span class="price">${rupee(it.price)}</span></div>`).join('')}<div class="sum" style="padding-top:16px"><span class="label">Total paid</span><b>${rupee(o.total)}</b></div><p class="note" style="margin-top:10px">Delivering to ${esc(o.address.fullName)}, ${addrText(o.address)}</p></div>
        <div class="acts" style="justify-content:center"><a class="btn btn-fill" href="#/account/orders/${o.no}">Track this order</a>${o.invoice ? `<button class="btn" type="button" data-act="invoice" data-no="${o.invoice}">${I.download} Download invoice</button>` : `<span class="btn btn-ghost" aria-live="polite"><span class="spinner" style="width:16px;height:16px"></span> Preparing your GST invoice</span>`}<a class="btn" href="#/shop">Continue shopping</a></div>
      </div></div>`;
    },
  };

  /* ---------- my orders ---------- */
  const ordersShell = (inner, current) => `<div class="wrap"><div class="account">
    <aside class="acc-side"><div class="acc-id"><div class="avatar" aria-hidden="true">${esc((N.data.session.display || N.data.session.first || 'U')[0].toUpperCase())}</div><div><b>${esc(N.data.session.display || N.data.session.first)}</b><span>${prettyPhone(N.data.session.phone)}</span><span>Member since ${fmtDate(N.data.session.since + 'T00:00:00', 'short').replace(/^\d+ /, '')}</span>${N.data.session.sample ? '<span class="sample" style="margin-top:6px">Sample customer</span>' : ''}</div></div>
      <nav class="acc-nav" aria-label="Account"><a href="#/account" ${current === 'profile' ? 'aria-current="page"' : ''}>${I.user} My profile</a><a href="#/account/orders" ${current === 'orders' ? 'aria-current="page"' : ''}>${I.box} My orders</a><a href="#/wishlist">${I.heart} Wishlist</a><button class="danger" type="button" data-act="logout">${I.logout} Sign out</button></nav></aside>
    <div class="acc-main">${inner}</div></div></div>`;
  N.pages.account = {
    title: (r) => (r.a === 'orders' ? (r.b ? 'Order ' + r.b : 'My orders') : 'My account'),
    render(route, UI) {
      if (!N.data.session) return requireSignIn(route.a === 'orders' ? 'account/orders' : 'account');
      if (route.a === 'orders' && route.b) return ordersShell(orderDetail(route.b, UI), 'orders');
      if (route.a === 'orders') return ordersShell(ordersList(UI), 'orders');
      return ordersShell(profile(UI), 'profile');
    },
    popup(route) { if (route.a === 'orders') N.toast('Nothing to confirm on this page'); else N.ask({ title: 'Delete this address?', text: 'Flat 302, Lakshmi Residency will be removed from your saved addresses.', ok: 'Delete', cancel: 'Keep', danger: true }).then(() => {}); },
  };
  function ordersList(UI) {
    const orders = UI === 'empty' ? [] : N.data.orders;
    const head = `<div class="order-head"><div><span class="label gold">My account</span><h1 style="font-size:clamp(30px,3.6vw,48px)">My orders</h1></div>${orders.some((o) => o.sample) ? '<span class="sample">Sample orders for this mock</span>' : ''}</div>`;
    if (UI === 'loading') return head + Array(3).fill('<div class="line"><div class="sk sk-img" style="width:78px"></div><div><div class="sk sk-text w60"></div><div class="sk sk-text w40"></div></div></div>').join('');
    if (UI === 'error') return head + `<div class="alert bad">${I.alert}<div><b>We could not load your orders</b><p>Please check your connection and try again.</p></div><button class="btn btn-sm" type="button" data-act="retry" style="margin-left:auto">Try again</button></div>`;
    if (!orders.length) return head + emptyBlock(I.box, 'No orders yet', 'Once you place an order, it will show up here with its tracking number.', '<a class="btn btn-fill" href="#/shop">Start shopping</a>');
    return head + `<table class="orders-table"><thead><tr><th>Order</th><th>Sarees</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>${orders.map((o) => `<tr><td><a class="no" href="#/account/orders/${o.no}">${o.no}</a><br><span class="muted" style="font-size:13px">${fmtDate(o.placedAt)}</span></td><td data-th="Sarees"><div class="thumbs-sm">${o.items.map((it) => `<img src="${it.img}" alt="">`).join('')}</div><span class="muted" style="font-size:13px">${o.items.length} ${o.items.length === 1 ? 'item' : 'items'}</span></td><td data-th="Status">${pill(o.status)}</td><td data-th="Total" class="rupee">${rupee(o.total)}</td><td><a class="btn btn-ghost btn-sm" href="#/account/orders/${o.no}">View</a></td></tr>`).join('')}</tbody></table>
      <p class="note" style="margin-top:18px">Orders older than 6 months are archived and no longer shown here. Ask us on WhatsApp if you need an older invoice.</p>`;
  }
  function orderDetail(no, UI) {
    const o = N.data.orders.find((x) => x.no === no);
    if (!o) return emptyBlock(I.search, 'We could not find this order', 'It may belong to another account or be older than 6 months.', '<a class="btn" href="#/account/orders">Back to my orders</a>');
    if (UI === 'loading') return `<div class="stack"><div class="sk sk-text" style="height:40px;width:260px"></div><div class="sk sk-line"></div><div class="sk sk-line"></div></div>`;
    const status = UI === 'warning' ? 'pending_payment' : UI === 'error' ? 'cancelled' : o.status;
    const paid = ['paid', 'processing', 'shipped', 'delivered'].includes(status);
    const sh = o.shipment || {};
    const tl = [
      ['Order placed', fmtDate(o.placedAt, 'long'), true],
      ['Payment received', paid ? 'Razorpay · ' + fmtDate(o.placedAt) : status === 'pending_payment' ? 'Waiting for confirmation' : 'Not received', paid],
      ['Packed in Mangalagiri', ['processing', 'shipped', 'delivered'].includes(status) ? 'Ready for DTDC pickup' : 'After payment', ['processing', 'shipped', 'delivered'].includes(status)],
      ['Shipped by DTDC', sh.awb ? `AWB ${sh.awb} · ${fmtDate(sh.shippedAt)}` : 'The AWB number appears here once it ships', ['shipped', 'delivered'].includes(status)],
      ['Delivered', sh.deliveredAt ? fmtDate(sh.deliveredAt, 'long') : 'Usually 3 to 6 days after shipping', status === 'delivered'],
    ];
    const nowIdx = tl.findIndex((t) => !t[2]);
    return `${crumbs([['My orders', '#/account/orders'], [o.no]])}
      <div class="order-head"><div><h1>${o.no}${o.sample ? ' <span class="sample">Sample</span>' : ''}</h1><p class="muted" style="font-weight:300">Placed on ${fmtDate(o.placedAt, 'long')}</p></div>${pill(status)}</div>
      ${status === 'cancelled' ? `<div class="alert bad">${I.alert}<div><b>This order was cancelled</b><p>The payment is being refunded to the same card or account by Razorpay. It can take 5 to 7 working days to show.</p></div></div>` : status === 'pending_payment' ? `<div class="alert warn">${I.clock}<div><b>Waiting for your payment</b><p>Finish paying within 15 minutes of placing the order, or the sarees go back on sale.</p></div><a class="btn btn-sm" href="#/checkout" style="margin-left:auto">Pay now</a></div>` : ''}
      <div class="two" style="padding-bottom:0"><div class="stack">
        <section class="card"><div class="card-head"><h3>${I.truck} Tracking</h3>${sh.awb ? `<a class="btn btn-ghost btn-sm" href="${SHOP.dtdc}" target="_blank" rel="noopener">Track on DTDC ${I.external}</a>` : ''}</div>
          ${sh.awb ? `<p style="margin-bottom:18px">Carrier: DTDC · AWB number <b style="user-select:all;font-weight:500">${sh.awb}</b> <button class="icon-sm" type="button" data-copy="${sh.awb}" data-copied="AWB number copied" aria-label="Copy AWB number">${I.copy}</button><br><span class="note">DTDC’s page does not take the number from a link, so paste it there.</span></p>` : `<p class="note" style="margin-bottom:18px">${I.clock} The DTDC AWB number will appear here once your order ships.</p>`}
          <div class="timeline">${tl.map((t, i) => `<div class="tl ${t[2] ? 'done' : i === nowIdx && !['cancelled', 'payment_failed'].includes(status) ? 'now' : 'todo'}"><i>${t[2] ? I.check : ''}</i><div><b>${t[0]}</b><span>${esc(t[1])}</span></div></div>`).join('')}</div></section>
        <section class="card"><div class="card-head"><h3>${I.bag} Sarees</h3></div>${o.items.map((it) => `<div class="line"><a href="#/product/${it.id}"><img src="${it.img}" alt=""></a><div><a class="line-name" href="#/product/${it.id}">${esc(it.name)}</a><span class="label">${esc(it.collection)} · Tag ${it.id}</span></div><span class="price">${rupee(it.price)}</span></div>`).join('')}</section>
        <section class="card"><div class="card-head"><h3>${I.pin} Delivery address</h3></div><p><b>${esc(o.address.fullName)}</b><br>${addrText(o.address)}<br>Phone: ${prettyPhone(o.address.phone)}</p></section>
      </div>
      <aside class="card summary"><h3>Payment</h3><div class="rows"><div><span>Subtotal</span><span class="rupee">${rupee(o.subtotal)}</span></div><div><span>Delivery</span><span>No charge</span></div><div class="total"><span>Total</span><b class="rupee">${rupee(o.total)}</b></div></div><p class="note">Paid by Razorpay · GST included</p>${o.invoice ? `<button class="btn btn-block" type="button" data-act="invoice" data-no="${o.invoice}">${I.download} Invoice ${o.invoice}</button>` : paid ? '<p class="note">The GST invoice is being prepared.</p>' : ''}<a class="btn btn-ghost btn-block" href="${SHOP.wa(`Hello, I have a question about my order ${o.no}.`)}" target="_blank" rel="noopener">Ask about this order</a></aside></div>`;
  }

  /* ---------- profile and addresses ---------- */
  const PR = { msg: '', err: '', errs: {}, addrMode: null, addrErrs: {} };
  N.profileState = PR;
  function profile(UI) {
    const u = N.data.session, e = PR.errs;
    const ok = UI === 'success' || PR.msg; const bad = UI === 'error' || PR.err;
    const addresses = UI === 'empty' ? [] : N.data.addresses;
    const editing = typeof PR.addrMode === 'string' && PR.addrMode !== 'add' ? addresses.find((a) => a.id === PR.addrMode) : null;
    const html = `<div class="order-head"><div><span class="label gold">My account</span><h1 style="font-size:clamp(30px,3.6vw,48px)">My profile</h1></div></div>
      ${ok ? `<div class="alert ok" role="status">${I.checkCircle}<div><b>${esc(PR.msg || 'Profile updated')}</b></div></div>` : ''}${bad ? `<div class="alert bad" role="alert">${I.alert}<div><b>${esc(PR.err || 'Could not save your changes')}</b><p>Please try again.</p></div></div>` : ''}
      ${UI === 'warning' ? `<div class="alert warn">${I.alert}<div><b>Your profile has no pincode</b><p>Add one so delivery estimates are right.</p></div></div>` : ''}
      <form class="form" id="profile-form" novalidate>
        <section class="card"><div class="card-head"><h3>${I.user} Personal details</h3></div><div class="stack">
          <div class="row2"><div class="field"><label for="pf-first">First name</label><input class="input${e.first ? ' bad' : ''}" id="pf-first" name="first" value="${esc(u.first)}" autocomplete="given-name">${e.first ? `<span class="err">${e.first}</span>` : ''}</div><div class="field"><label for="pf-last">Last name</label><input class="input${e.last ? ' bad' : ''}" id="pf-last" name="last" value="${esc(u.last)}" autocomplete="family-name">${e.last ? `<span class="err">${e.last}</span>` : ''}</div></div>
          <div class="field"><label for="pf-display">Display name <small>how we greet you</small></label><input class="input${e.display ? ' bad' : ''}" id="pf-display" name="display" value="${esc(u.display || '')}" autocomplete="nickname">${e.display ? `<span class="err">${e.display}</span>` : ''}</div></div></section>
        <section class="card"><div class="card-head"><h3>${I.phone} Contact and location</h3></div><div class="stack">
          <div class="field"><label for="pf-phone">Mobile number <small>verified</small></label><div class="input-wrap"><input class="input" id="pf-phone" value="${prettyPhone(u.phone)}" disabled>${I.checkCircle}</div><span class="hint">To change your registered number, message us on <a class="link" href="${SHOP.wa('Hello, I would like to change the mobile number on my account.')}" target="_blank" rel="noopener">WhatsApp</a>.</span></div>
          <div class="row2"><div class="field"><label for="pf-state">State</label><select class="input" id="pf-state" name="state">${STATES.map((s) => `<option${s === u.state ? ' selected' : ''}>${s}</option>`).join('')}</select></div><div class="field"><label for="pf-pin">Pincode</label><input class="input${e.pincode ? ' bad' : ''}" id="pf-pin" name="pincode" inputmode="numeric" maxlength="6" value="${UI === 'warning' ? '' : esc(u.pincode)}" autocomplete="postal-code">${e.pincode ? `<span class="err">${e.pincode}</span>` : ''}</div></div></div></section>
        <div class="acts"><button class="btn btn-fill" type="submit">Save changes</button></div>
      </form>
      <section class="card"><div class="card-head"><h3>${I.pin} Addresses</h3>${PR.addrMode === null ? `<button class="under" type="button" data-act="add-address">${I.plus} Add address</button>` : ''}</div>
        ${PR.addrMode !== null ? addressForm(editing || {}, PR.addrErrs, editing ? 'edit' : 'add') : !addresses.length ? `<p class="note">No saved addresses yet. Add one to speed up checkout.</p>` : `<div class="addr-list">${addresses.map((a) => `<div class="addr"><span></span><div><b>${esc(a.fullName)}</b> · ${prettyPhone(a.phone)} ${a.isDefault ? '<span class="pill gold" style="margin-left:8px">Default</span>' : ''}<p>${addrText(a)}</p>${a.isDefault ? '' : `<button class="under" type="button" data-act="default-address" data-id="${a.id}" style="font-size:10px;margin-top:8px">Make default</button>`}</div><div class="acts-sm"><button class="icon-sm" type="button" data-act="edit-address" data-id="${a.id}" aria-label="Edit address">${I.pencil}</button><button class="icon-sm danger" type="button" data-act="delete-address" data-id="${a.id}" aria-label="Delete address">${I.trash}</button></div></div>`).join('')}</div>`}
      </section>
      <section class="card"><div class="card-head"><h3>${I.shield} Security</h3></div><div class="sec-row"><div class="kv"><span class="label">MPIN</span><span>Used to sign in with ${prettyPhone(maskPhone(u.phone))}</span></div><a class="btn btn-sm" href="#/forgot-mpin">${I.key} Change MPIN</a></div></section>`;
    PR.msg = ''; PR.err = ''; PR.errs = {};
    return html;
  }
  N.profileSubmit = (form) => {
    const v = (k) => form[k].value.trim(); const e = {};
    if (!v('first')) e.first = 'First name is required'; if (!v('last')) e.last = 'Last name is required'; if (!v('display')) e.display = 'Display name is required'; if (!/^\d{6}$/.test(v('pincode'))) e.pincode = 'Pincode must be 6 digits';
    PR.errs = e; if (Object.keys(e).length) return N.render(false);
    if (N.UI === 'error') { PR.err = 'Could not save your changes'; return N.render(false); }
    Object.assign(N.data.session, { first: v('first'), last: v('last'), display: v('display'), state: v('state'), pincode: v('pincode') }); if (N.data.profiles[N.data.session.phone]) N.data.profiles[N.data.session.phone] = { ...N.data.session };
    N.persist(); PR.msg = 'Profile updated'; N.UI = 'normal'; N.render(false); N.toast('Saved');
  };
  N.addressSubmit = (form) => {
    const v = (k) => form[k].value.trim(); const e = {};
    if (v('fullName').length < 2) e.fullName = 'Full name is required'; if (!/^\d{10}$/.test(v('phone'))) e.phone = 'Phone number must be 10 digits'; if (v('line1').length < 3) e.line1 = 'Address line is required'; if (v('city').length < 2) e.city = 'City is required'; if (!v('state')) e.state = 'State is required'; if (!/^\d{6}$/.test(v('pincode'))) e.pincode = 'Pincode must be 6 digits';
    const onCheckout = N.route.name === 'checkout'; const S = onCheckout ? CO : PR; S[onCheckout ? 'errs' : 'addrErrs'] = e;
    if (Object.keys(e).length) return N.render(false);
    const rec = { fullName: v('fullName'), phone: v('phone'), line1: v('line1'), line2: v('line2'), city: v('city'), state: v('state'), pincode: v('pincode'), isDefault: form.isDefault.checked };
    const id = form.dataset.mode === 'edit' ? form.dataset.id : 'a' + uid();
    if (rec.isDefault || !N.data.addresses.length) N.data.addresses.forEach((a) => { a.isDefault = false; }); if (!N.data.addresses.length) rec.isDefault = true;
    if (form.dataset.mode === 'edit') Object.assign(N.data.addresses.find((a) => a.id === id), rec); else N.data.addresses.unshift({ id, ...rec });
    N.persist(); if (onCheckout) { CO.adding = false; CO.addressId = id; } else { PR.addrMode = null; PR.msg = form.dataset.mode === 'edit' ? 'Address updated' : 'Address saved'; }
    N.render(false); N.toast(form.dataset.mode === 'edit' ? 'Address updated' : 'Address saved');
  };
  N.addressAct = async (act, id) => {
    const onCheckout = N.route.name === 'checkout';
    if (act === 'add-address') { if (onCheckout) CO.adding = true; else PR.addrMode = 'add'; N.render(false); setTimeout(() => $('#ad-name')?.focus(), 100); }
    else if (act === 'cancel-address') { if (onCheckout) { CO.adding = false; CO.errs = {}; } else { PR.addrMode = null; PR.addrErrs = {}; } N.render(false); }
    else if (act === 'edit-address') { PR.addrMode = id; N.render(false); setTimeout(() => $('#ad-name')?.focus(), 100); }
    else if (act === 'default-address') { N.data.addresses.forEach((a) => { a.isDefault = a.id === id; }); N.persist(); PR.msg = 'Default address updated'; N.render(false); }
    else if (act === 'delete-address') { const a = N.data.addresses.find((x) => x.id === id); if (await N.ask({ title: 'Delete this address?', text: `${a.line1}, ${a.city} will be removed from your saved addresses.`, ok: 'Delete', cancel: 'Keep', danger: true })) { N.data.addresses = N.data.addresses.filter((x) => x.id !== id); if (a.isDefault && N.data.addresses[0]) N.data.addresses[0].isDefault = true; N.persist(); PR.msg = 'Address deleted'; N.render(false); N.toast('Address deleted'); } }
    else if (act === 'select-address') { CO.addressId = id; N.render(false); }
  };
  N.logout = async () => { if (await N.ask({ title: 'Sign out?', text: 'Your bag stays on this device. Sign in again to see your orders.', ok: 'Sign out', cancel: 'Stay' })) { N.data.session = null; N.persist(); N.renderShell(); N.toast('Signed out'); N.go('#/'); } };
})();
