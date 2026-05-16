import Stripe from 'stripe';

let _instance: Stripe | undefined;

function getInstance(): Stripe {
  if (!_instance) {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error('STRIPE_SECRET_KEY is required but not set');
    _instance = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  }
  return _instance;
}

export const stripe = {
  get webhooks(): Stripe['webhooks'] {
    return getInstance().webhooks;
  },
  get subscriptions(): Stripe['subscriptions'] {
    return getInstance().subscriptions;
  },
  get customers(): Stripe['customers'] {
    return getInstance().customers;
  },
  get checkout(): Stripe['checkout'] {
    return getInstance().checkout;
  },
  get billingPortal(): Stripe['billingPortal'] {
    return getInstance().billingPortal;
  },
};
