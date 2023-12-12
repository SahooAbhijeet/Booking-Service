const axios = require('axios');
const { StatusCodes } = require('http-status-codes');
const { BookingRepository } = require('../repositories');
const {ServerConfig, QueueConfig} = require('../config');
const db = require('../models');
const AppError = require('../utils/errors/app-error');
const {Enums} = require('../utils/common');
const { Console } = require('winston/lib/winston/transports');
const { BOOKED, CANCELLED } = Enums.BOOKING_STATUS;


const bookingRepository = new BookingRepository();

async function createBooking(data) {
    const transaction = await db.sequelize.transaction();
    try {
        const flight = await axios.get(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}`);
        const flightData = flight.data.data;
        if(data.noofSeats > flightData.totalSeats){
            throw new AppError('Not enough seats available', StatusCodes.BAD_REQUEST);
        }
        const totalBillingAmount = data.noofSeats*flightData.price;
        console.log(totalBillingAmount);
        const bookingPayload = {...data, totalCost: totalBillingAmount};
        const booking = await bookingRepository.create(bookingPayload, transaction);

        await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}/seats`,{
            seats: data.noofSeats
        })
        await transaction.commit();
        return booking
    } catch (error) {
        await transaction.rollback();
    }
}

async function makePayment(data) {
    const transaction = await db.sequelize.transaction();
    try {
        const bookingDetails = await bookingRepository.get(data.bookingId, transaction);
        if(bookingDetails.status == CANCELLED) {
            throw new AppError('The BOOKING was expired', StatusCodes.BAD_REQUEST);
        }
        console.log(bookingDetails);
        const bookingTime = new Date(bookingDetails.createdAt);
        const currentTime = new Date();
        if(currentTime-bookingTime > 3000000) {
            await cancelBooking(data.bookingId);
            throw new  AppError('The booking was expired', StatusCodes.BAD_REQUEST);
        }
        if(bookingDetails.totalCost != data.totalCost){
            throw new AppError('The amount of the payment doesnot match', StatusCodes.BAD_REQUEST);
        }
        if(bookingDetails.userId != data.userId) {
            throw new AppError('The user corresponding to the booking doesnot match', StatusCodes.BAD_REQUEST);
        }
        // we assume here payment is successfull
        await bookingRepository.update(data.bookingId, {status: BOOKED}, transaction);
        await QueueConfig.sendData({
            recipientEmail: "abhijitas@gmail.com",
            subject: "Flight_Booked",
            text: `Booking successfully done for the booking ${data.bookingId}`
        });
        await transaction.commit();

    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function cancelBooking(bookingId) {
    const transaction = await db.sequelize.transaction();
    try {
        const bookingDetails = await bookingRepository.get(bookingId, transaction);
        console.log(bookingDetails);
        if(bookingDetails.status == CANCELLED) {
            await transaction.commit();
            return true;
        }
        await axios.patch(`${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${bookingDetails.flightId}/seats`,{
            seats: bookingDetails.noofSeats,
            dec:  0
        });
        await bookingRepository.update(bookingId, {status: CANCELLED}, transaction);
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function cancelOldBookings() {
    try {
        const time = new Date(Date.now() - 1000 * 300); // time 5 minutes ago
        const response = await bookingRepository.cancelOldBookings(time);
        return response;
    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    createBooking,
    makePayment,
    cancelBooking,
    cancelOldBookings
}  