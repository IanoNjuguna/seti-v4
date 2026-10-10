module.exports = {
  expo: {
    name: 'mobile',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
    },
    android: {
      // Required for a native build (`expo run:android`). Without it Expo
      // derives `com.anonymous.mobile` from the slug and refuses to write the
      // dynamic config, so the build exits before Gradle is ever invoked.
      package: 'com.seti.mobile',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      favicon: './assets/favicon.png',
    },
    scheme: 'seti',
    experiments: {
      typedRoutes: true,
    },
    plugins: [
      'expo-router',
      [
        'expo-camera',
        {
          cameraPermission:
            'Allow Seti to access your camera for scanning merchant QR codes.',
          barcodeScannerEnabled: true,
        },
      ],
    ],
    extra: {
      privyAppId: process.env.PRIVY_APP_ID,
      tempoChainId: process.env.TEMPO_CHAIN_ID,
      allowMainnet: process.env.ALLOW_MAINNET,
      alchemyApiKey: process.env.ALCHEMY_API_KEY,
      tempoRpcUrl: process.env.TEMPO_RPC_URL,
      // Address the merchant fee is collected to. The app needs this to show
      // where the fee goes, and it must match the backend's
      // SETI_TREASURY_ADDRESS exactly or the two legs of a payment disagree.
      treasuryAddress: process.env.SETI_TREASURY_ADDRESS,
      tempoTokens: {
        pathusd: process.env.TEMPO_TOKEN_PATHUSD,
        ousd: process.env.TEMPO_TOKEN_OUSD,
      },
    },
  },
};
