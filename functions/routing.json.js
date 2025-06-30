// Cloudflare Pages Function to serve routing.json with CORS headers
// This file will be deployed as a serverless function at /routing.json

const routingConfig = [
  {
    "domain": "api.google.com",
    "authType": 1
  },
  {
    "domain": "api.hubapi.com",
    "authType": 2,
    "secretName": "6nr8n2i1ve1rdnku8d1t"
  },
  {
    "domain": "api.notion.com",
    "authType": 3,
    "secretName": "fhwowggbohorrud2kj16"
  }
];

const allowedOrigins = [
  'https://apps.simplesalt.company',
  'https://studio.plasmic.app',
  'https://host.plasmicdev.com',
  'http://localhost:3000',
  'http://localhost:54423',
  'http://localhost:55753'
];

export async function onRequest(context) {
  const { request } = context;
  
  // Get origin from request
  const origin = request.headers.get('Origin');
  const corsOrigin = allowedOrigins.includes(origin) ? origin : '*';
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };
  
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  
  // Handle GET request
  if (request.method === 'GET') {
    return new Response(JSON.stringify(routingConfig, null, 2), {
      status: 200,
      headers: corsHeaders
    });
  }
  
  // Method not allowed
  return new Response('Method not allowed', {
    status: 405,
    headers: corsHeaders
  });
}