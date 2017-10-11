// webpack.config.js
const path = require('path');
const webpack = require('webpack');
const ClosureCompilerPlugin = require('webpack-closure-compiler');

const theModule = {
    loaders: [
        {
            test: /\.js$/,
            exclude: /node_modules/,
            loader: 'babel-loader',
            query: {
                presets: ['es2015','react']
            }
        }
    ]
};

const sourceTemplate = 'react-causality-redux-router';
const source = `${sourceTemplate  }.js`;
const minFileName = `${sourceTemplate  }.min.js`;

const externalsTest = {
    'causality-redux': 'require(\'causality-redux\')',
    'history': 'require(\'history\')'
};

const externals = {
    'causality-redux': 'CausalityRedux',
    'history': 'history'
};

const externalsLib = {
    'causality-redux': 'causality-redux',
    'history': 'history'
};

const configDistCausalityReduxReact = {
        entry: path.join(__dirname, `src/${  source}`),
        output: {
            path: path.join(__dirname, 'dist'),
            filename: source
        },
        externals: externals,
        module: theModule
};

const configTestCausalityReduxReact = {
        entry: path.join(__dirname, 'test/' + 'react-test.js'),
        output: {
            path: path.join(__dirname, 'test'),
            filename: 'react-test-es5.js'
        },
        externals: externalsTest,
        module: theModule
};

const configLibCausalityReduxReact = {
    entry: path.join(__dirname, `src/${  source}`),
    output: {
        path: path.join(__dirname, 'lib'),
        filename: source,
        libraryTarget: 'commonjs2'
    },
    externals: externalsLib,
    module: theModule
};

const configDistCausalityReduxReactMin = {
        entry: path.join(__dirname, `dist/${  source}`),
        output: {
            path: path.join(__dirname, 'dist'),
            filename: minFileName
        },

        plugins: [
           new ClosureCompilerPlugin({
              compiler: {
                language_in: 'ECMASCRIPT5',
                language_out: 'ECMASCRIPT5',
                compilation_level: 'SIMPLE'
              }
            })
        ]
};

if ( process.env.NODE_ENV != 'min' ) {
    module.exports = [
        configDistCausalityReduxReact,
        configLibCausalityReduxReact,
        configTestCausalityReduxReact
    ];
} else {
    module.exports = [
        configDistCausalityReduxReactMin
    ];
}

