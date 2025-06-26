const User = require('../models/User');
const UtilityBill = require('../models/UtilityBill');
const UtilityReading = require('../models/UtilityReading');
const BeverageConsumption = require('../models/BeverageConsumption');

class HistoricalDataService {
    // Get complete tenant history
    static async getTenantHistory(tenantId) {
        try {
            const tenant = await User.findById(tenantId)
                .populate('tenantInfo.apartmentId')
                .select('-password');

            if (!tenant || tenant.role !== 'tenant') {
                throw new Error('Tenant not found');
            }

            // Get payment history
            const paymentHistory = await UtilityBill.find({ tenantId })
                .populate('apartmentId', 'unitNumber')
                .sort('-createdAt');

            // Get utility consumption
            const utilityConsumption = await UtilityReading.find({
                apartmentId: tenant.tenantInfo.apartmentId
            }).sort('-createdAt');

            // Get beverage consumption
            const beverageConsumption = await BeverageConsumption.find({ tenantId })
                .populate('beverageId', 'name category')
                .sort('-consumptionDate');

            // Calculate totals
            const totalPayments = paymentHistory.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
            const totalBeverageConsumption = beverageConsumption.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

            return {
                tenant,
                paymentHistory,
                utilityConsumption,
                beverageConsumption,
                summary: {
                    totalPayments,
                    totalBeverageConsumption,
                    totalBills: paymentHistory.length,
                    totalUtilityReadings: utilityConsumption.length,
                    totalBeverageOrders: beverageConsumption.length
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Get all historical tenants (expired leases)
    static async getHistoricalTenants() {
        try {
            const historicalTenants = await User.find({
                role: 'tenant',
                'tenantInfo.leaseStatus': { $in: ['expired', 'terminated'] }
            })
                .populate('tenantInfo.apartmentId', 'unitNumber building')
                .select('-password')
                .sort('-tenantInfo.leaseEndDate');

            return historicalTenants;
        } catch (error) {
            throw error;
        }
    }

    // Update lease statuses (run periodically)
    static async updateLeaseStatuses() {
        try {
            const tenants = await User.find({ role: 'tenant' });

            for (const tenant of tenants) {
                tenant.updateLeaseStatus();
                await tenant.save();
            }

            return { updated: tenants.length };
        } catch (error) {
            throw error;
        }
    }

    // Archive tenant data when lease ends
    static async archiveTenant(tenantId, reasonForLeaving = '') {
        try {
            const tenant = await User.findById(tenantId);

            if (!tenant || tenant.role !== 'tenant') {
                throw new Error('Tenant not found');
            }

            // Calculate final stay duration
            const stayDuration = tenant.calculateStayDuration();

            // Add to lease history
            const leaseRecord = {
                apartmentId: tenant.tenantInfo.apartmentId,
                roomNumber: tenant.tenantInfo.roomNumber,
                startDate: tenant.tenantInfo.leaseStartDate,
                endDate: tenant.tenantInfo.leaseEndDate,
                monthlyRent: tenant.tenantInfo.monthlyRent,
                securityDeposit: tenant.tenantInfo.securityDeposit,
                reasonForLeaving,
                totalDaysStayed: stayDuration?.totalDays || 0,
                totalMonthsStayed: stayDuration?.totalMonths || 0
            };

            tenant.tenantInfo.leaseHistory.push(leaseRecord);
            tenant.tenantInfo.leaseStatus = 'expired';
            tenant.isHistoricalRecord = true;

            await tenant.save();

            return tenant;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = HistoricalDataService;
