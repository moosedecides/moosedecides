import { useState } from 'react';
import Head from 'next/head';
import PromiseModal from '../components/PromiseModal';

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPromise, setShowPromise] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const labelColors = {
    'Top Pick':   { bg: '#1a1a1a', text: '#fff' },
    'Best Value': { bg: '#2d6a4f', text: '#fff' },
    'Budget':     { bg: '#5c5470', text: '#fff' },
  };
  const labels = ['Top Pick', 'Best Value', 'Budget'];

  return (
    <>
      <Head>
        <title>MooseDecides — Fast, honest recommendations</title>
        <meta name="description" content="Fast, honest product recommendations. No noise." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Link preview (OG tags) */}
        <meta property="og:title" content="MooseDecides" />
        <meta property="og:description" content="Fast, honest product recommendations. No noise." />
        <meta property="og:image" content="https://moosedecides.com/apple-touch-icon.png" />
        <meta property="og:url" content="https://moosedecides.com" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:image" content="https://moosedecides.com/apple-touch-icon.png" />
      </Head>

      <div className="wrap">
        <main>
          {/* Header */}
          <div className="header">
            <h1>What do you need help choosing?</h1>
            <p>Fast, honest recommendations. No noise.</p>

            <form onSubmit={handleSubmit} className="form">
              <div className="input-row">
                <div className={`moose-wrap${loading ? ' walking' : ''}`}>
                  <img src="/moose-logo.png" alt="Moose" className="moose-icon" />
                </div>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. best office chair with no lumbar support"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="btn" disabled={loading}>
                {loading ? 'Moose is thinking…' : 'Ask Moose'}
              </button>
            </form>
          </div>

          {error && <p className="error">{error}</p>}

          {/* Results */}
          {results && (
            <div className="results">
              {results.map((item, i) => {
                const lbl = labels[i];
                const colors = labelColors[lbl];
                return (
                  <div key={i} className="card">
                    <div className="card-top">
                      <span className="label" style={{ background: colors.bg, color: colors.text }}>{lbl}</span>
                      {item.price && <span className="price">{item.price}</span>}
                    </div>
                    <div className="title">{item.title}</div>
                    <div className="bestfor">{item.summary}</div>
                    <div className="pros-cons">
                      <span className="pro">✓ {item.pros[0]}</span>
                      <span className="pro">✓ {item.pros[1]}</span>
                      <span className="con"><em>✗ {item.con}</em></span>
                    </div>
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="link">
                      View Product →
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        <footer>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/disclosure">Disclosure</a>
        </footer>
      </div>

      <button className="promise-btn" onClick={() => setShowPromise(true)}>Our Promise</button>
      {showPromise && <PromiseModal onClose={() => setShowPromise(false)} />}

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f7f6f3;
          color: #111;
        }
        main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 20px 40px;
          gap: 20px;
        }
        .header {
          text-align: center;
          width: 100%;
          max-width: 620px;
        }
        h1 {
          font-size: 1.7rem;
          font-weight: 700;
          margin: 0 0 6px;
          letter-spacing: -0.3px;
        }
        .header p {
          font-size: 0.9rem;
          color: #888;
          margin: 0 0 20px;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        }
        .input-row {
          display: flex;
          align-items: center;
          background: #fff;
          border: 1.5px solid #e0ddd8;
          border-radius: 12px;
          padding: 4px 4px 4px 8px;
          gap: 8px;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .input-row:focus-within {
          border-color: #8b7cf8;
          box-shadow: 0 2px 16px rgba(139,124,248,0.18);
        }
        .moose-wrap {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .moose-icon {
          width: 36px;
          height: 36px;
          object-fit: contain;
          filter: drop-shadow(0 0 1.5px #8b7cf8) drop-shadow(0 0 1.5px #8b7cf8);
          transition: transform 0.2s;
        }
        @keyframes mooseWalk {
          0%   { transform: translateY(0px) rotate(-1deg); }
          25%  { transform: translateY(-3px) rotate(1deg); }
          50%  { transform: translateY(0px) rotate(-1deg); }
          75%  { transform: translateY(-2px) rotate(0.5deg); }
          100% { transform: translateY(0px) rotate(-1deg); }
        }
        .walking .moose-icon {
          animation: mooseWalk 0.6s ease-in-out infinite;
        }
        .input {
          flex: 1;
          min-width: 0;
          padding: 10px 8px;
          font-size: 0.95rem;
          border: none;
          background: transparent;
          outline: none;
          color: #111;
        }
        .btn {
          width: 100%;
          padding: 13px 20px;
          font-size: 0.9rem;
          font-weight: 600;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .btn:hover:not(:disabled) { background: #333; }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        @media (max-width: 480px) {
          main {
            padding: 40px 16px 40px;
          }
          .form {
            flex-direction: column;
          }
          .btn {
            width: 100%;
            padding: 14px;
          }
          h1 {
            font-size: 1.4rem;
          }
        }
        .error { font-size: 0.85rem; color: #c0392b; }

        .results {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 620px;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          border: 1px solid #e8e6e1;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transform: translateY(-1px);
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .label {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 4px 10px;
          border-radius: 6px;
        }
        .price {
          font-size: 1rem;
          font-weight: 700;
          color: #2d6a4f;
        }
        .title {
          font-size: 0.97rem;
          font-weight: 700;
          color: #111;
          line-height: 1.3;
        }
        .bestfor {
          font-size: 0.82rem;
          color: #888;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pros-cons {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .pro { font-size: 0.82rem; color: #444; }
        .con { font-size: 0.82rem; color: #666; }
        .link {
          display: inline-block;
          margin-top: 4px;
          padding: 7px 14px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #444;
          background: #f0ede8;
          border-radius: 8px;
          text-decoration: none;
          border: 1px solid #e0ddd8;
          transition: background 0.15s;
          width: fit-content;
        }
        .link:hover { background: #e5e1db; }

        footer {
          text-align: center;
          padding: 16px;
          display: flex;
          justify-content: center;
          gap: 20px;
        }
        footer a {
          color: #bbb;
          text-decoration: none;
          font-size: 0.78rem;
          transition: color 0.15s;
        }
        footer a:hover { color: #777; }
        .promise-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 9px 16px;
          font-size: 0.78rem;
          font-weight: 600;
          background: #fff;
          color: #555;
          border: 1px solid #ddd;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          transition: box-shadow 0.15s;
          z-index: 100;
        }
        .promise-btn:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
      `}</style>
    </>
  );
}
