const fs = require('fs');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');
const fetch = globalThis.fetch;

const JWT_SECRET = '93adb4679e4b865a3160d6e4a23577f9b2b6d6c6ace065d382fdba8604329d5ec127efaa22ae2c67388d9edf1f0fa2493e039508f49f3f8029ca7ea0c4faab5f';
const userAId = '19850284-c4e5-48c2-84c0-60c0186cad7f'; // demo12
const userBId = 'bef75183-2c7b-436a-8023-bd04a3e704fc'; // demo13

const tokenA = jwt.sign({ id: userAId }, JWT_SECRET);
const tokenB = jwt.sign({ id: userBId }, JWT_SECRET);

const socketB = io('http://localhost:3000', { auth: { token: tokenB } });

socketB.on('connect', () => {
  console.log('User B connected:', socketB.id);
});

socketB.on('interest:new', (data) => {
  console.log('USER B RECEIVED interest:new!', data);
  process.exit(0);
});

socketB.on('notification:new', (data) => {
  console.log('USER B RECEIVED notification:new!', data);
});

setTimeout(async () => {
  console.log('User A sending interest...');
  const res = await fetch('http://localhost:3000/api/interests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    body: JSON.stringify({ sender_id: userAId, receiver_id: userBId })
  });
  console.log('API Response:', await res.json());
}, 2000);

setTimeout(() => {
  console.log('Timeout waiting for event');
  process.exit(1);
}, 5000);
