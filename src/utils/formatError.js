const formatError = (err) => {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    if (err.name === 'AggregateError' && Array.isArray(err.errors)) {
      const reasons = err.errors.map(formatError).filter(Boolean);
      return reasons.length ? `${err.name}: ${reasons.join('; ')}` : err.message || err.toString();
    }
    if (err.message) return `${err.name || 'Error'}: ${err.message}`;
    return err.toString();
  }
  if (Array.isArray(err)) return err.map(formatError).join('; ');
  if (typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
};

module.exports = formatError;
