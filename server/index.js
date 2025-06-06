const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/api/fetch-book', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Missing URL');
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch content: ${response.statusText}`);
    }

    const content = await response.text();
    res.send(content);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).send('Failed to fetch content');
  }
});

app.listen(5000, () => {
  console.log('Server is running on http://localhost:5000');
});
