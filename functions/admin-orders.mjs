import { getStore } from '@netlify/blobs';

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
});

export default async (req) => {
  if (req.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const token = process.env.ADMIN_TOKEN;
  if (!token) return json(503, { error: 'Admin token not configured' });

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${token}`) {
    return json(401, { error: 'Unauthorized' });
  }

  try {
    const store = getStore('stevy-orders');
    const result = await store.list();
    const orders = [];

    for (const blob of result.blobs || []) {
      const order = await store.get(blob.key, { type: 'json' });
      if (order) orders.push(order);
    }

    orders.sort((a, b) =>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    return json(200, { orders });
  } catch (error) {
    return json(500, { error: 'Unable to load orders' });
  }
};
