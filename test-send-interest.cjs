const fs = require('fs');
const jwt = require('jsonwebtoken');
const fetch = globalThis.fetch;

const JWT_SECRET = '93adb4679e4b865a3160d6e4a23577f9b2b6d6c6ace065d382fdba8604329d5ec127efaa22ae2c67388d9edf1f0fa2493e039508f49f3f8029ca7ea0c4faab5f';
const userAId = '19850284-c4e5-48c2-84c0-60c0186cad7f'; 
const userBId = 'bef75183-2c7b-436a-8023-bd04a3e704fc'; 

const tokenA = jwt.sign({ id: userAId }, JWT_SECRET);

console.log('Waiting 10 seconds before sending interest...');
setTimeout(async () => {
  console.log('Sending interest...');
  const res = await fetch('http://localhost:3000/api/interests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ sender_id: userAId, receiver_id: userBId })
  });
  console.log('API Response:', await res.json());
}, 10000);
