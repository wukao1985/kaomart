'use client';

import { useState } from 'react';

interface Step {
  name: string;
  method: string;
  url: string;
  requestBody?: object;
  response?: object;
  error?: string;
}

export default function UCPDemo() {
  const [productName, setProductName] = useState('Nike Air Max');
  const [price, setPrice] = useState('129.99');
  const [buyerEmail, setBuyerEmail] = useState('agent@test.ai');
  const [buyerName, setBuyerName] = useState('Test Agent');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [complete, setComplete] = useState(false);
  const [orderId, setOrderId] = useState('');

  const addStep = (step: Step) => {
    setSteps((prev) => [...prev, step]);
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const runDemo = async () => {
    setRunning(true);
    setSteps([]);
    setComplete(false);
    setOrderId('');

    let sessionId = '';
    let currentOrderId = '';

    try {
      // Step 1: GET /.well-known/ucp
      const step1: Step = {
        name: 'Step 1: Discover UCP Profile',
        method: 'GET',
        url: '/.well-known/ucp',
      };
      addStep(step1);
      await sleep(500);

      const ucpResponse = await fetch('/.well-known/ucp');
      const ucpData = await ucpResponse.json();
      step1.response = ucpData;
      setSteps((prev) => [...prev.slice(0, -1), { ...step1 }]);
      await sleep(800);

      // Step 2: POST /api/ucp/checkout-sessions
      const checkoutBody = {
        line_items: [
          {
            item_id: 'test_001',
            title: productName,
            price: parseFloat(price),
            quantity: 1,
          },
        ],
        buyer: {
          email: buyerEmail,
          full_name: buyerName,
        },
        currency: 'USD',
      };

      const step2: Step = {
        name: 'Step 2: Create Checkout Session',
        method: 'POST',
        url: '/api/ucp/checkout-sessions',
        requestBody: checkoutBody,
      };
      addStep(step2);
      await sleep(500);

      const sessionResponse = await fetch('/api/ucp/checkout-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutBody),
      });
      const sessionData = await sessionResponse.json();
      step2.response = sessionData;
      sessionId = sessionData.id;
      setSteps((prev) => [...prev.slice(0, -1), { ...step2 }]);
      await sleep(800);

      // Step 3: POST /api/ucp/checkout-sessions/:id/complete
      const completeBody = {
        payment: {
          handler_id: 'stripe_mock',
        },
      };

      const step3: Step = {
        name: 'Step 3: Complete Checkout',
        method: 'POST',
        url: `/api/ucp/checkout-sessions/${sessionId}/complete`,
        requestBody: completeBody,
      };
      addStep(step3);
      await sleep(500);

      const completeResponse = await fetch(
        `/api/ucp/checkout-sessions/${sessionId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(completeBody),
        }
      );
      const completeData = await completeResponse.json();
      step3.response = completeData;
      currentOrderId = completeData.order_id;
      setOrderId(currentOrderId);
      setSteps((prev) => [...prev.slice(0, -1), { ...step3 }]);
      await sleep(800);

      // Step 4: GET /api/ucp/orders/:id
      const step4: Step = {
        name: 'Step 4: Verify Order',
        method: 'GET',
        url: `/api/ucp/orders/${currentOrderId}`,
      };
      addStep(step4);
      await sleep(500);

      const orderResponse = await fetch(`/api/ucp/orders/${currentOrderId}`);
      const orderData = await orderResponse.json();
      step4.response = orderData;
      setSteps((prev) => [...prev.slice(0, -1), { ...step4 }]);

      setComplete(true);
    } catch (error) {
      console.error('Demo error:', error);
      const errorStep: Step = {
        name: 'Error',
        method: '',
        url: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      addStep(errorStep);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            KaoMart UCP Demo
          </h1>
          <p className="text-gray-400 text-lg">
            AI Agent Checkout via Universal Commerce Protocol
          </p>
        </header>

        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">Purchase Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Product Name</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={running}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Price (USD)</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={running}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Buyer Email</label>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={running}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Buyer Name</label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={running}
              />
            </div>
          </div>
        </div>

        <div className="text-center mb-12">
          <button
            onClick={runDemo}
            disabled={running}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
          >
            {running ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Running Agent Checkout...
              </span>
            ) : (
              '▶ Run Agent Checkout'
            )}
          </button>
        </div>

        {steps.length > 0 && (
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-6 animate-fadeIn"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <h3 className="text-lg font-semibold mb-4 text-blue-400">
                  {step.name}
                </h3>

                {step.error ? (
                  <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
                    Error: {step.error}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4 text-sm">
                      <span className="bg-blue-600 px-2 py-1 rounded font-mono">
                        {step.method}
                      </span>
                      <code className="text-gray-300">{step.url}</code>
                    </div>

                    {step.requestBody && (
                      <div className="mb-4">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                          Request Body
                        </div>
                        <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
                          <code className="text-green-400">
                            {JSON.stringify(step.requestBody, null, 2)}
                          </code>
                        </pre>
                      </div>
                    )}

                    {step.response && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                          Response
                        </div>
                        <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
                          <code className="text-yellow-400">
                            {JSON.stringify(step.response, null, 2)}
                          </code>
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {complete && (
          <div className="mt-8 bg-green-900/50 border border-green-700 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">
              Purchase Complete!
            </h2>
            <p className="text-green-200">
              Order #{orderId}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
