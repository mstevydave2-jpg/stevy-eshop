import { getStore } from '@netlify/blobs';

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json',
    'access-control-allow-origin': '*'
  }
});

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS'
      }
    });
  }

  if (req.method !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const id = new URL(req.url).searchParams.get('id');

  if (!id) return json(400, { error: 'Order ID missing' });

  try {
    const store = getStore('stevy-orders');
    const order = await store.get(id, { type: 'json' });

    if (!order) return json(404, { error: 'Order not found' });

    return json(200, {
      orderId: id,
      status: order.status,
      paidAt: order.paidAt || null
    });
  } catch {
    return json(500, { error: 'Server error' });
  }
};
