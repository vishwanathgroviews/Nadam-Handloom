import { Link } from 'react-router-dom';
import { BackRow, EmptyState } from '../../components/bits.jsx';
import { useTitle } from '../../utils/useTitle.js';

// Also used for a saree, collection or category that is no longer on the website.
export default function NotFoundPage({ title = "We couldn't find that page", text = 'The link may be old, or the address has a typo.' }) {
  useTitle('Page not found');
  return (
    <div className="wrap narrow">
      <BackRow />
      <EmptyState icon="search" title={title} text={text}>
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          <Link className="btn btn-primary" to="/shop">See all sarees</Link>
          <Link className="btn" to="/">Go to the home page</Link>
        </div>
      </EmptyState>
    </div>
  );
}
