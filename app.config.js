// The browser tab's title (and link previews) use the public product name,
// kept in src/constants/product.json.
const product = require('./src/constants/product.json');

module.exports = ({ config }) => ({
  ...config,
  web: { ...config.web, name: product.name, shortName: product.name },
});
