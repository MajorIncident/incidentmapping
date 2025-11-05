module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          background: '#F8FAFC',
          accent: '#38BDF8',
        },
      },
      boxShadow: {
        node: '0 10px 25px -20px rgba(15, 23, 42, 0.5)',
      },
    },
  },
  plugins: [],
};
