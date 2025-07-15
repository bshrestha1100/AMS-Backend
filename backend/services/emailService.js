// const nodemailer = require('nodemailer');

// class EmailService {
//     constructor() {
//         this.transporter = nodemailer.createTransport({
//             host: 'smtp.gmail.com',
//             port: 587,
//             secure: false,
//             requireTLS: true,
//             auth: {
//                 user: process.env.EMAIL_USER,
//                 pass: process.env.EMAIL_PASSWORD
//             },
//             tls: {
//                 rejectUnauthorized: false
//             }
//         });
//     }

//     // Welcome email when user is created
//     async sendWelcomeEmail(userDetails) {
//         const { name, email, password, roomNumber, apartmentInfo } = userDetails;

//         const mailOptions = {
//             from: process.env.EMAIL_USER,
//             to: email,
//             subject: 'Welcome to Casamia Apartment! 🏠',
//             html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
//                     <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
//                         <div style="text-align: center; margin-bottom: 30px;">
//                             <h1 style="color: #3b82f6; margin: 0; font-size: 28px;">Welcome to Casamia Apartment</h1>
//                             <p style="color: #6b7280; margin: 10px 0 0 0;">Your new home awaits!</p>
//                         </div>
                        
//                         <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                             <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px;">Dear ${name},</h2>
//                             <p style="color: #374151; line-height: 1.6; margin: 0 0 15px 0;">
//                                 Welcome to Casamia Apartment! We're excited to have you as our new tenant. 
//                                 Below are your apartment details and login credentials for our tenant portal.
//                             </p>
//                         </div>

//                         <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                             <h3 style="color: #1f2937; margin: 0 0 15px 0;">🏠 Your Apartment Details</h3>
//                             <table style="width: 100%; border-collapse: collapse;">
//                                 <tr>
//                                     <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Room Number:</td>
//                                     <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${roomNumber}</td>
//                                 </tr>
//                                 ${apartmentInfo ? `
//                                 <tr>
//                                     <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Unit:</td>
//                                     <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">Unit ${apartmentInfo.unitNumber}</td>
//                                 </tr>
//                                 <tr>
//                                     <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Building:</td>
//                                     <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">Building ${apartmentInfo.building}</td>
//                                 </tr>
//                                 <tr>
//                                     <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Floor:</td>
//                                     <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">Floor ${apartmentInfo.floor}</td>
//                                 </tr>
//                                 ` : ''}
//                             </table>
//                         </div>

//                         <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                             <h3 style="color: #1f2937; margin: 0 0 15px 0;">🔐 Your Login Credentials</h3>
//                             <table style="width: 100%; border-collapse: collapse;">
//                                 <tr>
//                                     <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Email:</td>
//                                     <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${email}</td>
//                                 </tr>
//                                 <tr>
//                                     <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">Password:</td>
//                                     <td style="padding: 8px 0; color: #1f2937; font-weight: 600; background-color: #fff; padding: 5px 10px; border-radius: 4px; font-family: monospace;">${password}</td>
//                                 </tr>
//                             </table>
//                             <p style="color: #92400e; font-size: 14px; margin: 10px 0 0 0;">
//                                 ⚠️ Please change your password after your first login for security.
//                             </p>
//                         </div>

//                         <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                             <h3 style="color: #1f2937; margin: 0 0 15px 0;">📋 Next Steps</h3>
//                             <ul style="color: #374151; line-height: 1.8; margin: 0; padding-left: 20px;">
//                                 <li>Log in to the tenant portal using your credentials</li>
//                                 <li>Contact management for any questions</li>
//                             </ul>
//                         </div>

//                         <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
//                             <p style="color: #6b7280; margin: 0 0 10px 0;">Need help? Contact us:</p>
//                             <p style="color: #3b82f6; margin: 0; font-weight: 500;">
//                                 📧 casamia.apartment.nepal@gmail.com | 📞 +977-9815378838
//                             </p>
//                         </div>
//                     </div>
//                 </div>
//             `
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`Welcome email sent to ${email}`);
//             return { success: true };
//         } catch (error) {
//             console.error('Error sending welcome email:', error);
//             return { success: false, error: error.message };
//         }
//     }

//     // Utility bill notification email
//     async sendUtilityBillEmail(billDetails) {
//         const { name, email, billType, amount, dueDate, billMonth } = billDetails;
//         // Validate email format
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//         if (!email || !emailRegex.test(email)) {
//             console.error('Invalid email address:', email);
//             throw new Error(`Invalid email address: ${email}`);
//         }

//         const mailOptions = {
//             from: process.env.EMAIL_USER,
//             to: email,
//             subject: `New ${billType} Bill - Casamia Apartment 💡`,
//             html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
//                     <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
//                         <div style="text-align: center; margin-bottom: 30px;">
//                             <h1 style="color: #3b82f6; margin: 0; font-size: 24px;">Casamia Apartment</h1>
//                             <p style="color: #6b7280; margin: 10px 0 0 0;">Utility Bill Notification</p>
//                         </div>
                        
//                         <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                             <h2 style="color: #1f2937; margin: 0 0 15px 0;">Dear ${name},</h2>
//                             <p style="color: #374151; line-height: 1.6; margin: 0;">
//                                 Your ${billType} bill for ${billMonth} has been generated. Please review the details below.
//                             </p>
//                         </div>

