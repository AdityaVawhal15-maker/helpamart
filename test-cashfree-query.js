#!/usr/bin/env node

/**
 * TEST SCRIPT: Query Cashfree directly for existing orders
 * This helps diagnose why payments aren't being found
 * 
 * Usage:
 *   CASHFREE_APP_ID=xxx CASHFREE_SECRET_KEY=yyy node test-cashfree-query.js
 */

const orderIds = [
  'BOOK-A185BCD1-1791560103932',
  'BOOK-DC067700-1791556844233',
  'BOOK-FE23307C-1791555302505',
];

async function queryOrder(orderId) {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    console.error('❌ CASHFREE_APP_ID or CASHFREE_SECRET_KEY not set');
    process.exit(1);
  }

  console.log(`\n📋 Querying order: ${orderId}`);
  console.log('─'.repeat(60));

  // Get Order
  try {
    const orderUrl = `https://api.cashfree.com/pg/orders/${orderId}`;
    console.log(`🔍 GET ${orderUrl}`);
    
    const orderRes = await fetch(orderUrl, {
      method: 'GET',
      headers: {
        'x-api-version': '2025-01-01',
        'x-client-id': appId,
        'x-client-secret': secretKey,
      },
    });

    const orderData = await orderRes.json();
    console.log(`\n✅ GET Order Response (HTTP ${orderRes.status}):`);
    console.log(JSON.stringify(orderData, null, 2));

    if (!orderRes.ok) {
      console.warn('⚠️  Order not found or error occurred');
      return;
    }

    // Get Payments for Order
    const paymentsUrl = `https://api.cashfree.com/pg/orders/${orderId}/payments`;
    console.log(`\n🔍 GET ${paymentsUrl}`);
    
    const paymentsRes = await fetch(paymentsUrl, {
      method: 'GET',
      headers: {
        'x-api-version': '2025-01-01',
        'x-client-id': appId,
        'x-client-secret': secretKey,
      },
    });

    const paymentsData = await paymentsRes.json();
    console.log(`\n✅ GET Payments Response (HTTP ${paymentsRes.status}):`);
    console.log(JSON.stringify(paymentsData, null, 2));

    if (paymentsData.payments && paymentsData.payments.length > 0) {
      console.log(`\n📊 Found ${paymentsData.payments.length} payment attempt(s):`);
      paymentsData.payments.forEach((p, i) => {
        console.log(`\n   Payment ${i + 1}:`);
        console.log(`   - Payment ID: ${p.cf_payment_id}`);
        console.log(`   - Status: ${p.payment_status}`);
        console.log(`   - Amount: ${p.payment_amount} ${p.payment_currency}`);
        console.log(`   - Method: ${p.payment_method}`);
        console.log(`   - Timestamp: ${p.payment_time}`);
      });
    } else {
      console.log('\n⚠️  No payment attempts found for this order');
    }
  } catch (error) {
    console.error(`\n❌ Error querying order: ${error.message}`);
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('CASHFREE PRODUCTION ORDER DIAGNOSTIC');
  console.log('═'.repeat(60));

  for (const orderId of orderIds) {
    await queryOrder(orderId);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Diagnostic complete');
}

main().catch(console.error);
