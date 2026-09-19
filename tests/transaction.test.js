const db = require('../db');
afterEach(() => jest.restoreAllMocks());
test('commits all writes on the same connection, then releases', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }), release: jest.fn() };
  jest.spyOn(db.pool, 'connect').mockResolvedValue(client);
  const sharedPool = jest.spyOn(db.pool, 'query');
  await db.transaction(async tx => { await tx.prepare('UPDATE users SET jetons = ? WHERE id = ?').run(80, 1); });
  expect(client.query.mock.calls.map(c => c[0])).toEqual(['BEGIN', 'UPDATE users SET jetons = $1 WHERE id = $2', 'COMMIT']);
  expect(sharedPool).not.toHaveBeenCalled();
  expect(client.release).toHaveBeenCalledTimes(1);
});
test('rolls back failure without retrying an ambiguous write', async () => {
  const failure = new Error('ECONNRESET');
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
  client.query.mockImplementation(async sql => { if (sql.startsWith('UPDATE')) throw failure; return { rows: [] }; });
  jest.spyOn(db.pool, 'connect').mockResolvedValue(client);
  await expect(db.transaction(tx => tx.prepare('UPDATE users SET jetons = ?').run(10))).rejects.toBe(failure);
  expect(client.query.mock.calls.map(c => c[0])).toEqual(['BEGIN', 'UPDATE users SET jetons = $1', 'ROLLBACK']);
  expect(client.release).toHaveBeenCalledTimes(1);
});
