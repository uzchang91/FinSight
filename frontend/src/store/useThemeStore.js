import { create } from 'zustand';

const savedTheme = localStorage.getItem('theme');
const isDark = savedTheme === 'dark';
document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

export const useThemeStore = create((set) => ({
  isDarkMode: isDark,
  toggleTheme: () => set((state) => {
    const nextMode = !state.isDarkMode;
    document.documentElement.setAttribute('data-theme', nextMode ? 'dark' : 'light');
    localStorage.setItem('theme', nextMode ? 'dark' : 'light');
    return { isDarkMode: nextMode };
  }),
}));