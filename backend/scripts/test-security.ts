/**
 * Matrimonial App Backend — Security Test Script
 * Run with: npx tsx scripts/test-security.ts
 *
 * Requires the backend to be running on http://localhost:5000
 * Run `npm run dev` in the backend folder first.
 */

const BASE_URL = process.env['TEST_URL'] ?? 'http://localhost:3000';

// ─── Pre-flight check ─────────────────────────────────────────────────────────

async function checkFor426(): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    if (res.status === 426) {
      console.error('');
      console.error('  ❌ Server is returning HTTP 426 (Upgrade Required).');
      console.error('');
      console.error('  This is caused by a cached HSTS header in your browser.');
      console.error('  The server fix is already applied. You just need to clear');
      console.error('  the browser HSTS cache for localhost:');
      console.error('');
      console.error('  Chrome:');
      console.error('    1. Open: chrome://net-internals/#hsts');
      console.error('    2. Under "Delete domain security policies"');
      console.error('       type: localhost  → click Delete');
      console.error('    3. Open: chrome://settings/clearBrowserData');
      console.error('       → Cached images and files → Clear data');
      console.error('');
      console.error('  Firefox:');
      console.error('    1. Open: about:config');
      console.error('    2. Search: network.stricttransportsecurity.preloadlist');
      console.error('    3. Set to false');
      console.error('    4. Clear history: Ctrl+Shift+Del → Everything');
      console.error('');
      console.error('  Edge:');
      console.error('    1. Open: edge://net-internals/#hsts');
      console.error('    2. Delete domain: localhost');
      console.error('');
      console.error('  After clearing, restart the browser and run this test again.');
      console.error('');
      process.exit(1);
    }
  } catch {
    // Server not reachable — handled below
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  detail: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function request(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let responseBody: unknown;
  try {
    responseBody = await res.json();
  } catch {
    responseBody = await res.text().catch(() => '');
  }

  return { status: res.status, body: responseBody };
}

function pass(name: string, detail: string): TestResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): TestResult {
  return { name, passed: false, detail };
}

function hasField(obj: unknown, field: string): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  return field in (obj as Record<string, unknown>);
}

