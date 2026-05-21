const IS_PROD = process.env.NODE_ENV === 'production';

const COLORS = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m' };

function log(level, message, context = {}) {
  if (IS_PROD) {
    // JSON lines — captured by Railway log aggregation
    process.stdout.write(JSON.stringify({
      ts:    new Date().toISOString(),
      level,
      msg:   message,
      ...context,
    }) + '\n');
  } else {
    const c   = COLORS[level] || '';
    const ctx = Object.keys(context).length ? ' ' + JSON.stringify(context) : '';
    const out = `${c}[${level.toUpperCase()}]${COLORS.reset} ${message}${ctx}`;
    level === 'error' ? console.error(out) : console.log(out);
  }
}

const logger = {
  info:  (msg, ctx = {}) => log('info',  msg, ctx),
  warn:  (msg, ctx = {}) => log('warn',  msg, ctx),
  error: (msg, ctx = {}) => log('error', msg, ctx),
};

module.exports = logger;
