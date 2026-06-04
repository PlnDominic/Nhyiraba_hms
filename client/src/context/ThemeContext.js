import React, { createContext, useState, useEffect, useContext } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const getInitialTheme = () => {
        if (typeof window !== 'undefined' && window.localStorage) {
            const storedPrefs = window.localStorage.getItem('color-theme');
            if (typeof storedPrefs === 'string') {
                return storedPrefs;
            }

            const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
            if (userMedia.matches) {
                return 'dark';
            }
        }
        return 'dark'; // Default to dark
    };

    const [theme, setTheme] = useState(getInitialTheme);

    const rawSetTheme = (rawTheme) => {
        const root = window.document.documentElement;
        const isDark = rawTheme === 'dark';

        root.classList.remove(isDark ? 'light' : 'dark');
        root.classList.add(rawTheme);

        localStorage.setItem('color-theme', rawTheme);
    };

    if (typeof window !== 'undefined') {
        // Apply theme classes
        const root = document.documentElement;

        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
            document.body.classList.add('dark-mode');
            document.body.classList.remove('light-mode');

            // Additional class for custom CSS if needed
            document.body.style.backgroundColor = '#1a1a1a';
            document.body.style.color = '#ffffff';
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
            document.body.classList.add('light-mode');
            document.body.classList.remove('dark-mode');

            // Additional class for custom CSS if needed
            document.body.style.backgroundColor = '#f8fafc';
            document.body.style.color = '#334155';
        }
    }

    useEffect(() => {
        rawSetTheme(theme);
    }, [theme]);

    // Apply theme on initial load
    useEffect(() => {
        const initialTheme = getInitialTheme();
        rawSetTheme(initialTheme);
    }, []);

    // Toggle between light and dark themes
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);