import type { ModuleOptions } from 'webpack';

export const rules: Required<ModuleOptions>['rules'] = [
  // Add support for native node modules - This is crucial
  {
    // We're specifying native_modules in the test because the asset relocator loader generates a
    // "fake" .node file which is really a cjs file.
    test: /native_modules[/\\].+\.node$/,
    use: 'node-loader',
  },
  // Rule for the asset relocator loader itself
  {
    test: /[/\\]node_modules[/\\].+\.(m?js|node)$/,
    parser: { amd: false }, // Disable AMD parsing for node modules
    use: {
      loader: '@vercel/webpack-asset-relocator-loader',
      options: {
        // Configure the output directory for relocated assets
        outputAssetBase: 'native_modules',
      },
    },
  },
  // Rule for processing TypeScript files
  {
    test: /\.tsx?$/, // Match .ts and .tsx files
    exclude: /(node_modules|\.webpack)/, // Exclude node_modules and webpack build artifacts
    use: {
      loader: 'ts-loader',
      options: {
        // Speeds up compilation by skipping type checking (rely on ForkTsCheckerWebpackPlugin for that)
        transpileOnly: true,
      },
    },
  },
  // Add other rules for assets like images or fonts if needed
  // Example for images:
  // {
  //   test: /\.(png|jpg|jpeg|gif|svg)$/i,
  //   type: 'asset/resource',
  // },
];