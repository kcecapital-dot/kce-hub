export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const { model, input } = await req.json();
  const FAL_KEY = process.env.FAL_KEY;

  // Submit to fal queue
  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const submitted = await submitRes.json();
  if (!submitRes.ok) {
    return new Response(JSON.stringify(submitted), {
      status: submitRes.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const requestId = submitted.request_id;

  // Poll for result
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const statusRes = await fetch(`https://queue.fal.run/${model}/requests/${requestId}`, {
      headers: { 'Authorization': `Key ${FAL_KEY}` },
    });
    const statusData = await statusRes.json();
    if (statusData.status === 'COMPLETED' || statusData.images) {
      return new Response(JSON.stringify({ data: statusData }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    if (statusData.status === 'FAILED') {
      return new Response(JSON.stringify({ error: 'Generation failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Timeout' }), {
    status: 504,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
