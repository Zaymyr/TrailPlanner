const { withAndroidManifest } = require('expo/config-plugins');

// `orientation: 'portrait'` makes Android imply a required
// android.hardware.screen.portrait feature, which Play Console flags because it
// hides the app from tablets, desktop and XR devices. Declare it optional.
const OPTIONAL_FEATURES = ['android.hardware.screen.portrait'];

module.exports = function withOptionalScreenFeatures(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] ?? [];

    for (const name of OPTIONAL_FEATURES) {
      const existing = manifest['uses-feature'].find((feature) => feature.$?.['android:name'] === name);
      if (existing) {
        existing.$['android:required'] = 'false';
      } else {
        manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
      }
    }

    return config;
  });
};
