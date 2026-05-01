const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

exports.handler = async () => {
  const SK = process.env.STRIPE_SECRET_KEY || "";
  const configured = SK.length > 0;
  const mode = SK.startsWith("sk_live_") ? "live" : SK.startsWith("sk_test_") ? "test" : "not_set";

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      stripe_key_set: configured,
      stripe_mode: mode,
      prices: {
        per_report:   !!process.env.STRIPE_PRICE_PER_REPORT,
        subscription: !!process.env.STRIPE_PRICE_SUBSCRIPTION,
        enterprise:   !!process.env.STRIPE_PRICE_ENTERPRISE,
        consumer:     !!process.env.STRIPE_PRICE_CONSUMER,
        realtor_pro:  !!process.env.STRIPE_PRICE_REALTOR_PRO,
        investor:     !!process.env.STRIPE_PRICE_INVESTOR,
      },
    }),
  };
};