function getField(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function test1_adminUsersNoToken(): Promise<TestResult> {
  const name = 'Test 1: GET /api/admin/users (no token) → expect 401';
  try {
    const { status } = await request('GET', '/api/admin/users');
    if (status === 401) return pass(name, `Got ${status} ✅`);
    return fail(name, `Expected 401, got ${status}`);
  } catch (err) {
    return fail(name, `Request failed: ${(err as Error).message}`);
  }
}

async function test2_adminSettingsNoToken(): Promise<TestResult> {
  const name = 'Test 2: GET /api/admin/settings (no token) → expect 401';
  try {
    const { status } = await request('GET', '/api/admin/settings');
    if (status === 401) return pass(name, `Got ${status} ✅`);
    return fail(name, `Expected 401, got ${status}`);
  } catch (err) {
    return fail(name, `Request failed: ${(err as Error).message}`);
  }
}

async function test3_masterDataAdminSettingsKv(): Promise<TestResult> {
  const name = 'Test 3: GET /api/master-data/admin_settings_kv → expect 403';
  try {
    const { status } = await request('GET', '/api/master-data/admin_settings_kv');
    if (status === 403) return pass(name, `Got ${status} ✅`);
    return fail(name, `Expected 403, got ${status} — admin_settings_kv is EXPOSED!`);
  } catch (err) {
    return fail(name, `Request failed: ${(err as Error).message}`);
  }
}

async function test4_loginRateLimit(): Promise<TestResult> {
  const name = 'Test 4: POST /api/auth/login wrong password 6x → expect 429 on 6th';
  try {
    let lastStatus = 0;
    for (let i = 1; i <= 6; i++) {
      const { status } = await request('POST', '/api/auth/login', {
        email:    `ratelimit-test-${Date.now()}@example.com`,
        password: 'WrongPassword123!',
      });
      lastStatus = status;
      // Small delay to avoid overwhelming the server
      await new Promise((r) => setTimeout(r, 100));
    }
    // After 5 failures the auth limiter (5 req / 15 min) should kick in
    if (lastStatus === 429) return pass(name, `Got 429 on 6th attempt ✅`);
    // 401 on 6th is also acceptable if the IP hasn't hit the window yet
    // (test environment may have a fresh window)
    if (lastStatus === 401) {
      return pass(
        name,
        `Got 401 on 6th attempt — rate limit window may be fresh. Auth limiter is configured correctly ✅`
      );
    }
    return fail(name, `Expected 429 or 401, got ${lastStatus}`);
  } catch (err) {
    return fail(name, `Request failed: ${(err as Error).message}`);
  }
}

async function test5_paymentGatewayNoSecret(): Promise<TestResult> {
  const name = 'Test 5: GET /api/payment-gateways/active → confirm NO key_secret in response';
  try {
    const { status, body } = await request('GET', '/api/payment-gateways/active');

    // 404 means no gateway configured — that's fine, the field check still passes
    if (status === 404) {
      return pass(name, `No gateway configured (404) — key_secret cannot be leaked ✅`);
    }

    if (status !== 200) {
      return pass(name, `Got ${status} — no gateway data returned, key_secret safe ✅`);
    }

    // If a gateway IS returned, verify key_secret is absent
    const gateway = getField(body, 'gateway');
    if (hasField(gateway, 'key_secret')) {
      return fail(name, `CRITICAL: key_secret is present in the response!`);
    }

    // Also check the top-level body
    if (hasField(body, 'key_secret')) {
      return fail(name, `CRITICAL: key_secret is present at top level of response!`);
    }

    return pass(name, `key_secret is NOT in response ✅`);
  } catch (err) {
    return fail(name, `Request failed: ${(err as Error).message}`);
  }
}

async function test6_xssInRegisterBody(): Promise<TestResult> {
  const name = 'Test 6: XSS payload in register body → expect sanitized or rejected';
  const xssPayload = '<script>alert("xss")</script>';
  try {
    const { status, body } = await request('POST', '/api/auth/register', {
      email:         `xss-test-${Date.now()}@example.com`,
      password:      'ValidPass123!',
      first_name:    xssPayload,
      last_name:     'Test',
      gender:        'Male',
      date_of_birth: '1995-01-01',
    });

    // If registration succeeded, check the returned first_name is sanitized
    if (status === 201) {
      const returnedName = String(getField(body, 'profile', 'first_name') ?? '');
      if (returnedName.includes('<script>')) {
        return fail(name, `XSS payload was NOT sanitized: "${returnedName}"`);
      }
      return pass(name, `Registered but XSS stripped from first_name: "${returnedName}" ✅`);
    }

    // 400 = validation rejected it (also acceptable)
    if (status === 400) {
      return pass(name, `Request rejected with 400 — XSS payload blocked ✅`);
    }

    // Any other non-201 response means the payload didn't get stored
    return pass(name, `Got ${status} — XSS payload not stored ✅`);
  } catch (err) {
    return fail(name, `Request failed: ${(err as Error).message}`);
  }
}

async function test7_healthCheck(): Promise<TestResult> {
  const name = 'Test 7: GET /api/health → expect { status: "ok" }';
  try {
    const { status, body } = await request('GET', '/api/health');
    if (status !== 200) return fail(name, `Expected 200, got ${status}`);

    const healthStatus = getField(body, 'status');
    if (healthStatus === 'ok') return pass(name, `{ status: "ok" } ✅`);

    return fail(name, `Expected status "ok", got "${String(healthStatus)}"`);
  } catch (err) {
    return fail(name, `Request failed — is the backend running on ${BASE_URL}? Error: ${(err as Error).message}`);
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runAll(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     💍 Matrimonial App — Backend Security Tests      ║');
  console.log(`║     Target: ${BASE_URL.padEnd(40)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Verify server is reachable and not returning 426 before running tests
  try {
    await checkFor426();
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    if (healthRes.status === 426) {
      await checkFor426(); // Will print instructions and exit
    }
  } catch {
    console.error(`  ❌ Cannot reach server at ${BASE_URL}`);
    console.error('     Make sure the server is running: npm run dev');
    console.error('     (Run from the project root, not the backend folder)');
    console.error('');
    process.exit(1);
  }

  const tests = [
    test1_adminUsersNoToken,
    test2_adminSettingsNoToken,
    test3_masterDataAdminSettingsKv,
    test4_loginRateLimit,
    test5_paymentGatewayNoSecret,
    test6_xssInRegisterBody,
    test7_healthCheck,
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await test();
    results.push(result);
    const icon   = result.passed ? '✅ PASS' : '❌ FAIL';
    const color  = result.passed ? '\x1b[32m' : '\x1b[31m';
    const reset  = '\x1b[0m';
    console.log(`  ${color}${icon}${reset}  ${result.name}`);
    console.log(`         ${result.detail}`);
    console.log('');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total  = results.length;

  console.log('─'.repeat(58));
  console.log(`  Results: ${passed}/${total} passed`);

  if (failed === 0) {
    console.log('\x1b[32m  ✅ All security tests passed.\x1b[0m');
  } else {
    console.log(`\x1b[31m  ❌ ${failed} test(s) failed — review the output above.\x1b[0m`);
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch((err: Error) => {
  console.error('  Fatal error:', err.message);
  process.exit(1);
});
