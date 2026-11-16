/* middleware/errorHandler.js
   One place that turns every error into a clean JSON answer. */

function notFound(req, res) {
  res.status(404).json({ error: 'This API route does not exist.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  // Broken JSON sent by a client
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request body is not valid JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The request is too large.' });
  }

  console.error('Server error:', error.message);
  // The user never sees technical details
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}

module.exports = { notFound, errorHandler };
