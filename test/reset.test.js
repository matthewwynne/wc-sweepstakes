import { test } from 'node:test';
import assert from 'node:assert/strict';

// lib/db.js builds its Neon client at import time from DATABASE_URL, so give it a
// dummy URL (no connection is made until a query runs) and import dynamically.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://u:p@localhost:5432/db';
const { resetStatements } = await import('../lib/db.js');

// A fake `sql` tag that just returns the literal SQL text so we can inspect the batch.
const fakeSql = (strings) => strings.join('');

test('reset clears the draw and all results', () => {
  const joined = resetStatements(fakeSql).join(' | ').toLowerCase();
  assert.ok(joined.includes('delete from pool_results'), 'should clear pool results');
  assert.ok(joined.includes('delete from ko_results'), 'should clear knockout results');
  assert.ok(joined.includes('update game'), 'should clear the game draw/lock');
  assert.ok(joined.includes('locked=false'), 'should unlock the game');
});

test('reset never touches the players table', () => {
  const stmts = resetStatements(fakeSql);
  assert.equal(stmts.length, 3, 'reset should be exactly three statements');
  const joined = stmts.join(' | ').toLowerCase();
  assert.ok(!joined.includes('players'),
    'reset must not modify the players table — names, confirmations and payments are kept');
});
