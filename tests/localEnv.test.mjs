import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnvFileContent } from '../server/localEnv.mjs';

test('parseEnvFileContent reads simple dotenv lines', () => {
  assert.deepEqual(parseEnvFileContent([
    'VITE_SUPABASE_URL=https://example.supabase.co',
    'SUPABASE_SERVICE_ROLE_KEY=secret',
    '',
    '# ignored',
  ].join('\n')), {
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'secret',
  });
});

test('parseEnvFileContent removes surrounding quotes', () => {
  assert.deepEqual(parseEnvFileContent('ADMIN_JOIN_CODE="open sesame"'), {
    ADMIN_JOIN_CODE: 'open sesame',
  });
});