//                         <div style="background-color: #e0f2fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                             <h3 style="color: #1f2937; margin: 0 0 15px 0;">📄 Bill Details</h3>
//                             <table style="width: 100%; border-collapse: collapse;">
//                                 <tr>
//                                     <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Bill Type:</td>
//                                     <td style="padding: 10px 0; color: #1f2937; font-weight: 600;">${billType}</td>
//                                 </tr>
//                                 <tr>
//                                     <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Billing Period:</td>
//                                     <td style="padding: 10px 0; color: #1f2937; font-weight: 600;">${billMonth}</td>
//                                 </tr>
//                                 <tr>
//                                     <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Amount Due:</td>
//                                     <td style="padding: 10px 0; color: #dc2626; font-weight: 700; font-size: 18px;">Rs. ${amount}</td>
//                                 </tr>
//                                 <tr>
//                                     <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Due Date:</td>
//                                     <td style="padding: 10px 0; color: #dc2626; font-weight: 600;">${new Date(dueDate).toLocaleDateString()}</td>
//                                 </tr>
//                             </table>
//                         </div>

//                         <div style="text-align: center; margin-top: 30px;">
//                             <a href="#" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
//                                 View Full Bill Details
//                             </a>
//                         </div>

//                         <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
//                             <p style="color: #6b7280; margin: 0;">
//                                 📧 casamia.apartment.nepal@gmail.com | 📞 +977-9815378838
//                             </p>
//                         </div>
//                     </div>
//                 </div>
//             `
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`Utility bill email sent to ${email}`);
//             return { success: true };
//         } catch (error) {
//             console.error('Error sending utility bill email:', error);
//             return { success: false, error: error.message };
//         }
//     }
//     async testConnection() {
//         try {
//             await this.transporter.verify();
//             console.log('✅ Gmail connection successful');
//             return true;
//         } catch (error) {
//             console.error('❌ Gmail connection failed:', error.message);
//             return false;
//         }
//     }


//     // Lease expiry warning email (10 days before)
//     async sendLeaseExpiryWarning(tenantDetails) {
//         const { name, email, roomNumber, leaseEndDate, daysRemaining } = tenantDetails;

//         const mailOptions = {
//             from: process.env.EMAIL_USER,
//             to: email,
//             subject: `Lease Expiry Notice - ${daysRemaining} Days Remaining ⏰`,
//             html: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
//                     <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
//                         <div style="text-align: center; margin-bottom: 30px;">
//                             <h1 style="color: #f59e0b; margin: 0; font-size: 24px;">Casamia Apartment</h1>
//                             <p style="color: #6b7280; margin: 10px 0 0 0;">Lease Expiry Notice</p>
//                         </div>
                        
//                         <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
//                             <h2 style="color: #1f2937; margin: 0 0 15px 0;">Dear ${name},</h2>
//                             <p style="color: #374151; line-height: 1.6; margin: 0;">
//                                 This is a friendly reminder that your lease agreement is expiring soon. 
//                                 Please review the details below and contact us if you wish to renew.
//                             </p>
//                         </div>

//                         <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                             <h3 style="color: #1f2937; margin: 0 0 15px 0;">⏰ Lease Information</h3>
//                             <table style="width: 100%; border-collapse: collapse;">
//                                 <tr>
//                                     <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Room Number:</td>
//                                     <td style="padding: 10px 0; color: #1f2937; font-weight: 600;">${roomNumber}</td>
//                                 </tr>
//                                 <tr>
//                                     <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Lease End Date:</td>
//                                     <td style="padding: 10px 0; color: #dc2626; font-weight: 600;">${new Date(leaseEndDate).toLocaleDateString()}</td>
//                                 </tr>
//                                 <tr>
//                                     <td style="padding: 10px 0; color: #6b7280; font-weight: 500;">Days Remaining:</td>
//                                     <td style="padding: 10px 0; color: #dc2626; font-weight: 700; font-size: 18px;">${daysRemaining} days</td>
//                                 </tr>
//                             </table>
//                         </div>

//                         <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
//                             <h3 style="color: #1f2937; margin: 0 0 15px 0;">📋 Next Steps</h3>
//                             <ul style="color: #374151; line-height: 1.8; margin: 0; padding-left: 20px;">
//                                 <li>Contact management to discuss lease renewal</li>
//                                 <li>Review new lease terms and conditions</li>
//                                 <li>Plan your move-out if not renewing</li>
//                             </ul>
//                         </div>

//                         <div style="text-align: center; margin-top: 30px;">
//                             <a href="#" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
//                                 Renew Lease
//                             </a>
//                             <a href="#" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
//                                 Contact Management
//                             </a>
//                         </div>

//                         <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
//                             <p style="color: #6b7280; margin: 0;">
//                                 📧 casamia.apartment.nepal@gmail.com | 📞 +977-9815378838
//                             </p>
//                         </div>
//                     </div>
//                 </div>
//             `
//         };

//         try {
//             await this.transporter.sendMail(mailOptions);
//             console.log(`Lease expiry warning sent to ${email}`);
//             return { success: true };
//         } catch (error) {
//             console.error('Error sending lease expiry warning:', error);
//             return { success: false, error: error.message };
//         }
//     }
// }

// module.exports = new EmailService();
