const authMiddleware = require('./authMiddleware');

module.exports = authMiddleware;
module.exports.protect = authMiddleware.protect;
module.exports.authorize = authMiddleware.authorize;
