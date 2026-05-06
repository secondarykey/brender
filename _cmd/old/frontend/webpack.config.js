var debug   = process.env.NODE_ENV !== "production";
var webpack = require('webpack');
var glob    = require('glob');
var path    = require('path');

const entries = glob.sync("./src/**/*.js",{mark:true});

function convertPath(entry) {
    var e = [];
    for ( var i = 0; i < entry.length; ++i ) {
      let url = entry[i];
      e[i] = "./" + unescape(url.split('\\').join('/'));
    }
    return e;
}

var newEntry = convertPath(entries)

module.exports = {
  entry: newEntry,
  module: {
    rules: [{
      test: /\.jsx?$/,
      exclude: /(node_modules|bower_components)/,
      use: [{
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-react', '@babel/preset-env']
        }
      }]
    },{ 
      test: /\.css$/, 
      use: ['style-loader','css-loader']
    }]
  },
  output: {
    path: path.resolve(__dirname,"public"),
    filename: "js/client.min.js"
  },
  devServer: {
    static: {
      directory: path.resolve(__dirname,"public")
    },
    historyApiFallback: {
      index: 'index.html'
    },
    proxy: {
        "/api":"http://localhost:8080",
        "/thumb":"http://localhost:8080",
        "/download":"http://localhost:8080"
    },
    port:3000
  },
  plugins: debug ? [] : [
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({ mangle: false, sourcemap: false }),
  ]
};
