import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

export default async (req) => {
  if(req.method!=='POST') return json(405,{error:'Method not allowed'});
  const secret=process.env.PAYCENTRAL_WEBHOOK_SECRET;
  if(!secret) return json(503,{error:'Webhook secret not configured'});
  const raw=await req.text();
  const received=(req.headers.get('x-paycentral-signature')||'').replace(/^sha256=/,'');
  const expected=crypto.createHmac('sha256',secret).update(raw).digest('hex');
  const a=Buffer.from(received,'hex'), b=Buffer.from(expected,'hex');
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return json(401,{error:'Invalid signature'});
  try {
    const event=JSON.parse(raw), data=event.data||{};
    const id=data.merchant_reference || data.metadata?.order_id;
    if(!id) return json(400,{error:'Missing merchant reference'});
    const store=getStore('stevy-orders'), saved=await store.get(id,{type:'json'});
    if(!saved) return json(404,{error:'Order not found'});
    if(Number(data.amount)!==Number(saved.amount)) return json(400,{error:'Amount mismatch'});
    const allowed=['success','failed','cancelled','refunded','processing','pending'];
    if(!allowed.includes(data.status)) return json(400,{error:'Unknown payment status'});
    saved.status=data.status;
    saved.transactionId=data.transaction_id||saved.transactionId;
    saved.updatedAt=new Date().toISOString();
    if(data.status==='success') saved.paidAt=data.paid_at||saved.updatedAt;
    await store.set(id,JSON.stringify(saved));
    return json(200,{received:true});
  } catch {
    return json(400,{error:'Invalid payload'});
  }
};
