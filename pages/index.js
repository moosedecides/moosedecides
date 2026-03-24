import { useState, useRef, useCallback } from 'react';
import Head from 'next/head';
import PromiseModal from '../components/PromiseModal';

const P = '#8b7cf8';
const GREEN = '#2d6a4f';

// Exponential: 80% of track = $0-$1000, top 20% = $1000-$10000
function s2p(pct) {
  if (pct <= 0.8) return Math.round((pct / 0.8) * 1000 / 25) * 25;
  return Math.round((1000 + ((pct - 0.8) / 0.2) * 9000) / 50) * 50;
}
function p2s(price) {
  if (price <= 1000) return (price / 1000) * 0.8;
  return 0.8 + ((price - 1000) / 9000) * 0.2;
}
function fmt(v) {
  if (v >= 10000) return '$10k';
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `$${v}`;
}

// Reusable dual-thumb slider (works both horizontal and vertical)
function DualSlider({ min, max, onMin, onMax, vertical }) {
  const trackRef = useRef(null);

  const getPrice = useCallback((clientPos) => {
    const rect = trackRef.current.getBoundingClientRect();
    let pct;
    if (vertical) {
      pct = 1 - Math.max(0, Math.min(1, (clientPos - rect.top) / rect.height));
    } else {
      pct = Math.max(0, Math.min(1, (clientPos - rect.left) / rect.width));
    }
    return s2p(pct);
  }, [vertical]);

  const startDrag = useCallback((which) => (e) => {
    e.preventDefault();
    const onMove = (ev) => {
      const pos = vertical
        ? (ev.touches ? ev.touches[0].clientY : ev.clientY)
        : (ev.touches ? ev.touches[0].clientX : ev.clientX);
      const price = getPrice(pos);
      if (which === 'min') onMin(Math.min(price, max - 25));
      else onMax(Math.max(price, min + 25));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, [min, max, getPrice, onMin, onMax, vertical]);

  const minPct = p2s(min) * 100;
  const maxPct = p2s(max) * 100;

  if (vertical) {
    const minTop = (1 - p2s(min)) * 100;
    const maxTop = (1 - p2s(max)) * 100;
    return (
      <div className="vs">
        <span className="vs-edge">{fmt(10000)}</span>
        <div className="vs-track" ref={trackRef}>
          <div className="vs-rail" />
          <div className="vs-fill" style={{ top: `${maxTop}%`, bottom: `${100 - minTop}%` }} />
          <div className="vs-thumb" style={{ top: `${maxTop}%` }}
            onMouseDown={startDrag('max')} onTouchStart={startDrag('max')} />
          <div className="vs-thumb" style={{ top: `${minTop}%` }}
            onMouseDown={startDrag('min')} onTouchStart={startDrag('min')} />
        </div>
        <span className="vs-edge">{fmt(0)}</span>
        <div className="vs-vals">
          <span className="vs-vlbl">min</span><span className="vs-v">{fmt(min)}</span>
          <span className="vs-vlbl">max</span><span className="vs-v">{fmt(max)}</span>
        </div>
        <style jsx>{`
          .vs { display:flex; flex-direction:column; align-items:center; width:44px; flex-shrink:0; padding:4px 4px 0; user-select:none; -webkit-user-select:none; }
          .vs-edge { font-size:0.62rem; font-weight:600; color:${P}; }
          .vs-track { flex:1; width:44px; position:relative; margin:6px 0; min-height:180px; touch-action:none; }
          .vs-rail { position:absolute; left:50%; top:0; bottom:0; width:5px; transform:translateX(-50%); background:rgba(139,124,248,0.18); border-radius:3px; }
          .vs-fill { position:absolute; left:50%; width:5px; transform:translateX(-50%); background:${P}; border-radius:3px; }
          .vs-thumb { position:absolute; left:50%; width:22px; height:22px; transform:translate(-50%,-50%); background:${P}; border:3px solid #fff; border-radius:50%; box-shadow:0 1px 6px rgba(139,124,248,0.45); cursor:grab; z-index:2; touch-action:none; }
          .vs-thumb:active { cursor:grabbing; transform:translate(-50%,-50%) scale(1.15); }
          .vs-vals { display:flex; flex-direction:column; align-items:center; gap:0; margin-top:4px; }
          .vs-vlbl { font-size:0.55rem; color:rgba(139,124,248,0.55); }
          .vs-v { font-size:0.72rem; font-weight:600; color:${P}; }
        `}</style>
      </div>
    );
  }

  // Horizontal
  return (
    <div className="hs">
      <div className="hs-labels">
        <span className="hs-lbl">Price Range</span>
        <span className="hs-range">{fmt(min)} – {fmt(max)}</span>
      </div>
      <div className="hs-track" ref={trackRef}>
        <div className="hs-rail" />
        <div className="hs-fill" style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }} />
        <div className="hs-thumb" style={{ left: `${minPct}%` }}
          onMouseDown={startDrag('min')} onTouchStart={startDrag('min')} />
        <div className="hs-thumb" style={{ left: `${maxPct}%` }}
          onMouseDown={startDrag('max')} onTouchStart={startDrag('max')} />
      </div>
      <div className="hs-ends">
        <span>{fmt(0)}</span><span>{fmt(10000)}</span>
      </div>
      <style jsx>{`
        .hs { width:100%; max-width:560px; padding:0; user-select:none; -webkit-user-select:none; }
        .hs-labels { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .hs-lbl { font-size:0.75rem; font-weight:600; color:${P}; }
        .hs-range { font-size:0.82rem; font-weight:700; color:${P}; }
        .hs-track { position:relative; height:44px; touch-action:none; display:flex; align-items:center; }
        .hs-rail { position:absolute; left:0; right:0; height:5px; background:rgba(139,124,248,0.18); border-radius:3px; }
        .hs-fill { position:absolute; height:5px; background:${P}; border-radius:3px; }
        .hs-thumb { position:absolute; top:50%; width:24px; height:24px; transform:translate(-50%,-50%); background:${P}; border:3px solid #fff; border-radius:50%; box-shadow:0 1px 6px rgba(139,124,248,0.45); cursor:grab; z-index:2; touch-action:none; }
        .hs-thumb:active { cursor:grabbing; transform:translate(-50%,-50%) scale(1.15); }
        .hs-ends { display:flex; justify-content:space-between; margin-top:2px; }
        .hs-ends span { font-size:0.62rem; color:rgba(139,124,248,0.5); font-weight:500; }
      `}</style>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [refinement, setRefinement] = useState('');
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(10000);
  const [results, setResults] = useState(null);
  const [easterEgg, setEasterEgg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPromise, setShowPromise] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const hasPriceFilter = priceMin > 0 || priceMax < 10000;

  const doSearch = async (opts = {}) => {
    const q = opts.query || query;
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    setEasterEgg(null);
    try {
      const body = { query: q };
      if (opts.refinement || refinement) body.refinement = opts.refinement || refinement;
      if (hasPriceFilter) body.priceRange = [priceMin, priceMax];
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.easter_egg) { setResults(null); setEasterEgg(data.message); }
      else if (data.error) throw new Error(data.error);
      else { setResults(data.results); setEasterEgg(null); }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); setRefinement(''); doSearch(); };
  const handleRefine = (e) => { e.preventDefault(); if (!refinement.trim()) return; doSearch({ refinement }); };

  const labelStyles = {
    'Top Pick': { bg: '#1a1a1a', text: '#fff' },
    'Best Value': { bg: GREEN, text: '#fff' },
    'Budget': { bg: P, text: '#fff' },
  };

  const hasResults = results || easterEgg;

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
        <header className={hasResults ? 'hdr compact' : 'hdr'}>
          <div className="brand">
            <div className={`mw${loading ? ' walking' : ''}`}>
              <img src="/moose-logo.png" alt="Moose" className="mi" />
            </div>
            {!hasResults && <h1>What do you need?</h1>}
          </div>
          <form onSubmit={handleSubmit} className="sf">
            <div className="sf-row">
              <input type="text" className="sf-in" value={query}
                placeholder="best running shoes for flat feet under $150"
                onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button type="submit" className="sf-btn" disabled={loading}>
              {loading ? 'Moose is thinking…' : 'Ask Moose'}
            </button>
          </form>

          {/* Horizontal price slider BEFORE search */}
          {!hasResults && (
            <DualSlider min={priceMin} max={priceMax}
              onMin={setPriceMin} onMax={setPriceMax} vertical={false} />
          )}

          {!hasResults && !loading && <p className="tag">3 picks. No ads. No scrolling.</p>}
        </header>

        {error && <p className="err">{error}</p>}

        {/* Easter egg */}
        {easterEgg && (
          <div className="egg-w">
            <div className="egg">
              <img src="/moose-logo.png" alt="Moose" className="egg-m" />
              <p className="egg-t">{easterEgg}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="ra">
            <DualSlider min={priceMin} max={priceMax}
              onMin={setPriceMin} onMax={setPriceMax} vertical={true} />
            <div className="cards">
              {results.map((item, i) => {
                const ls = labelStyles[item.label] || labelStyles['Top Pick'];
                return (
                  <div key={i} className="card">
                    <div className="ct">
                      <span className="cl" style={{ background: ls.bg, color: ls.text }}>{item.label}</span>
                      {item.price && <span className="cp">{item.price}</span>}
                    </div>
                    <div className="cb">
                      <div className="ci">
                        <div className="ct2">{item.title}</div>
                        <div className="cs">{item.summary}</div>
                        <div className="cps">
                          {item.pros.map((p, j) => <div key={j} className="cpro">&#10003; {p}</div>)}
                          {item.con && <div className="ccon">&#10007; {item.con}</div>}
                        </div>
                        <div className="ca">
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="cvb"
                            onClick={(e) => e.stopPropagation()}>View Product →</a>
                          {item.rating && (
                            <div className="cr">Rating: {item.rating}/10{item.reviews ? ` · ${item.reviews.toLocaleString()} reviews` : ''}</div>
                          )}
                        </div>
                      </div>
                      <div className="ciw">
                        {item.image ? (
                          <img src={`/api/image-proxy?url=${encodeURIComponent(item.image)}`}
                            alt={item.title} className="cimg"
                            onClick={() => setLightbox({ image: item.image, title: item.title })}
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : <div className="ciph" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {results && (
          <form onSubmit={handleRefine} className="rf">
            <input type="text" className="rf-in" value={refinement}
              placeholder="Tell Moose what to change…"
              onChange={(e) => setRefinement(e.target.value)} />
            <button type="submit" className="rf-btn" disabled={loading}>Refine</button>
          </form>
        )}

        <footer><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclosure">Disclosure</a></footer>
      </div>

      <button className="pb" onClick={() => setShowPromise(true)}>Our Promise</button>
      {showPromise && <PromiseModal onClose={() => setShowPromise(false)} />}

      {lightbox && (
        <div className="lb" onClick={() => setLightbox(null)}>
          <div className="lbi" onClick={(e) => e.stopPropagation()}>
            <button className="lbx" onClick={() => setLightbox(null)}>✕</button>
            <img src={`/api/image-proxy?url=${encodeURIComponent(lightbox.image)}`}
              alt={lightbox.title} className="lbimg" />
            <p className="lbt">{lightbox.title}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .page { min-height:100vh; min-height:100dvh; display:flex; flex-direction:column; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f7f6f3; color:#111; }

        .hdr { display:flex; flex-direction:column; align-items:center; padding:48px 20px 18px; gap:12px; transition:padding 0.25s; }
        .hdr.compact { padding:14px 20px 10px; }
        .brand { display:flex; align-items:center; gap:10px; }
        .mw { width:38px; height:38px; flex-shrink:0; }
        .mi { width:38px; height:38px; object-fit:contain; filter:drop-shadow(0 0 1.5px ${P}) drop-shadow(0 0 1.5px ${P}); }
        @keyframes walk { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-3px) rotate(1deg)} }
        .walking .mi { animation:walk 0.5s ease-in-out infinite; }
        h1 { font-size:1.5rem; font-weight:700; margin:0; letter-spacing:-0.3px; }
        .tag { font-size:0.85rem; color:#999; margin:0; }

        .sf { display:flex; flex-direction:column; gap:8px; width:100%; max-width:560px; }
        .sf-row { display:flex; background:#fff; border:1.5px solid ${P}; border-radius:12px; padding:4px; box-shadow:0 2px 16px rgba(139,124,248,0.15); transition:box-shadow 0.2s; }
        .sf-row:focus-within { box-shadow:0 2px 22px rgba(139,124,248,0.28); }
        .sf-in { flex:1; padding:10px 12px; font-size:0.95rem; border:none; background:transparent; outline:none; color:#111; }
        .sf-btn { width:100%; padding:13px; font-size:0.9rem; font-weight:600; background:#111; color:#fff; border:none; border-radius:10px; cursor:pointer; transition:background 0.15s; }
        .sf-btn:hover:not(:disabled) { background:#333; }
        .sf-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .err { font-size:0.85rem; color:#c0392b; text-align:center; margin:0; }

        .egg-w { display:flex; justify-content:center; padding:20px; flex:1; }
        .egg { max-width:480px; background:#fff; border:1.5px solid ${P}; border-radius:16px; padding:28px 24px; text-align:center; box-shadow:0 4px 24px rgba(139,124,248,0.12); }
        .egg-m { width:64px; height:64px; margin-bottom:12px; filter:drop-shadow(0 0 2px ${P}); }
        .egg-t { font-size:1rem; color:#333; line-height:1.5; margin:0; }

        .ra { display:flex; gap:4px; padding:0 10px; width:100%; max-width:600px; margin:0 auto; flex:1; }

        .cards { flex:1; display:flex; flex-direction:column; gap:8px; min-width:0; }
        .card { background:#fff; border-radius:14px; padding:11px 13px; border:1.5px solid ${P}; box-shadow:0 2px 12px rgba(139,124,248,0.08); transition:box-shadow 0.2s,transform 0.15s; }
        .card:hover { box-shadow:0 4px 20px rgba(139,124,248,0.18); transform:translateY(-1px); }

        .ct { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px; }
        .cl { font-size:0.6rem; font-weight:700; text-transform:uppercase; letter-spacing:0.7px; padding:3px 8px; border-radius:5px; }
        .cp { font-size:1.15rem; font-weight:700; color:${GREEN}; }

        .cb { display:flex; gap:8px; align-items:flex-end; }
        .ci { flex:1; min-width:0; }
        .ct2 { font-size:0.88rem; font-weight:700; color:#111; line-height:1.25; margin-bottom:2px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .cs { font-size:0.75rem; color:#888; line-height:1.35; margin-bottom:4px; }
        .cps { display:flex; flex-direction:column; gap:1px; }
        .cpro { font-size:0.75rem; color:${GREEN}; }
        .ccon { font-size:0.75rem; color:#999; font-style:italic; }

        .ca { margin-top:7px; display:flex; flex-direction:column; gap:3px; }
        .cvb { display:inline-block; padding:5px 13px; font-size:0.75rem; font-weight:600; color:${P}; background:rgba(139,124,248,0.08); border:1px solid rgba(139,124,248,0.3); border-radius:6px; text-decoration:none; width:fit-content; transition:background 0.15s; }
        .cvb:hover { background:rgba(139,124,248,0.15); }
        .cr { font-size:0.72rem; font-weight:600; color:${GREEN}; }

        .ciw { flex-shrink:0; display:flex; align-items:flex-end; }
        .cimg { width:100px; height:100px; object-fit:contain; border-radius:8px; background:#f7f6f3; border:1.5px solid ${P}; cursor:pointer; transition:opacity 0.15s,box-shadow 0.15s; }
        .cimg:hover { opacity:0.85; box-shadow:0 2px 12px rgba(139,124,248,0.25); }
        .ciph { width:100px; height:100px; border-radius:8px; background:#f0ede8; }

        .rf { display:flex; gap:6px; padding:8px 10px 0; width:100%; max-width:600px; margin:0 auto; padding-left:58px; }
        .rf-in { flex:1; padding:8px 12px; font-size:0.82rem; border:1.5px solid ${P}; border-radius:8px; background:#fff; outline:none; color:#111; box-shadow:0 1px 8px rgba(139,124,248,0.1); }
        .rf-in:focus { box-shadow:0 1px 14px rgba(139,124,248,0.22); }
        .rf-in::placeholder { color:#bbb; }
        .rf-btn { padding:8px 16px; font-size:0.82rem; font-weight:600; background:#111; color:#fff; border:none; border-radius:8px; cursor:pointer; white-space:nowrap; }
        .rf-btn:hover:not(:disabled) { background:#333; }
        .rf-btn:disabled { opacity:0.5; }

        footer { text-align:center; padding:14px; display:flex; justify-content:center; gap:18px; flex-shrink:0; }
        footer a { color:#ccc; text-decoration:none; font-size:0.75rem; }
        footer a:hover { color:#888; }
        .pb { position:fixed; bottom:18px; right:18px; padding:8px 14px; font-size:0.72rem; font-weight:600; background:#fff; color:#666; border:1px solid #ddd; border-radius:50px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,0.07); z-index:100; }
        .pb:hover { box-shadow:0 3px 14px rgba(0,0,0,0.11); }

        .lb { position:fixed; inset:0; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center; z-index:2000; padding:20px; }
        .lbi { position:relative; max-width:500px; width:100%; display:flex; flex-direction:column; align-items:center; gap:12px; }
        .lbx { position:absolute; top:-14px; right:-14px; width:34px; height:34px; background:rgba(255,255,255,0.15); border:none; border-radius:50%; color:#fff; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10; }
        .lbx:hover { background:rgba(255,255,255,0.3); }
        .lbimg { max-width:100%; max-height:70vh; object-fit:contain; border-radius:12px; background:#fff; padding:16px; }
        .lbt { color:rgba(255,255,255,0.7); font-size:0.85rem; text-align:center; margin:0; }

        @media (max-width:480px) {
          .hdr { padding:32px 14px 14px; }
          .hdr.compact { padding:10px 14px 8px; }
          h1 { font-size:1.25rem; }
          .sf-btn { padding:12px; }
          .ra { gap:3px; padding:0 6px; }
          .cards { gap:6px; }
          .card { padding:9px 10px; }
          .cp { font-size:1.05rem; }
          .ct2 { font-size:0.82rem; }
          .cimg { width:88px; height:88px; }
          .ciph { width:88px; height:88px; }
          .rf { padding-left:52px; padding-right:6px; }
        }
      `}</style>
    </>
  );
}
