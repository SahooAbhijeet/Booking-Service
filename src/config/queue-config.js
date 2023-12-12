const amqplib = require('amqplib');

let connection, channel;
async function connectQueue() {
    try {
        connection = await amqplib.connect("amqp://localhost");
        channel = await connection.createChannel()
        await channel.assertQueue("Noti-Queue");
    } catch (error) {
        console.log(error);
        throw error;
    }
}

async function sendData(data) {
    try {
        await channel.sendToQueue("Recession", Buffer.from(JSON.stringify(data)));
    } catch (error) {
        console.log(error);
        throw {error};
    }
}

module.exports = {
    connectQueue,
    sendData
}