// craco.config.js
const path = require("path");
const CompressionPlugin = require("compression-webpack-plugin");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: false, // Disabled to prevent overlay blocking UI
};

// Conditionally load visual edits modules only in dev mode
let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

const webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
        "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
        "no-eval": "error",
        "no-implied-eval": "error",
        "eqeqeq": ["error", "always"],
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      // Production optimizations
      if (!isDevServer) {
        // Gzip pre-compression for static assets
        webpackConfig.plugins.push(
          new CompressionPlugin({
            algorithm: "gzip",
            test: /\.(js|css|html|svg)$/,
            threshold: 10240,
            minRatio: 0.8,
          })
        );

        // Split vendor chunks for better long-term caching
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: "all",
            cacheGroups: {
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
                name: "vendor-react",
                priority: 40,
              },
              radix: {
                test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
                name: "vendor-radix",
                priority: 30,
              },
              framer: {
                test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
                name: "vendor-framer",
                priority: 30,
              },
              recharts: {
                test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
                name: "vendor-recharts",
                priority: 30,
              },
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name: "vendor-misc",
                priority: 10,
                reuseExistingChunk: true,
              },
            },
          },
        };
      }

      return webpackConfig;
    },
  },
};

// Only add babel metadata plugin during dev server
if (config.enableVisualEdits && babelMetadataPlugin) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

webpackConfig.devServer = (devServerConfig) => {
  // Fix allowedHosts — CRA sometimes injects an empty string
  if (Array.isArray(devServerConfig.allowedHosts)) {
    devServerConfig.allowedHosts = devServerConfig.allowedHosts.filter(h => h && h.length > 0);
    if (devServerConfig.allowedHosts.length === 0) {
      devServerConfig.allowedHosts = 'all';
    }
  }

  // Apply visual edits dev server setup only if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  devServerConfig.proxy = {
    ...devServerConfig.proxy,
    bypass: function(req, res, proxyOptions) {
      // Don't proxy hot-update files
      if (req.url && req.url.includes('hot-update')) {
        return req.url;
      }
      // Don't proxy static assets
      if (req.url && (req.url.match(/\.(js|css|png|jpg|jpeg|svg|ico|json|woff|woff2|ttf|eot|map)$/))) {
        return req.url;
      }
      // Don't proxy requests containing %PUBLIC_URL%
      if (req.url && req.url.includes('%PUBLIC_URL%')) {
        return req.url;
      }
    },
  };

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
