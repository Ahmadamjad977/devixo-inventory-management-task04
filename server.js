/* server.js - starts the app on your own computer: npm start */

const app = require('./app');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`StockPilot is running at http://localhost:${port}`);
});
