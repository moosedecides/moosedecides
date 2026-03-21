import Head from 'next/head';
import Link from 'next/link';

export default function Privacy() {
  return (
    <>
      <Head><title>Privacy Policy — MooseDecides</title></Head>
      <div style={{ maxWidth: 680, margin: '80px auto', padding: '0 24px', fontFamily: 'sans-serif', color: '#1a1a1a' }}>
        <Link href="/" style={{ color: '#999', fontSize: '0.9rem', textDecoration: 'none' }}>← Back</Link>
        <h1 style={{ marginTop: 24, marginBottom: 16, fontSize: '1.8rem' }}>Privacy Policy</h1>
        <p style={{ color: '#555', lineHeight: 1.7 }}>MooseDecides does not collect personal data. We do not use cookies for tracking. Queries are sent to OpenAI for processing and are not stored by us. This site may use anonymous analytics to measure traffic.</p>
      </div>
    </>
  );
}
