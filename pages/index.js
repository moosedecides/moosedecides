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

  const labels = ['Top Pick', 'Best Value', 'Budget'];

  return (
    <>
      <Head>
        <title>MooseDecides — Fast, honest recommendations</title>
        <meta name="description" content="Fast, honest product recommendations. No noise." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="wrap">
        <main>
          {/* Header */}
          <div className="header">
            <h1>What do you need help choosing?</h1>
            <p>Fast, honest recommendations. No noise.</p>
          </div>

          {/* Search */}
          <form onSubmit={handleSubmit} className="form">
            <input
              type="text"
              className="input"
              placeholder="e.g. best office chair with no lumbar support"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Moose is thinking…' : 'Ask Moose'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          {/* Results */}
          {results && (
            <div className="results">
              {results.map((item, i) => (
                <div key={i} className="card">
                  <div className="card-top">
                    <span className="label">{labels[i]}</span>
                    <span className="price">{item.price}</span>
                  </div>
                  <div className="title">{item.title}</div>
                  <div className="bestfor">{item.summary}</div>
                  <div className="pros-cons">
                    <span className="pro">✓ {item.pros[0]}</span>
                    <span className="pro">✓ {item.pros[1]}</span>
                    <span className="con"><em>✗ {item.con}</em></span>
                  </div>
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="link">
                    View →
                  </a>
                </div>
              ))}
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
          height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f7f6f3;
          color: #111;
          overflow: hidden;
        }
        main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 20px;
          gap: 14px;
        }
        .header {
          text-align: center;
        }
        h1 {
          font-size: 1.6rem;
          font-weight: 700;
          margin: 0 0 4px;
          letter-spacing: -0.3px;
        }
        .header p {
          font-size: 0.9rem;
          color: #888;
          margin: 0;
        }
        .form {
          display: flex;
          gap: 8px;
          width: 100%;
          max-width: 620px;
        }
        .input {
          flex: 1;
          padding: 12px 16px;
          font-size: 0.95rem;
          border: 1px solid #ddd;
          border-radius: 10px;
          background: #fff;
          outline: none;
          transition: border-color 0.15s;
          color: #111;
        }
        .input:focus { border-color: #aaa; }
        .btn {
          padding: 12px 20px;
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
        .error {
          font-size: 0.85rem;
          color: #c0392b;
        }
        .results {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          width: 100%;
          max-width: 900px;
        }
        .card {
          background: #fff;
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          border: 1px solid #e8e6e1;
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #888;
        }
        .price {
          font-size: 0.95rem;
          font-weight: 700;
          color: #111;
        }
        .title {
          font-size: 0.95rem;
          font-weight: 700;
          line-height: 1.3;
          color: #111;
        }
        .bestfor {
          font-size: 0.8rem;
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
        .pro {
          font-size: 0.8rem;
          color: #444;
        }
        .con {
          font-size: 0.8rem;
          color: #666;
        }
        .link {
          margin-top: 4px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #111;
          text-decoration: none;
          opacity: 0.6;
          transition: opacity 0.15s;
        }
        .link:hover { opacity: 1; }
        footer {
          text-align: center;
          padding: 12px;
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
