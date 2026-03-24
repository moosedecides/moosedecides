import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import PromiseModal from '../components/PromiseModal';

const P = '#8b7cf8'; // brand purple
const P_LIGHT = 'rgba(139,124,248,0.10)';
const P_BORDER = 'rgba(139,124,248,0.35)';
const GREEN = '#2d6a4f';

export default function Home() {
  const [query, setQuery] = useState('');
  const [refinement, setRefinement] = useState('');
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(10000);
  const [priceActive, setPriceActive] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPromise, setShowPromise] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { image, title }

  const doSearch = async (opts = {}) => {
    const q = opts.query || query;
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      const body = { query: q };
      if (opts.refinement || refinement) body.refinement = opts.refinement || refinement;
      if (priceActive) body.priceRange = [priceMin, priceMax];
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setRefinement('');
    doSearch();
  };

  const handleRefine = (e) => {
    e.preventDefault();
    if (!refinement.trim()) return;
    doSearch({ refinement });
  };

  const handlePriceApply = () => {
    setPriceActive(true);
    if (results) doSearch({});
  };

  const labelStyles = {
    'Top Pick':   { bg: '#1a1a1a', text: '#fff' },
    'Best Value': { bg: GREEN, text: '#fff' },
    'Budget':     { bg: P, text: '#fff' },
  };

  const formatPrice = (v) => v >= 10000 ? '$10k' : v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`;

  return (
    <>
      <Head>
        <title>MooseDecides — Fast, honest recommendations</title>
        <meta name="description" content="Tell Moose what you need. Get 3 picks. Done." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta property="og:title" content="MooseDecides" />
        <meta property="og:description" content="Tell Moose what you need. Get 3 picks. Done." />
        <meta property="og:image" content="https://moosedecides.com/og-image.png" />
        <meta property="og:url" content="https://moosedecides.com" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="page">
        {/* HEADER */}
        <header className={results ? 'header compact' : 'header'}>
          <div className="brand">
            <div className={`moose-wrap${loading ? ' walking' : ''}`}>
              <img src="/moose-logo.png" alt="Moose" className="moose-icon" />
            </div>
            {!results && <h1>What do you need?</h1>}
          </div>
          <form onSubmit={handleSubmit} className="search-form">
            <div className="input-row">
              <input
                type="text"
                className="search-input"
                placeholder="best running shoes for flat feet under $150"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="search-btn" disabled={loading}>
              {loading ? 'Moose is thinking…' : 'Ask Moose'}
            </button>
          </form>
          {!results && !loading && (
            <p className="tagline">3 picks. No ads. No scrolling.</p>
          )}
        </header>

        {error && <p className="error">{error}</p>}

        {/* RESULTS AREA */}
        {results && (
          <div className="results-area">
            {/* PRICE SLIDER */}
            <div className="price-slider">
              <span className="slider-label">{formatPrice(10000)}</span>
              <div className="slider-track-wrap">
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="50"
                  value={priceMax}
                  onChange={(e) => {
                    const v = Math.max(parseInt(e.target.value), priceMin + 50);
                    setPriceMax(v);
                    setPriceActive(true);
                  }}
                  onMouseUp={handlePriceApply}
                  onTouchEnd={handlePriceApply}
                  className="v-slider slider-max"
                />
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="50"
                  value={priceMin}
                  onChange={(e) => {
                    const v = Math.min(parseInt(e.target.value), priceMax - 50);
                    setPriceMin(v);
                    setPriceActive(true);
                  }}
                  onMouseUp={handlePriceApply}
                  onTouchEnd={handlePriceApply}
                  className="v-slider slider-min"
                />
              </div>
              <span className="slider-label">{formatPrice(0)}</span>
              <div className="slider-values">
                <span className="slider-val-label">min</span>
                <span className="slider-val">{formatPrice(priceMin)}</span>
                <span className="slider-val-label">max</span>
                <span className="slider-val">{formatPrice(priceMax)}</span>
              </div>
            </div>

            {/* CARDS */}
            <div className="cards">
              {results.map((item, i) => {
                const style = labelStyles[item.label] || labelStyles['Top Pick'];
                return (
                  <div key={i} className="card">
                    {/* Top row: label + price */}
                    <div className="card-top">
                      <span className="label" style={{ background: style.bg, color: style.text }}>
                        {item.label}
                      </span>
                      {item.price && <span className="card-price">{item.price}</span>}
                    </div>

                    {/* Body: info left, image right, bottom-aligned */}
                    <div className="card-body">
                      <div className="card-info">
                        <div className="card-title">{item.title}</div>
                        <div className="card-summary">{item.summary}</div>
                        <div className="card-pros">
                          {item.pros.map((p, j) => (
                            <div key={j} className="pro">&#10003; {p}</div>
                          ))}
                          {item.con && <div className="con">&#10007; {item.con}</div>}
                        </div>
                        <div className="card-actions">
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="view-btn"
                             onClick={(e) => e.stopPropagation()}>
                            View Product →
                          </a>
                          {item.rating && (
                            <div className="card-rating">
                              Rating: {item.rating}/10{item.reviews ? ` · ${item.reviews.toLocaleString()} reviews` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="card-image-wrap">
                        {item.image ? (
                          <img
                            src={`/api/image-proxy?url=${encodeURIComponent(item.image)}`}
                            alt={item.title}
                            className="card-image"
                            onClick={() => setLightbox({ image: item.image, title: item.title })}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="card-image-placeholder" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* REFINEMENT BAR */}
        {results && (
          <form onSubmit={handleRefine} className="refine-form">
            <input
              type="text"
              className="refine-input"
              placeholder="Tell Moose what to change…"
              value={refinement}
              onChange={(e) => setRefinement(e.target.value)}
            />
            <button type="submit" className="refine-btn" disabled={loading}>
              Refine
            </button>
          </form>
        )}

        <footer>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/disclosure">Disclosure</a>
        </footer>
      </div>

      {/* OUR PROMISE */}
      <button className="promise-btn" onClick={() => setShowPromise(true)}>Our Promise</button>
      {showPromise && <PromiseModal onClose={() => setShowPromise(false)} />}

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="lb-overlay" onClick={() => setLightbox(null)}>
          <div className="lb-content" onClick={(e) => e.stopPropagation()}>
            <button className="lb-close" onClick={() => setLightbox(null)}>✕</button>
            <img
              src={`/api/image-proxy?url=${encodeURIComponent(lightbox.image)}`}
              alt={lightbox.title}
              className="lb-image"
            />
            <p className="lb-title">{lightbox.title}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ——— PAGE ——— */
        .page {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f7f6f3;
          color: #111;
        }

        /* ——— HEADER ——— */
        .header {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 20px 20px;
          gap: 12px;
          transition: padding 0.25s;
        }
        .header.compact {
          padding: 14px 20px 10px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .moose-wrap { width: 38px; height: 38px; flex-shrink: 0; }
        .moose-icon {
          width: 38px; height: 38px; object-fit: contain;
          filter: drop-shadow(0 0 1.5px ${P}) drop-shadow(0 0 1.5px ${P});
        }
        @keyframes walk {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-3px) rotate(1deg); }
        }
        .walking .moose-icon { animation: walk 0.5s ease-in-out infinite; }
        h1 { font-size: 1.5rem; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
        .tagline { font-size: 0.85rem; color: #999; margin: 0; }

        /* ——— SEARCH FORM ——— */
        .search-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 580px;
        }
        .input-row {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1.5px solid ${P};
          border-radius: 12px;
          padding: 4px;
          box-shadow: 0 2px 16px rgba(139,124,248,0.15);
          transition: box-shadow 0.2s;
        }
        .input-row:focus-within { box-shadow: 0 2px 22px rgba(139,124,248,0.28); }
        .search-input {
          flex: 1; padding: 10px 12px; font-size: 0.95rem;
          border: none; background: transparent; outline: none; color: #111;
        }
        .search-btn {
          width: 100%; padding: 13px 20px; font-size: 0.9rem; font-weight: 600;
          background: #111; color: #fff; border: none; border-radius: 10px;
          cursor: pointer; transition: background 0.15s;
        }
        .search-btn:hover:not(:disabled) { background: #333; }
        .search-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .error { font-size: 0.85rem; color: #c0392b; text-align: center; margin: 0; }

        /* ——— RESULTS AREA ——— */
        .results-area {
          display: flex;
          gap: 6px;
          padding: 0 12px;
          width: 100%;
          max-width: 640px;
          margin: 0 auto;
          flex: 1;
        }

        /* ——— PRICE SLIDER (vertical) ——— */
        .price-slider {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 36px;
          flex-shrink: 0;
          padding-top: 4px;
          gap: 2px;
        }
        .slider-label {
          font-size: 0.65rem;
          font-weight: 600;
          color: ${P};
        }
        .slider-track-wrap {
          flex: 1;
          width: 24px;
          position: relative;
          min-height: 200px;
        }
        .v-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 200px;
          height: 4px;
          background: transparent;
          position: absolute;
          left: 50%;
          top: 50%;
          transform-origin: center center;
          transform: translateX(-50%) translateY(-50%) rotate(-90deg);
          pointer-events: none;
          z-index: 2;
        }
        .slider-min { z-index: 3; }
        .slider-max {
          z-index: 2;
        }
        .v-slider::-webkit-slider-track {
          height: 4px;
          background: rgba(139,124,248,0.2);
          border-radius: 2px;
        }
        .v-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px; height: 16px;
          background: ${P};
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(139,124,248,0.4);
          cursor: pointer;
          pointer-events: all;
          margin-top: -6px;
        }
        .v-slider::-moz-range-track {
          height: 4px;
          background: rgba(139,124,248,0.2);
          border-radius: 2px;
          border: none;
        }
        .v-slider::-moz-range-thumb {
          width: 16px; height: 16px;
          background: ${P};
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(139,124,248,0.4);
          cursor: pointer;
          pointer-events: all;
        }
        .slider-values {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          margin-top: 4px;
        }
        .slider-val-label {
          font-size: 0.58rem;
          color: rgba(139,124,248,0.6);
        }
        .slider-val {
          font-size: 0.72rem;
          font-weight: 600;
          color: ${P};
        }

        /* ——— CARDS ——— */
        .cards {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 12px 14px;
          border: 1.5px solid ${P};
          box-shadow: 0 2px 12px rgba(139,124,248,0.08);
          transition: box-shadow 0.2s, transform 0.15s;
        }
        .card:hover {
          box-shadow: 0 4px 20px rgba(139,124,248,0.18);
          transform: translateY(-1px);
        }

        /* Card top: label + price */
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
        }
        .label {
          font-size: 0.62rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          padding: 3px 8px;
          border-radius: 5px;
        }
        .card-price {
          font-size: 1.15rem;
          font-weight: 700;
          color: ${GREEN};
        }

        /* Card body: info + image bottom-aligned */
        .card-body {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }
        .card-info {
          flex: 1;
          min-width: 0;
        }
        .card-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #111;
          line-height: 1.25;
          margin-bottom: 2px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-summary {
          font-size: 0.78rem;
          color: #888;
          line-height: 1.35;
          margin-bottom: 5px;
        }
        .card-pros {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .pro { font-size: 0.78rem; color: ${GREEN}; }
        .con { font-size: 0.78rem; color: #999; font-style: italic; }

        /* Card actions: view button + rating */
        .card-actions {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .view-btn {
          display: inline-block;
          padding: 5px 14px;
          font-size: 0.78rem;
          font-weight: 600;
          color: ${P};
          background: rgba(139,124,248,0.08);
          border: 1px solid ${P_BORDER};
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.15s;
          width: fit-content;
        }
        .view-btn:hover { background: rgba(139,124,248,0.15); }
        .card-rating {
          font-size: 0.75rem;
          font-weight: 600;
          color: ${GREEN};
        }

        /* Card image */
        .card-image-wrap {
          flex-shrink: 0;
          display: flex;
          align-items: flex-end;
        }
        .card-image {
          width: 100px;
          height: 100px;
          object-fit: contain;
          border-radius: 8px;
          background: #f7f6f3;
          border: 1.5px solid ${P};
          cursor: pointer;
          transition: opacity 0.15s, box-shadow 0.15s;
        }
        .card-image:hover {
          opacity: 0.85;
          box-shadow: 0 2px 12px rgba(139,124,248,0.25);
        }
        .card-image-placeholder {
          width: 100px;
          height: 100px;
          border-radius: 8px;
          background: #f0ede8;
        }

        /* ——— REFINE BAR ——— */
        .refine-form {
          display: flex;
          gap: 6px;
          padding: 8px 16px 0;
          width: 100%;
          max-width: 640px;
          margin: 0 auto;
          padding-left: 54px;
        }
        .refine-input {
          flex: 1;
          padding: 8px 12px;
          font-size: 0.82rem;
          border: 1.5px solid ${P};
          border-radius: 8px;
          background: #fff;
          outline: none;
          color: #111;
          box-shadow: 0 1px 8px rgba(139,124,248,0.1);
        }
        .refine-input:focus { box-shadow: 0 1px 14px rgba(139,124,248,0.22); }
        .refine-input::placeholder { color: #bbb; }
        .refine-btn {
          padding: 8px 16px;
          font-size: 0.82rem;
          font-weight: 600;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
        }
        .refine-btn:hover:not(:disabled) { background: #333; }
        .refine-btn:disabled { opacity: 0.5; }

        /* ——— FOOTER ——— */
        footer {
          text-align: center;
          padding: 14px;
          display: flex;
          justify-content: center;
          gap: 18px;
          flex-shrink: 0;
        }
        footer a {
          color: #ccc; text-decoration: none; font-size: 0.75rem;
        }
        footer a:hover { color: #888; }

        .promise-btn {
          position: fixed;
          bottom: 18px; right: 18px;
          padding: 8px 14px;
          font-size: 0.72rem;
          font-weight: 600;
          background: #fff;
          color: #666;
          border: 1px solid #ddd;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.07);
          z-index: 100;
        }
        .promise-btn:hover { box-shadow: 0 3px 14px rgba(0,0,0,0.11); }

        /* ——— LIGHTBOX ——— */
        .lb-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }
        .lb-content {
          position: relative;
          max-width: 500px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .lb-close {
          position: absolute;
          top: -12px; right: -12px;
          width: 32px; height: 32px;
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 50%;
          color: #fff;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          z-index: 10;
        }
        .lb-close:hover { background: rgba(255,255,255,0.3); }
        .lb-image {
          max-width: 100%;
          max-height: 70vh;
          object-fit: contain;
          border-radius: 12px;
          background: #fff;
          padding: 16px;
        }
        .lb-title {
          color: rgba(255,255,255,0.7);
          font-size: 0.85rem;
          text-align: center;
          margin: 0;
        }

        /* ——— MOBILE ——— */
        @media (max-width: 480px) {
          .header { padding: 32px 14px 14px; }
          .header.compact { padding: 10px 14px 8px; }
          h1 { font-size: 1.25rem; }
          .search-form { gap: 6px; }
          .search-btn { padding: 12px; }
          .results-area { gap: 4px; padding: 0 8px; }
          .cards { gap: 6px; }
          .card { padding: 10px 10px; border-radius: 12px; }
          .card-price { font-size: 1.05rem; }
          .card-title { font-size: 0.85rem; }
          .card-image { width: 88px; height: 88px; }
          .card-image-placeholder { width: 88px; height: 88px; }
          .refine-form { padding: 6px 12px 0; padding-left: 48px; }
          .price-slider { width: 32px; }
        }
      `}</style>
    </>
  );
}
