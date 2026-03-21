import { useState } from 'react';
import Head from 'next/head';
import ResultCard from '../components/ResultCard';
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
    } catch (err) {
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
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="container">
        <main>
          <div className="hero">
            <h1 className="headline">What do you need help choosing?</h1>
            <p className="subtext">Fast, honest recommendations. No noise.</p>

            <form onSubmit={handleSubmit} className="search-form">
              <input
                type="text"
                className="search-input"
                placeholder="e.g. best office chair with no lumbar support"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit" className="search-btn" disabled={loading}>
                {loading ? 'Thinking...' : 'Ask Moose'}
              </button>
            </form>
          </div>

          {error && <p className="error">{error}</p>}

          {results && (
            <div className="results">
              {results.map((item, i) => (
                <ResultCard key={i} label={labels[i]} data={item} />
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

      <button className="promise-btn" onClick={() => setShowPromise(true)}>
        Our Promise
      </button>

      {showPromise && <PromiseModal onClose={() => setShowPromise(false)} />}

      <style jsx>{`
        .container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #f5f4f2;
          color: #1a1a1a;
        }
        main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 80px 20px 60px;
        }
        .hero {
          text-align: center;
          max-width: 680px;
          width: 100%;
          margin-bottom: 48px;
        }
        .headline {
          font-size: 2.2rem;
          font-weight: 700;
          margin: 0 0 12px;
          letter-spacing: -0.5px;
          color: #111;
        }
        .subtext {
          font-size: 1.05rem;
          color: #666;
          margin: 0 0 36px;
        }
        .search-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        .search-input {
          width: 100%;
          padding: 18px 22px;
          font-size: 1rem;
          border: 1.5px solid #e0ddd8;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
          color: #1a1a1a;
        }
        .search-input:focus {
          border-color: #8b7cf8;
          box-shadow: 0 2px 16px rgba(139,124,248,0.15);
        }
        .search-btn {
          padding: 16px 28px;
          font-size: 1rem;
          font-weight: 600;
          background: #1a1a1a;
          color: #fff;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          letter-spacing: 0.2px;
        }
        .search-btn:hover:not(:disabled) {
          background: #333;
          transform: translateY(-1px);
        }
        .search-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .results {
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .error {
          color: #e53935;
          font-size: 0.95rem;
          margin-bottom: 20px;
        }
        footer {
          text-align: center;
          padding: 24px;
          display: flex;
          justify-content: center;
          gap: 28px;
        }
        footer a {
          color: #999;
          text-decoration: none;
          font-size: 0.85rem;
          transition: color 0.2s;
        }
        footer a:hover {
          color: #555;
        }
        .promise-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          padding: 12px 20px;
          font-size: 0.85rem;
          font-weight: 600;
          background: #fff;
          color: #1a1a1a;
          border: 1.5px solid #e0ddd8;
          border-radius: 50px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          transition: box-shadow 0.2s, transform 0.1s;
          z-index: 100;
        }
        .promise-btn:hover {
          box-shadow: 0 6px 20px rgba(0,0,0,0.14);
          transform: translateY(-1px);
        }
      `}</style>
    </>
  );
}
