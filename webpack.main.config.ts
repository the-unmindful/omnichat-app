import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application's main process
   */
  entry: './src/index.ts', // Path to your main process entry file
  // Put your normal webpack config below here
  module: {
    rules, // Use the rules defined in webpack.rules.ts
  },
  resolve: {
    // Specify file extensions Webpack should resolve
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  // Add optimization options if needed, e.g., for production builds
  // optimization: {
  //   minimize: false, // Example: disable minimization for main process if needed
  // },
};