import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { api } from '../services/api';
import './CategoryPage.css';

const DESKTOP_PAGE_SIZE = 24;
const MOBILE_PAGE_SIZE = 12;

function getResponsivePageSize() {
  if (typeof window === 'undefined') return DESKTOP_PAGE_SIZE;
  return window.innerWidth < 768 ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
}

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = [];
  if (currentPage <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...');
    pages.push(totalPages);
  } else if (currentPage >= totalPages - 3) {
    pages.push(1);
    pages.push('...');
    for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push('...');
    pages.push(currentPage - 1);
    pages.push(currentPage);
    pages.push(currentPage + 1);
    pages.push('...');
    pages.push(totalPages);
  }
  return pages;
}

export default function ProductListPage() {
  const { slug, subcategoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const isFeatured = searchParams.get('featured') === 'true';

  const [meta, setMeta] = useState(null);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(getResponsivePageSize);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);

  const listingTopRef = useRef(null);
  const shouldScrollOnRenderRef = useRef(false);

  // Responsive page size updates if device crosses the mobile/desktop boundary
  useEffect(() => {
    const handleResize = () => {
      const newSize = getResponsivePageSize();
      setPageSize((prev) => (prev !== newSize ? newSize : prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  }, [slug, subcategoryId, q, isFeatured]);

  useEffect(() => {
    setLoading(true);
    api
      .getProducts({
        category: slug,
        subcategoryId,
        q: q || undefined,
        featured: isFeatured ? true : undefined,
        sort,
        page,
        pageSize,
      })
      .then((res) => {
        setProducts(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setProducts([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [slug, subcategoryId, q, isFeatured, sort, page, pageSize]);

  // Automatically scroll to the top of the product listing when changing pages or sort
  useEffect(() => {
    if (shouldScrollOnRenderRef.current && !loading) {
      shouldScrollOnRenderRef.current = false;
      requestAnimationFrame(() => {
        const headerHeight = 85;
        const listingEl = listingTopRef.current;
        if (listingEl) {
          const rect = listingEl.getBoundingClientRect();
          const targetTop = rect.top + window.pageYOffset - headerHeight;
          window.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth',
          });
        } else {
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      });
    }
  }, [products, loading]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageTitle = meta?.subcategory?.name
    || (meta?.category?.name ? (isFeatured ? `${meta.category.name} — Best Sellers` : meta.category.name) : null)
    || (q ? `Search results for "${q}"` : (isFeatured ? 'Best Sellers' : 'Shop All'));

  const handlePageChange = (newPage) => {
    if (newPage === page || newPage < 1 || newPage > totalPages) return;
    shouldScrollOnRenderRef.current = true;
    setPage(newPage);
  };

  const handleSortChange = (e) => {
    setSort(e.target.value);
    shouldScrollOnRenderRef.current = true;
    setPage(1);
  };

  const clearSearch = () => {
    searchParams.delete('q');
    setSearchParams(searchParams);
  };

  return (
    <div ref={listingTopRef} className="container category-page">
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
          {!meta?.subcategory?.description && isFeatured && (
            <p className="section-subtitle">Our most popular and loved handwoven sarees</p>
          )}
          {q && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              <button className="badge badge-muted category-clear-search" onClick={clearSearch}>
                "{q}" <X size={13} />
              </button>
            </div>
          )}
        </div>

        <div className="category-page-controls">
          <select className="category-sort" value={sort} onChange={handleSortChange} aria-label="Sort products">
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
            <nav className="category-pagination" aria-label="Product pagination">
              <button
                type="button"
                className="btn btn-ghost btn-sm category-page-prev"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              <div className="category-page-numbers">
                {getPageNumbers(page, totalPages).map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="category-pagination-ellipsis" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`category-page-num ${page === p ? 'active' : ''}`}
                      onClick={() => handlePageChange(p)}
                      aria-current={page === p ? 'page' : undefined}
                      aria-label={`Page ${p}`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm category-page-next"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
