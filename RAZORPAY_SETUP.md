# Razorpay Payment Integration Setup

## Environment Variables

Add the following environment variables to your `.env` file in the backend directory:

### Development (Test Mode)
```env
RAZORPAY_KEY_ID=rzp_test_Rf6U9gE0Gg02hy
RAZORPAY_KEY_SECRET=MRBNvgEEHpHDGBOFet2HZ1Bk
```

### Production (Live Mode)
```env
RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_LIVE_KEY_SECRET
```

## API Keys

### Test Keys (Development)
- **Key ID**: `rzp_test_Rf6U9gE0Gg02hy`
- **Key Secret**: `MRBNvgEEHpHDGBOFet2HZ1Bk`

### Production Keys (Live)
**⚠️ IMPORTANT**: You MUST replace test keys with live keys for production deployment.

To get your live keys:
1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Go to **Settings** → **API Keys**
3. Click **Generate Live Key** (if not already generated)
4. Copy the **Key ID** (starts with `rzp_live_`) and **Key Secret**
5. Update your `.env` file on the production server with these live keys

**Note**: 
- Test keys (starting with `rzp_test_`) only work in test mode and won't process real payments
- Live keys (starting with `rzp_live_`) process real payments and charge real money
- Never commit your `.env` file with live keys to version control

## Payment Flow

1. **Create Order**: User selects a plan → Backend creates Razorpay order
2. **Payment**: Razorpay checkout opens → User completes payment
3. **Verification**: Backend verifies payment signature
4. **Activation**: Subscription is activated and user gains access

## Pricing (in INR)

- **Individual Plan**:
  - Monthly: ₹1,660 (~$20 USD)
  - Annual: ₹17,928 (~$216 USD, ₹1,494/month)

- **Group Plan**:
  - Monthly: ₹1,660 per seat (~$20 USD)
  - Annual: ₹15,936 per seat (~$192 USD, ₹1,328/month)

## Testing

Use Razorpay test cards for testing:
- Success: `4111 1111 1111 1111`
- Failure: `4000 0000 0000 0002`

CVV: Any 3 digits
Expiry: Any future date

