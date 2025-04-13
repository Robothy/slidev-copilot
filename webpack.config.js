const path = require('path'); /*$*/
 /*$*/
module.exports = { /*$*/
  entry: './src/extension.ts', /*$*/
  target: 'node', /*$*/
  mode: 'production', /*$*/
  output: { /*$*/
    path: path.resolve(__dirname, 'dist'), /*$*/
    filename: 'extension.js', /*$*/
    libraryTarget: 'commonjs2' /*$*/
  }, /*$*/
  externals: { /*$*/
    vscode: 'commonjs vscode' /*$*/
  }, /*$*/
  resolve: { /*$*/
    extensions: ['.ts', '.tsx', '.js'] /*$*/
  }, /*$*/
  module: { /*$*/
    rules: [ /*$*/
      { /*$*/
        test: /\.tsx?$/, /*$*/
        use: 'ts-loader', /*$*/
        exclude: /node_modules/ /*$*/
      } /*$*/
    ] /*$*/
  } /*$*/
}; /*$*/