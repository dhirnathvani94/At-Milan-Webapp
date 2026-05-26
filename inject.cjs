const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database.json');

try {
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  if (!dbData.payment_gateways) {
    dbData.payment_gateways = [];
  }
  if (!dbData.coupons) {
    dbData.coupons = [];
  }

  // Add demo payment gateway
  dbData.payment_gateways = dbData.payment_gateways.filter((g) => g.name !== 'Razorpay Test');
  dbData.payment_gateways.forEach(g => g.is_active = false);
  dbData.payment_gateways.push({
    id: 'gateway-demo-1',
    name: 'Razorpay Test',
    provider: 'razorpay',
    key_id: 'rzp_test_demoKey123',
    key_secret: 'demoSecret456',
    is_active: true,
    created_at: new Date().toISOString()
  });

  // Add demo coupon with ALL possible keys (camelCase AND snake_case) to avoid any mismatches
  dbData.coupons = dbData.coupons.filter(c => c.code !== 'DEMO');
  dbData.coupons.push({
    id: 'coupon-demo-1',
    code: 'DEMO',
    type: 'percentage',
    value: 50,
    discount_type: 'percentage',
    discount_value: 50,
    isActive: true,
    is_active: true,
    validFrom: new Date().toISOString(),
    valid_from: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    valid_to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    maxUses: 100,
    usage_limit: 100,
    usedCount: 0,
    used_count: 0,
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString()
  });

  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');
  console.log('Successfully injected test payment gateway and DEMO coupon.');
} catch (e) {
  console.error('Error injecting data:', e);
}
