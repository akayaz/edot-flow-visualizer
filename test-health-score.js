// Simple test to verify health score calculation
const { calculateHealthScore } = require('./app/otel-flow/lib/health-score');

const testContext = {
  nodes: [
    {
      id: '1',
      type: 'edotSDK',
      position: { x: 0, y: 0 },
      data: {
        componentType: 'edot-sdk',
        label: 'Test SDK',
        language: 'nodejs',
        serviceName: 'test-service',
        autoInstrumented: true,
      },
    },
  ],
  edges: [],
  deploymentModel: 'serverless',
  scenario: 'custom',
};

try {
  const score = calculateHealthScore(testContext);
  console.log('Health Score:', score.overall);
  console.log('Grade:', score.grade);
  console.log('Success!');
} catch (error) {
  console.error('Error:', error.message);
}
