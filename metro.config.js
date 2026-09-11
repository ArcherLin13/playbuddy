const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...new Set([...config.resolver.sourceExts, 'cjs', 'mjs'])];
config.resolver.unstable_enablePackageExports = false;

const defaultResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force Firebase modular entry points to CJS files Metro can load.
  if (
    moduleName === 'firebase/app' ||
    moduleName === 'firebase/auth' ||
    moduleName === 'firebase/firestore'
  ) {
    try {
      return {
        filePath: require.resolve(`${moduleName}/dist/index.cjs.js`),
        type: 'sourceFile',
      };
    } catch {
      /* fall through */
    }
  }

  if (defaultResolve) {
    return defaultResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
