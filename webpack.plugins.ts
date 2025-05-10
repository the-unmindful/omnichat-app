import type { Configuration } from 'webpack';
// This plugin runs TypeScript type checking in a separate process
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

export const plugins: Configuration['plugins'] = [
  new ForkTsCheckerWebpackPlugin({
    // Configure the logger for type checking output
    logger: {
      log: console.log,
      // warn: console.warn, // <-- REMOVE THIS LINE
      error: console.error,
    },
  }),
  // Add any other Webpack plugins you might need here
  // For example, CopyWebpackPlugin, DefinePlugin, etc.
];