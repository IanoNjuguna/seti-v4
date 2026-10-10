module.exports = function (api) {
  api.cache(true);
  return {
    // `nativewind/babel` returns a config object with `plugins`, so it must be
    // treated as a preset, not a plugin.
    presets: ['babel-preset-expo', 'nativewind/babel'],
  };
};
