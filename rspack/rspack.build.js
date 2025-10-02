const { rspack } = require('@rspack/core');
const path = require('path');
const { merge } = require('webpack-merge');
const common = require('../rspack/rspack.common.js');

module.exports = merge(common, {
    mode: 'production',
    entry: {
        'converse': path.resolve(__dirname, '../src/entry.js'),
        'converse.min': path.resolve(__dirname, '../src/entry.js'),
    },
    optimization: {
        minimize: true,
        moduleIds: 'named', // Helps with debugging
        minimizer: [
            new rspack.SwcJsMinimizerRspackPlugin({
                minimizerOptions: {
                    minify: true,
                    mangle: true,
                    compress: {
                        drop_debugger: process.env.DROP_DEBUGGER === 'true',
                        passes: 2,
                    },
                    format: {
                        comments: false,
                    },
                },
            }),
            new rspack.LightningCssMinimizerRspackPlugin(),
        ],
    },
    module: {
        rules: [
            {
                test: /\.(js|ts)$/,
                use: [
                    {
                        loader: 'minify-html-literals-loader',
                    },
                ],
            },
            {
                test: /\.scss$/,
                use: [
                    rspack.CssExtractRspackPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            url: false,
                            sourceMap: true,
                        },
                    },
                    {
                        loader: 'postcss-loader',
                        options: { sourceMap: true },
                    },
                    {
                        loader: 'sass-loader',
                        options: {
                            sassOptions: {
                                silenceDeprecations: ['color-functions', 'global-builtin', 'import', 'mixed-decls'],
                                includePaths: [
                                    path.resolve(__dirname, '../node_modules/'),
                                    path.resolve(__dirname, '../src/'),
                                ],
                            },
                            sourceMap: true,
                        },
                    },
                ],
            },
        ],
    },
    plugins: [
        new rspack.CssExtractRspackPlugin({
            filename: '../dist/converse.min.css',
        }),
        new rspack.CssExtractRspackPlugin({
            filename: '../dist/converse.css',
        }),
        new rspack.CopyRspackPlugin({
            patterns: [
                {
                    from: 'node_modules/strophe.js/src/shared-connection-worker.js',
                    to: 'shared-connection-worker.js',
                },
                { from: 'sounds', to: 'sounds' },
                { from: 'images/favicon.ico', to: 'images/favicon.ico' },
                { from: 'images/custom_emojis', to: 'images/custom_emojis' },
                { from: 'logo/conversejs-filled-192.png', to: 'images/logo' },
                { from: 'logo/conversejs-filled-512.png', to: 'images/logo' },
                { from: 'logo/conversejs-filled-192.svg', to: 'images/logo' },
                { from: 'logo/conversejs-filled-512.svg', to: 'images/logo' },
                { from: 'logo/conversejs-filled.svg', to: 'images/logo' },
                { from: 'logo/conversejs-gold-gradient.svg', to: 'images/logo' },
                { from: 'src/shared/styles/webfonts', to: 'webfonts' },
                { from: 'manifest.json', to: 'manifest.json' },
                { from: 'src/headless/plugins/emoji/emoji.json', to: 'emoji.json' },
            ],
        }),
    ]
});
