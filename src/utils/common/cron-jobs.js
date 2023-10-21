const cron = require('node-cron');
const {BookingService} = require('../../services');

function scheduleCrons() {
    cron.schedule('*/3 * * * *', async () => {
        const response = await BookingService.cancelOldBookings();
      });
}

module.exports = scheduleCrons;