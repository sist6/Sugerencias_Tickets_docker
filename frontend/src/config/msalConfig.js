// src/config/msalConfig.js
import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_CLIENT_ID,               // <-- DEBE SER STRING
    authority: process.env.REACT_APP_AUTHORITY,             // ej.: https://login.microsoftonline.com/<tenant-id>
    redirectUri: process.env.REACT_APP_REDIRECT_URI,        // ej.: https://myapp.local:3000/auth/callback
    postLogOutRedirectUri:
      process.env.REACT_APP_POST_LogOut_REDIRECT_URI,      // ej.: https://myapp.local:3000/
  },

  cache: {
    cacheLocation: 'memory',        
    storeAuthStateInCookie: false,         // true solo para IE11/Edge Legacy
  },

  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        // opcional: filtra logs de MSAL
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: window?.MSAL_LOG_LEVEL ?? 'Info',
    },
  },
};
export const msalInstance = 
  (window.location.protocol === "https:" || process.env.NODE_ENV === "development") 
    ? new PublicClientApplication(msalConfig)
    : null;
