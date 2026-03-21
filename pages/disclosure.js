import Head from 'next/head';
import Link from 'next/link';

export default function Disclosure() {
  return (
    <>
      <Head><title>Disclosure — MooseDecides</title></Head>
      <div style={{ maxWidth: 680, margin: '80px auto', padding: '0 24px', fontFamily: 'sans-serif', color: '#1a1a1a' }}>
        <Link href="/" style={{ color: '#999', fontSize: '0.9rem', textDecoration: 'none' }}>← Back</Link>
        <h1 style={{ marginTop: 24, marginBottom: 16, fontSize: '1.8rem' }}>Disclosure</h1>
        <p style={{ color: '#555', lineHeight: 1.7 }}>Some links on MooseDecides may be affiliate links, meaning we may earn a small commission if you purchase through them — at no extra cost to you. We will never allow affiliate relationships to influence our recommendations. Our promise is to always give you the best product for your needs. If a non-affiliate product is better, we will still recommend it.</p>
      </div>
    </>
  );
}
