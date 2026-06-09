const db = require('../db');

describe('db helper toPg', () => {
  const toPg = db.prepare('SELECT 1').__proto__ === Object.prototype
    ? require('../db').prepare('SELECT 1').constructor
    : null; // toPg is not exported directly, but we can test db.prepare or require it

  // Let's test db.prepare's internal translation by inspecting what sql it passes.
  // Wait, db.prepare is built on top of toPg. Let's look at db.js:
  // function prepare(sql) { const pgSql = toPg(sql); ... }
  // So we can mock query or just check how prepare translates queries.
  // Wait, toPg is not exported from db.js. We export: { prepare, exec, pool, initSchema }
  // Let's test it via db.prepare or we can inspect db.js.
  // Since db.prepare executes toPg internally, we can check how it maps queries if we mock the query method.
  
  it('convertit les "?" simples en "$1", "$2"', async () => {
    // We can spy on pool.query to see what query it actually runs
    const spy = jest.spyOn(db.pool, 'query').mockResolvedValueOnce({ rows: [] });
    
    await db.prepare('SELECT * FROM users WHERE id = ? AND email = ?').get(1, 'test@test.com');
    
    expect(spy).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE id = $1 AND email = $2',
      [1, 'test@test.com']
    );
    spy.mockRestore();
  });

  it('préserve les "?? (opérateur JSONB)" en les traduisant en "?" simples', async () => {
    const spy = jest.spyOn(db.pool, 'query').mockResolvedValueOnce({ rows: [] });
    
    // Here ?? should become ? and ? should become $1
    await db.prepare('SELECT * FROM users WHERE domains ?? ?').get('Biologie');
    
    expect(spy).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE domains ? $1',
      ['Biologie']
    );
    spy.mockRestore();
  });
});
