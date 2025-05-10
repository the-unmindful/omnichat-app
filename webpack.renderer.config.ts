import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins'; // Import plugins

// Add the specific rule for handling CSS files in the renderer process
rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

export const rendererConfig: Configuration = {
  module: {
    rules, // Use the rules defined in webpack.rules.ts (plus the added CSS rule)
  },
  plugins, // Use the plugins defined in webpack.plugins.ts
  resolve: {
    // Specify file extensions Webpack should resolve for the renderer
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
  // Add optimization options if needed, especially for production builds
  // optimization: {
  //   splitChunks: { // Example: Code splitting
  //     chunks: 'all',
  //   },
  // },
};