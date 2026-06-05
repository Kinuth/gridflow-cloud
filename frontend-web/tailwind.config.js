module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        solar: {
          bg: '#0B0F12',
          panel: '#12181D',
          card: '#1E293B',
          cardHover: '#283548',
          accent: '#10B981', // Emerald green
          accentHover: '#059669',
          warning: '#F59E0B',
          danger: '#EF4444',
          info: '#3B82F6',
          textMuted: '#94A3B8',
          textPrimary: '#F1F5F9'
        }
      }
    },
  },
  plugins: [],
}
