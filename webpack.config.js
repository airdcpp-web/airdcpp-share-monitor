const path = require('path');
const webpack = require('webpack');

const packageJson = require('./package.json');

const release = process.env.NODE_ENV === 'production';

const plugins = [
  // Optional binary requires that should be ignored
  new webpack.IgnorePlugin({
    resourceRegExp: /.*\/build\/.*\/(validation|bufferutil)/
  }),
  new webpack.DefinePlugin({
    'EXTENSION_NAME': JSON.stringify(packageJson.name),
    'EXTENSION_VERSION': JSON.stringify(packageJson.version),
    'EXTENSION_BUILD_TIME': JSON.stringify((new Date).getTime()),
  })
];

console.log('Release: ' + release);

if (!release) {
  // Required for debugging
  // Release build should add the require manually so that the module gets bundled
  plugins.push(
    new webpack.BannerPlugin({
      banner: 'require("source-map-support").install();',
      raw: true, 
      entryOnly: false
    })
  );
}

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: release ? './src/index.ts' : './src/main.ts',
  target: 'node',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'main.js',
    libraryTarget: 'umd'
  },
  plugins: plugins,
  devtool: 'source-map',
  module: {
    rules: [
      { 
        test: /\.(ts|js)$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.ts', '.js' ],
  },
}
