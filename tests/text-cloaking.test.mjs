import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloakText } from '../js/text-cloaking.mjs';

test('text cloaking replaces e with 3 and preserves numbers and punctuation', () => {
  assert.equal(cloakText('E e 123!'), '3 3 123!');
  assert.equal(cloakText('Games'), 'Ğáṁ3š');
  assert.equal(cloakText('https://example.com'), 'ĥťťṕš://3ẋáṁṕľ3.çóṁ');
});
