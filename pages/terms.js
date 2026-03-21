import Head from 'next/head';
import Link from 'next/link';

export default function Terms() {
  return (
    <>
      <Head><title>Terms — MooseDecides</title></Head>
      <div style={{ maxWidth: 680, margin: '80px auto', padding: '0 24px', fontFamily: 'sans-serif', color: '#1a1a1a' }}>
        <Link href="/" style={{ color: '#999', fontSize: '0.9rem', textDecoration: 'none' }}>← Back</Link>
        <h1 style={{ marginTop: 24, marginBottom: 16, fontSize: '1.8rem' }}>Terms of Use</h1>
        <p style={{ color: '#555', lineHeight: 1.7 }}>MooseDecides provides product recommendations for informational purposes only. We are not responsible for the accuracy of pricing or product availability. Use this service at your own discretion. Recommendations are AI-generated and may not reflect real-time availability or pricing.</p>
      </div>
    </>
  );
}
