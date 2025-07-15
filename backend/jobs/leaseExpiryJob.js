// const cron = require('node-cron');
// const User = require('../models/User');
// const emailService = require('../services/emailService');

// class LeaseExpiryJob {
//     static start() {
//         // Run every day at 9:45 AM to check for leases expiring in 10 days
//         cron.schedule('45 9 * * *', async () => {
//             console.log('Checking for leases expiring in 10 days...');
            
//             try {
//                 const tenDaysFromNow = new Date();
//                 tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
                
//                 const today = new Date();
//                 today.setHours(0, 0, 0, 0);
//                 tenDaysFromNow.setHours(23, 59, 59, 999);

//                 // Find tenants whose lease expires in exactly 10 days
//                 const expiringTenants = await User.find({
//                     role: 'tenant',
//                     isActive: true,
//                     'tenantInfo.leaseEndDate': {
//                         $gte: today,
//                         $lte: tenDaysFromNow
//                     }
//                 });

//                 console.log(`Found ${expiringTenants.length} tenants with leases expiring in 10 days`);

//                 for (const tenant of expiringTenants) {
//                     const daysRemaining = Math.ceil(
//                         (new Date(tenant.tenantInfo.leaseEndDate) - new Date()) / (1000 * 60 * 60 * 24)
//                     );

//                     if (daysRemaining === 10) {
//                         try {
//                             await emailService.sendLeaseExpiryWarning({
//                                 name: tenant.name,
//                                 email: tenant.email,
//                                 roomNumber: tenant.tenantInfo.roomNumber,
//                                 leaseEndDate: tenant.tenantInfo.leaseEndDate,
//                                 daysRemaining: daysRemaining
//                             });
                            
//                             console.log(`Lease expiry warning sent to ${tenant.email}`);
//                         } catch (emailError) {
//                             console.error(`Failed to send lease expiry warning to ${tenant.email}:`, emailError);
//                         }
//                     }
//                 }

//             } catch (error) {
//                 console.error('Error in lease expiry check job:', error);
//             }
//         });

//         console.log('Lease expiry notification job started');
//     }
// }

// module.exports = LeaseExpiryJob;
