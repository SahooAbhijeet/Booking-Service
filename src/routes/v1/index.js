const express = require('express');

const router = express.Router();

const bookingRoutes = require('./booking');

router.use('/bookings', bookingRoutes);

module.exports = router;