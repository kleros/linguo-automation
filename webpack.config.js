const path = require('path');
const webpack = require('webpack');
const slsw = require('serverless-webpack');
const nodeExternals = require('webpack-node-externals');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = (async () => {
  const accountId = await slsw.lib.serverless.providers.aws.getAccountId();

  return {
    entry: slsw.lib.entries,
    output: {
      libraryTarget: 'commonjs',
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
    },
    target: 'node',
    mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
    resolve: {
      alias: {
        '~': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      new CleanWebpackPlugin(),
      new webpack.DefinePlugin({
        AWS_ACCOUNT_ID: `${accountId}`,
      }),
    ],
    module: {
      rules: [
        {
          test: /\.m?js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'babel-loader',
          },
        },
      ],
    },
    externals: [nodeExternals()],
  };
})();
