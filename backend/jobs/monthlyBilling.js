// const cron = require('node-cron');
// const BeverageCart = require('../models/BeverageCart');
// const BeverageConsumption = require('../models/BeverageConsumption');
// const UtilityBill = require('../models/UtilityBill');
// const User = require('../models/User');

// class MonthlyBillingService {
//     static async processBeverageConsumption() {
//         try {
//             console.log('Starting monthly beverage billing process...');

//             // Find all active carts with items
//             const carts = await BeverageCart.find({
//                 status: 'active',
//                 'items.0': { $exists: true } // Only carts with items
//             }).populate('tenantId', 'name tenantInfo.roomNumber tenantInfo.apartmentId');

//             let processedCarts = 0;
//             let totalAmount = 0;

//             for (const cart of carts) {
//                 if (!cart.tenantId) continue;

//                 // Create consumption records for each cart item
//                 const consumptionRecords = cart.items.map(item => ({
//                     tenantId: cart.tenantId._id,
//                     beverageId: item.beverageId,
//                     beverageName: item.beverageName,
//                     quantity: item.quantity,
//                     unitPrice: item.unitPrice,
//                     totalAmount: item.totalPrice,
//                     consumptionDate: new Date(),
//                     roomNumber: cart.tenantId.tenantInfo?.roomNumber,
//                     apartmentId: cart.tenantId.tenantInfo?.apartmentId,
//                     status: 'billed',
//                     billedInMonth: new Date().toLocaleString('default', { month: 'long' }),
//                     billedInYear: new Date().getFullYear()
//                 }));

//                 // Save consumption records
//                 await BeverageConsumption.insertMany(consumptionRecords);

//                 // Update cart status
//                 cart.status = 'billed';
//                 cart.billedAt = new Date();
//                 cart.billingMonth = new Date().toLocaleString('default', { month: 'long' });
//                 cart.billingYear = new Date().getFullYear();
//                 await cart.save();

//                 // Add to utility bill
//                 await this.addToUtilityBill(cart.tenantId._id, consumptionRecords);

//                 processedCarts++;
//                 totalAmount += cart.totalAmount;
//             }

//             console.log(`Monthly billing completed: ${processedCarts} carts processed, $${totalAmount.toFixed(2)} total`);

//             return {
//                 processedCarts,
//                 totalAmount,
//                 success: true
//             };
//         } catch (error) {
//             console.error('Error in monthly beverage billing:', error);
//             throw error;
//         }
//     }

//     static async addToUtilityBill(tenantId, consumptionRecords) {
//         try {
//             const today = new Date();
//             const billMonth = today.toLocaleString('default', { month: 'long' });
//             const billYear = today.getFullYear();

//             // Find or create utility bill
//             let bill = await UtilityBill.findOne({
//                 tenantId: tenantId,
//                 billMonth: billMonth,
//                 billYear: billYear
//             });

//             const tenant = await User.findById(tenantId);
//             if (!tenant) return;

//             if (!bill) {
//                 // Create new bill
//                 bill = new UtilityBill({
//                     tenantId: tenantId,
//                     apartmentId: tenant.tenantInfo?.apartmentId,
//                     billMonth: billMonth,
//                     billYear: billYear,
//                     dueDate: new Date(today.getFullYear(), today.getMonth() + 1, 15),
//                     meteredUtilities: {
//                         electricity: { previousReading: 0, currentReading: 0, rate: 10, amount: 0 },
//                         heatingCooling: { previousReading: 0, currentReading: 0, rate: 8, amount: 0 }
//                     },
//                     fixedCharges: {
//                         cleaningService: { quantity: 1, rate: 500, amount: 500 },
//                         waterJar: { quantity: 0, rate: 0, amount: 0 },
//                         gas: { quantity: 0, rate: 0, amount: 0 }
//                     },
//                     rooftopConsumption: [],
//                     totalAmount: 500, // Base cleaning service
//                     status: 'pending'
//                 });
//             }

//             // Add beverage consumption to bill
//             for (const item of consumptionRecords) {
//                 bill.rooftopConsumption.push({
//                     beverageId: item.beverageId,
//                     beverageName: item.beverageName,
//                     quantity: item.quantity,
//                     rate: item.unitPrice,
//                     amount: item.totalAmount,
//                     date: item.consumptionDate
//                 });
//             }

//             // Recalculate total amount
//             const beverageTotal = consumptionRecords.reduce((sum, item) => sum + item.totalAmount, 0);
//             bill.totalAmount += beverageTotal;

//             await bill.save();
//         } catch (error) {
//             console.error('Error adding to utility bill:', error);
//             throw error;
//         }
//     }

//     static startScheduledJob() {
//         // Run at 23:59 on the last day of every month
//         cron.schedule('59 23 28-31 * *', async () => {
//             try {
//                 const today = new Date();
//                 const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

//                 // Only run on the actual last day of the month
//                 if (today.getDate() !== lastDay) return;

//                 console.log('Running scheduled monthly beverage billing job...');
//                 await this.processBeverageConsumption();
//             } catch (error) {
//                 console.error('Scheduled job error:', error);
//             }
//         });

//         console.log('Monthly billing job scheduled successfully');
//     }

//     // Manual trigger for testing
//     static async triggerManualBilling() {
//         try {
//             console.log('Manual billing trigger initiated...');
//             return await this.processBeverageConsumption();
//         } catch (error) {
//             console.error('Manual billing error:', error);
//             throw error;
//         }
//     }
// }

// module.exports = MonthlyBillingService;
