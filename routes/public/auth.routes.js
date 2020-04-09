const { AuthController } = require('../../controllers');

module.exports = (app) => {
  app.post('/register', AuthController.createMagicRequest);

  app.post('/login', AuthController.verifyMagicRequest);

  app.get('/confirm', AuthController.confirmMagicRequest);
};
