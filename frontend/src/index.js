import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (process.env.NODE_ENV === 'production') {
      // Track whether a service worker was already controlling this page
      // BEFORE we register. If yes, we're updating an existing PWA
      // install — when the new worker takes over (controllerchange), we
      // reload so the open tab picks up the latest bundle instead of
      // running the old JS in memory until the user manually refreshes.
      // If no (first install), we skip the reload dance to avoid an
      // unwanted page flash on initial visit.
      const wasControlled = Boolean(navigator.serviceWorker.controller);

      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('ServiceWorker registered:', registration.scope);

          // Force an update check immediately (browsers otherwise only
          // re-check the SW script every 24h by default) and again
          // whenever the tab regains focus. Users who keep the PWA open
          // for long stretches still pull the latest deploy within
          // seconds of switching back to the tab.
          const checkForUpdate = () => {
            registration.update().catch(() => {});
          };
          checkForUpdate();
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkForUpdate();
          });
        })
        .catch((error) => {
          console.warn('ServiceWorker registration failed:', error);
        });

      // Reload exactly once when a new SW takes control. The guard
      // prevents reload loops if controllerchange fires more than once
      // (can happen with multiple registrations or fast successive
      // deploys).
      if (wasControlled) {
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      }
      return;
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  });
}
