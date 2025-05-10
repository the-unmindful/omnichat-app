import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses'; // Keep if present, remove if not using Fuses
import { FuseV1Options, FuseVersion } from '@electron/fuses'; // Keep if present, remove if not using Fuses

// Import the configurations from your Webpack config files
import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // If you encounter issues with native modules inside asar, you might need
    // to list them in `asarUnpack`. Example:
    // asarUnpack: ['./node_modules/some-native-module/**/*'],
  },
  rebuildConfig: {},
  makers: [
    // Configure your desired installers/packages
    new MakerSquirrel({}), // Windows installer
    new MakerZIP({}, ['darwin']), // macOS zip
    new MakerRpm({}), // Linux RPM
    new MakerDeb({}), // Linux DEB
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig, // Reference the imported main config object
      // Set a Content Security Policy for development mode
      // Allows connecting to any host (*) which might be needed for API calls,
      // but consider tightening this for production if possible.
      // 'unsafe-eval' might be required by some dev tools or libraries.
      devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:; connect-src 'self' *;",

      renderer: {
        config: rendererConfig, // Reference the imported renderer config object
        entryPoints: [
          {
            html: './src/index.html', // Path to your HTML file
            js: './src/renderer.ts', // Path to your renderer entry point
            name: 'main_window', // An identifier for this entry point
            // Define the preload script entry point
            preload: {
              js: './src/preload.ts', // Path to your preload script
              // No separate config needed for preload usually,
              // it will use rules from mainConfig by default if not specified
              // config: './webpack.preload.config.ts' // Only add if you have a specific preload config file
            },
          },
        ],
      },
      // Optional: configure ports if defaults conflict
      // port: 3000,
      // loggerPort: 9000,
    }),
    // Include the Fuses plugin if you are using Electron Fuses (recommended for security)
    // Remove this entire FusesPlugin block if you don't have it or don't need it.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false, // Disable nodeIntegration security risk
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true, // Recommended for production
    }),
  ],
};

export default config;