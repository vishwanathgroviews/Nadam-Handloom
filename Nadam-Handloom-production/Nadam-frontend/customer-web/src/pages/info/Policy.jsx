// A policy page (W6: Razorpay asks for shipping, cancellation and refunds, and contact pages).
// DRAFTS for the shop: the owner gives the final text before payments go live.
import { Crumbs } from '../../components/bits.jsx';
import { useTitle } from '../../utils/useTitle.js';

// sections: [[heading, text or [points]]]
export default function Policy({ title, intro, sections }) {
  useTitle(title);
  return (
    <div className="wrap narrow page-enter">
      <div className="page-head">
        <Crumbs items={[['Home', '/'], [title]]} />
        <span className="draft-note">Draft: to be reviewed by the shop</span>
        <h1>{title}</h1>
      </div>
      <div className="prose" style={{ paddingBottom: 'clamp(48px,6vw,90px)' }}>
        <p>{intro}</p>
        {sections.map(([h, body]) => (
          <section key={h}>
            <h2>{h}</h2>
            {Array.isArray(body) ? <ul>{body.map((x) => <li key={typeof x === 'string' ? x : x.key}>{x}</li>)}</ul> : <p>{body}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
