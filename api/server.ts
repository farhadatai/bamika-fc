import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`Bamika FC API server running on port ${port}`);
});
