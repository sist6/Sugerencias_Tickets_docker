// src/index.jsx (o src/main.jsx)
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { AuthProvider } from "@/contexts/AuthContext";
import { HelmetProvider } from "react-helmet-async";
import "@/index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
import { TooltipProvider } from '@/components/ui/tooltip';
root.render(
   <React.StrictMode>   
    <HelmetProvider>
      
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
     
    </HelmetProvider>
   </React.StrictMode>
);