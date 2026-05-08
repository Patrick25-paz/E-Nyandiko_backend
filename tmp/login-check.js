(async () => {
  const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'nobody@example.com',
      password: 'wrong'
    })
  });

  const text = await response.text();
  console.log(`STATUS ${response.status}`);
  console.log(text);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
