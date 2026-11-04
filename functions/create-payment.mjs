
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

const catalog = {
  'Free Fire': {'110 diamants':1062,'230 diamants':1775,'583 diamants':3930,'1 188 diamants':7430,'2 420 diamants':14600},
  'eFootball': {'130 pièces':1590,'300 pièces':3080,'500 pièces':5000,'1 000 pièces':6794,'2 000 pièces':12042,'3 000 pièces':17289,'5 000 pièces':27785,'10 000 pièces':52777,'15 000 pièces':75728},
  'Roblox': {'40 Robux':756,'80 Robux':1162,'500 Robux':4110,'1 000 Robux':9530,'2 000 Robux':18710,'5 200 Robux':46250},
  'Call of Duty': {'80 CP':884,'420 CP':4800,'880 CP':7600,'2 400 CP':15100,'5 000 CP':30100,'10 800 CP':59100}
};

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {'content-type':'application/json','access-control-allow-origin':'*'}
});

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response('', {
    status: 204,
    headers: {'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST, OPTIONS'}
  });

  if (req.method !== 'POST') return json(405, {error:'Méthode non autorisée.'});

  const apiKey = process.env.PAYCENTRAL_API_KEY;
  if (!apiKey) return json(503, {error:'Configuration manquante : ajoute PAYCENTRAL_API_KEY dans Netlify.'});

  try {
    const b = await req.json();
    const amount = catalog?.[b.game]?.[b.pack];

    if (!amount || !['airtel'].includes(b.paymentMethod)) {
      return json(400, {error:'Jeu, pack ou mode de paiement invalide.'});
    }

    if (!b.customerName || !String(b.customerName).trim() || !b.player || !b.email || !/^\+2410[0-9]{7}$/.test(b.phone || '')) {
      return json(400, {error:'Vérifie le nom complet, l’ID joueur, l’e-mail et le numéro gabonais Airtel au format +24107XXXXXXX.'});
    }

    const orderId = 'STE-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

    const payload = {
      amount,
      currency:'XAF',
      phone:b.phone,
      provider:'airtel',
      description:`stevy_eshop ${b.game} - ${b.pack}`,
      merchant_reference:orderId,
      metadata:{
        order_id:orderId,
        game:b.game,
        pack:b.pack,
        player:String(b.player).slice(0,80)
      }
    };

    const pc = await fetch('https://api-paycentral.gabondunumerique.com/api/v1/payment/initiate', {
      method:'POST',
      headers:{'X-Api-Key':apiKey,'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });

    const result = await pc.json().catch(() => ({}));

    if (!pc.ok) return json(pc.status, {error:result.message || result.error || 'PayCentral a refusé la demande.'});

    const order = {
      orderId,
      customerName:String(b.customerName).trim().slice(0,100),
      game:b.game,
      pack:b.pack,
      player:String(b.player).slice(0,80),
      email:String(b.email).slice(0,150),
      phone:b.phone,
      amount,
      status:'processing',
      transactionId:result.transaction_id || '',
      createdAt:new Date().toISOString(),
      provider:'airtel'
    };

    await getStore('stevy-orders').set(orderId, JSON.stringify(order));

    return json(201, {
      orderId,
      status:order.status,
      message:result.message || 'Demande envoyée. Confirme uniquement dans le parcours officiel Airtel Money. La commande attend la confirmation PayCentral.'
    });

  } catch (e) {
    return json(500, {error:'Erreur serveur lors de la création de la commande.'});
  }
};
