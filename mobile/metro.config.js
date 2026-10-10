const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Use the browser build of jose so Privy works in React Native without
// Node.js crypto globals.
const joseBrowserPath = path.resolve(
  __dirname,
  'node_modules/jose/dist/browser/index.js'
);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jose') {
    return { filePath: joseBrowserPath, type: 'sourceFile' };
  }
  // @noble/hashes@1.8.0 exports `./crypto` but some resolvers probe `./crypto.js`,
  // which is missing from the package exports map. Redirect to the canonical export.
  if (moduleName === '@noble/hashes/crypto.js') {
    return context.resolveRequest(context, '@noble/hashes/crypto', platform);
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
