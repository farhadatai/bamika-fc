import React from 'react';

export default function AdminDashboard() {
  return (
    <div style={{ padding: '2rem', color: 'white', backgroundColor: 'black', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Admin Dashboard Build Test</h1>
      <p>This is a minimal component to verify the Vercel build process.</p>
      <p>If this page deploys successfully, it proves the build environment is working and the error is a subtle syntax issue in the complex dashboard code.</p>
      <p>If this page fails to build, it proves the issue is with the Vercel project configuration, caching, or dependencies.</p>
    </div>
  );
}
