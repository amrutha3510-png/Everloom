import http from 'http';

http.get('http://localhost:3000/admin/sales-report/pdf?reportType=monthly', (res) => {
  console.log('PDF HTTP Status:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  let size = 0;
  res.on('data', chunk => size += chunk.length);
  res.on('end', () => console.log('Downloaded PDF size:', size, 'bytes'));
}).on('error', err => console.error('Fetch error:', err));
