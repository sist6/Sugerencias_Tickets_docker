import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [logoWidth, setLogoWidth] = useState(null);
  useEffect(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved) {
      setTheme(saved);
    } else if (prefersDark) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    // Apply theme to html element for Tailwind dark: classes
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };





  const LOGO_URL = theme === 'dark' 
    ? 'https://www.sohohoteles.com/wp-content/uploads/2019/06/Boho-Boutique-Logo-Web-Blanco.png'
    : 'https://www.sohohoteles.com/wp-content/uploads/elementor/thumbs/SBH_horizon_black-1-qfpz0t8dk91mzcrpuvbipag71s20zgqd1l8dzo7ytc.png';
  useEffect(() => {
    if (theme === 'light') {
      const img = new Image();
      img.src = LOGO_URL;
      img.onload = () => setLogoWidth(img.naturalWidth);
    }
  }, [theme, LOGO_URL]);
  const computedWidth = logoWidth ? `${logoWidth}px` : '150px';

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, LOGO_URL, logoWidth: computedWidth, }}>
      {children}
    </ThemeContext.Provider>
  );
}

