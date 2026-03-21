export default function PromiseModal({ onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>Our Promise</h2>
        <p>Our promise is to always give you the best recommendation.</p>
        <p>Some links may earn us a commission.</p>
        <p>We will never choose a commission over giving you the best product. Ever.</p>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal {
          background: #fff;
          border-radius: 20px;
          padding: 40px;
          max-width: 460px;
          width: 100%;
          position: relative;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 20px;
          color: #111;
        }
        p {
          font-size: 1rem;
          color: #444;
          line-height: 1.6;
          margin: 0 0 14px;
        }
        p:last-child {
          margin-bottom: 0;
        }
        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 1rem;
          cursor: pointer;
          color: #999;
          padding: 4px 8px;
          border-radius: 6px;
          transition: color 0.2s;
        }
        .close-btn:hover {
          color: #333;
        }
      `}</style>
    </div>
  );
}
