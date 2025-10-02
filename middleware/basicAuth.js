const basicAuth = (req, res, next) => {
  // Skip authentication if BASIC_AUTH_ENABLED is not set to true
  if (process.env.BASIC_AUTH_ENABLED !== 'true') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorized(res);
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  const expectedUsername = process.env.BASIC_AUTH_USER;
  const expectedPassword = process.env.BASIC_AUTH_PASS;

  if (username === expectedUsername && password === expectedPassword) {
    return next();
  }

  return unauthorized(res);
};

const unauthorized = (res) => {
  res.set('WWW-Authenticate', 'Basic realm="Secure Area"');
  res.status(401).send('Authentication required');
};

module.exports = basicAuth;