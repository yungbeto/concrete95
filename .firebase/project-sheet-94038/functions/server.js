const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrprojectsheet94038 = onRequest({"region":"us-west1"}, (req, res) => server.then(it => it.handle(req, res)));
  