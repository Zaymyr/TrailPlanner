const { withPodfile } = require('expo/config-plugins');

const MODULAR_HEADER_PODS = [
  "pod 'GoogleUtilities', :modular_headers => true",
  "pod 'RecaptchaInterop', :modular_headers => true",
];

const withGoogleSignInModularHeaders = (config) =>
  withPodfile(config, (config) => {
    if (config.modResults.language !== 'ruby') {
      return config;
    }

    const { contents } = config.modResults;
    if (MODULAR_HEADER_PODS.every((pod) => contents.includes(pod))) {
      return config;
    }

    const anchor = 'use_expo_modules!';
    if (!contents.includes(anchor)) {
      return config;
    }

    const modularHeadersBlock = MODULAR_HEADER_PODS.map((pod) => `  ${pod}`).join('\n');

    config.modResults.contents = contents.replace(anchor, `${modularHeadersBlock}\n  ${anchor}`);
    return config;
  });

module.exports = withGoogleSignInModularHeaders;

