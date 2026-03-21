export default function ResultCard({ label, data }) {
  const labelColors = {
    'Top Pick': { bg: '#1a1a1a', text: '#fff' },
    'Best Value': { bg: '#2d6a4f', text: '#fff' },
    'Budget': { bg: '#5c5470', text: '#fff' },
  };
  const colors = labelColors[label] || { bg: '#444', text: '#fff' };

  return (
    <div className="card">
      <div className="label-badge" style={{ background: colors.bg, color: colors.text }}>
        {label}
      </div>

      <div className="card-body">
        <div className="card-header">
          <h2 className="product-title">{data.title}</h2>
          <span className="price">{data.price}</span>
        </div>

        <p className="summary">{data.summary}</p>

        <div className="details">
          <div className="pros">
            {data.pros.map((pro, i) => (
              <div key={i} className="pro">✓ {pro}</div>
            ))}
          </div>
          <div className="con">✗ {data.con}</div>
        </div>

        <a href={data.link} target="_blank" rel="noopener noreferrer" className="buy-btn">
          View Product →
        </a>
      </div>

      <style jsx>{`
        .card {
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 2px 16px rgba(0,0,0,0.07);
          overflow: hidden;
          transition: box-shadow 0.2s, transform 0.2s;
          border: 1.5px solid #eeece8;
        }
        .card:hover {
          box-shadow: 0 6px 28px rgba(0,0,0,0.11);
          transform: translateY(-2px);
        }
        .label-badge {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          padding: 6px 14px;
          margin: 16px 16px 0;
          border-radius: 6px;
        }
        .card-body {
          padding: 12px 20px 20px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
          gap: 12px;
        }
        .product-title {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0;
          color: #111;
          line-height: 1.3;
        }
        .price {
          font-size: 1.05rem;
          font-weight: 700;
          color: #2d6a4f;
          white-space: nowrap;
        }
        .summary {
          font-size: 0.9rem;
          color: #555;
          margin: 0 0 14px;
          line-height: 1.5;
        }
        .details {
          margin-bottom: 16px;
        }
        .pro {
          font-size: 0.88rem;
          color: #2d6a4f;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .con {
          font-size: 0.88rem;
          color: #c0392b;
          margin-top: 6px;
          font-weight: 500;
        }
        .buy-btn {
          display: inline-block;
          padding: 10px 20px;
          background: #f5f4f2;
          color: #1a1a1a;
          text-decoration: none;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 600;
          transition: background 0.2s;
          border: 1.5px solid #e0ddd8;
        }
        .buy-btn:hover {
          background: #eae8e4;
        }
      `}</style>
    </div>
  );
}
