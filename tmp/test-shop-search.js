const fetch = global.fetch || require('node-fetch');
const base = 'http://127.0.0.1:5000';
(async () => {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@enyandiko.com', password: 'ChangeMe@2026' })
  });
  const loginJson = await login.json();
  console.log('login status', login.status, loginJson);
  if (!login.ok) return;
  const token = loginJson.data?.token || loginJson.token || loginJson.accessToken;
  if (!token) {
    console.error('No token returned');
    return;
  }
  const res = await fetch(`${base}/api/sellers/shops/search?q=Seller`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('search status', res.status, data);
})();