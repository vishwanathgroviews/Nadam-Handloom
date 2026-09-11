import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { X } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { api } from '../services/api';
import './CategoryPage.css';

const PAGE_SIZE = 12;

// A plain, filter-free product grid — used both for "Shop All" (/shop, no
// route params) and for a single Subcategory's listing
// (/category/:slug/:subcategoryId). The attribute-filter sidebar that used
// to live here has been removed entirely; a Subcategory is now the only way
// to narrow the catalog, chosen from the Category page's Subcategory grid.
export default function ProductListPage() {
  const { slug, subcategoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';

  const [meta, setMeta] = useState(null);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setMeta(null);
      return;
    }
    api
      .getSubcategories(slug)
      .then((data) => {
        const subcategory = subcategoryId ? data.subcategories.find((s) => s.id === subcategoryId) || null : null;
        setMeta({ category: data.category, subcategory });
      })
      .catch(() => setMeta(null));
  }, [slug, subcategoryId]);

  useEffect(() => {
    setPage(1);
  }, [slug, subcategoryId, q]);

  useEffect(() => {
    setLoading(true);
    api
      .getProducts({ category: slug, subcategoryId, q: q || undefined, sort, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setProducts(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setProducts([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [slug, subcategoryId, q, sort, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageTitle = meta?.subcategory?.name || meta?.category?.name || (q ? `Search results for "${q}"` : 'Shop All');

  const clearSearch = () => {
    searchParams.delete('q');
    setSearchParams(searchParams);
  };

  return (
    <div className="container category-page">
      <div className="breadcrumb">
        <Link to="/">Home</Link> <span>/</span>
        {meta?.category && (
          <>
            {' '}
            <Link to={`/category/${slug}`}>{meta.category.name}</Link> <span>/</span>
          </>
        )}
        {' '}
        <span>{pageTitle}</span>
      </div>

      <div className="category-page-header">
        <div>
          <h1 className="section-title">{pageTitle}</h1>
          {meta?.subcategory?.description && <p className="section-subtitle">{meta.subcategory.description}</p>}
          {q && (
            <button className="badge badge-muted category-clear-search" onClick={clearSearch}>
              "{q}" <X size={13} />
            </button>
          )}
        </div>

        <div className="category-page-controls">
          <select className="category-sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="featured">Best Sellers</option>
          </select>
        </div>
      </div>

      {loading && products.length === 0 ? (
        <p className="state-block">Loading products…</p>
      ) : products.length === 0 ? (
        <div className="state-block">
          <h3>No products found</h3>
          <p>Try a different search or check back soon.</p>
        </div>
      ) : (
        <>
          <p className="category-result-count">{total} product{total !== 1 ? 's' : ''}</p>
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="category-pagination">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <span>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
