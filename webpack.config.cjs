const path = require('path');

module.exports = {
  entry: './src/extension.ts', // Process TypeScript files directly
  target: 'node',
  mode: 'development', // Use development mode for better sourcemaps
  devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]' // This helps with sourcemap paths
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                sourceMap: true // Ensure sourcemaps are generated
              }
            }
          }
        ],
        exclude: /node_modules/
      }
    ]
  }
};