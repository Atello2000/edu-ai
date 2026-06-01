require('dotenv').config();
const db = require('../db');

async function test() {
  console.log('Testing DB connection in project workspace...');
  try {
    const res = await db.pool.query('SELECT NOW()');
    console.log('DB Connection OK:', res.rows[0]);

    // Test a prepare get
    const userCount = await db.prepare('SELECT COUNT(*) FROM users').get();
    console.log('User count:', userCount);

    // Let's run a test for resend-verify
    const testEmail = 'abdallahsakho2@gmail.com';
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(testEmail);
    console.log('Test User for verify:', user);

    console.log('All DB tests finished successfully!');
  } catch (err) {
    console.error('DB Test Failed:', err);
  } finally {
    await db.pool.end();
  }
}

test();
