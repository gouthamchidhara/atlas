module.exports = function (api) {
  api.cache(true)
  return {
    // babel-preset-expo (SDK 54) automatically applies the react-native-worklets
    // plugin required by Reanimated 4 — do not add it manually (causes duplicate transform).
    presets: ['babel-preset-expo'],
  }
}
