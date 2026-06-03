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

  // SPA history fallback. Every client-side route (/home, /learn,
  // /login, …) needs to resolve to index.html so React Router can pick
  // it up; otherwise webpack-dev-server's Express layer returns a raw
  // 404. The declarative `historyApiFallback` option silently fails on
  // some webpack-dev-server v4 / Node combinations (notably Node 22+),
  // so we inject the rewrite as a middleware to guarantee it runs.
  //
  // Note: previously this file had a `proxy.bypass` block here that
  // silently broke SPA routing in webpack-dev-server v4 because setting
  // `proxy` without a `target` is treated as a routed proxy with
  // nowhere to go. Removed — the frontend talks to the backend via
  // REACT_APP_BACKEND_URL with the absolute URL, so we never needed a
  // dev-server proxy in the first place. The `proxy` field in
  // package.json was removed for the same reason.
  devServerConfig.historyApiFallback = {
    disableDotRule: true,
    index: '/index.html',
  };

  const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

  devServerConfig.setupMiddlewares = (middlewares, devServer) => {
    if (originalSetupMiddlewares) {
      middlewares = originalSetupMiddlewares(middlewares, devServer);
    }

    // Front-of-chain SPA-fallback middleware. Rewrites any HTML-accepting
    // GET that doesn't look like a static asset or an API call to
    // /index.html so webpack's static layer serves the React shell.
    // Runs before webpack-dev-middleware so the request still resolves
    // to the live in-memory bundle, not a stale disk copy.
    middlewares.unshift({
      name: 'spa-history-fallback',
      middleware: (req, res, next) => {
        if (req.method !== 'GET') return next();
        const accept = req.headers.accept || '';
        if (!accept.includes('text/html')) return next();
        const url = req.url.split('?')[0];
        // Pass through anything that looks like a real file (has an
        // extension after the last slash) or an API call.
        if (/\.[a-zA-Z0-9]+$/.test(url)) return next();
        if (url.startsWith('/api/') || url.startsWith('/sockjs-node') || url.startsWith('/ws')) {
          return next();
        }
        req.url = '/index.html';
        return next();
      },
    });

    if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
      setupHealthEndpoints(devServer, healthPluginInstance);
    }

    return middlewares;
  };

  return devServerConfig;
};

module.exports = webpackConfig;
