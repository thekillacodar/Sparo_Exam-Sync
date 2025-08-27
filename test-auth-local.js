#!/usr/bin/env node

/**
 * Local Authentication Testing Script
 * Run this to test the authentication system before deploying to Render
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testAuthLocally() {
  console.log('🧪 Testing ExamSync Authentication System Locally\n');
  console.log('📋 Make sure to start the backend first:');
  console.log('   cd backend && npm install && npm run init-db && npm run dev\n');

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing server health...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log(`   Status: ${healthResponse.status}`);
    console.log(`   Response: ${JSON.stringify(healthData, null, 2)}`);

    if (healthResponse.ok) {
      console.log('   ✅ Server is running\n');
    } else {
      console.log('   ❌ Server is not responding\n');
      console.log('   💡 Make sure to start the backend with: npm run dev\n');
      return;
    }

    // Test 2: Register new user
    console.log('2️⃣  Testing user registration...');
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testuser@example.com',
        password: 'testpassword123',
        firstName: 'Test',
        lastName: 'User',
        role: 'student'
      })
    });

    const registerData = await registerResponse.json();
    console.log(`   Status: ${registerResponse.status}`);
    console.log(`   Message: ${registerData.message || registerData.error}`);

    if (registerResponse.ok) {
      console.log('   ✅ User registration successful\n');
    } else {
      console.log('   ❌ User registration failed\n');
    }

    // Test 3: Login with demo credentials
    console.log('3️⃣  Testing login with demo credentials...');

    const demoCredentials = [
      { email: 'student@exam.com', password: 'demo123', role: 'student' },
      { email: 'admin@exam.com', password: 'demo123', role: 'admin' },
      { email: 'lecturer@exam.com', password: 'demo123', role: 'lecturer' }
    ];

    for (const creds of demoCredentials) {
      console.log(`   Testing ${creds.role} login...`);

      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: creds.email,
          password: creds.password
        })
      });

      const loginData = await loginResponse.json();
      console.log(`   Status: ${loginResponse.status}`);

      if (loginResponse.ok && loginData.token) {
        console.log(`   ✅ ${creds.role} login successful`);
        console.log(`   👤 User: ${loginData.user.firstName} ${loginData.user.lastName}`);
        console.log(`   🔒 Role: ${loginData.user.role}\n`);

        // Test protected route with this token
        const profileResponse = await fetch(`${BASE_URL}/api/profile`, {
          headers: { 'Authorization': `Bearer ${loginData.token}` }
        });

        if (profileResponse.ok) {
          console.log(`   ✅ Protected route access successful for ${creds.role}\n`);
        } else {
          console.log(`   ❌ Protected route access failed for ${creds.role}\n`);
        }

        // Test role-based access (admin route)
        if (creds.role === 'admin') {
          const adminResponse = await fetch(`${BASE_URL}/api/admin/stats`, {
            headers: { 'Authorization': `Bearer ${loginData.token}` }
          });

          if (adminResponse.ok) {
            console.log(`   ✅ Admin route access successful\n`);
          } else {
            console.log(`   ❌ Admin route access failed (Status: ${adminResponse.status})\n`);
          }
        }

      } else {
        console.log(`   ❌ ${creds.role} login failed: ${loginData.error}\n`);
      }
    }

    // Test 4: Test unauthenticated access
    console.log('4️⃣  Testing unauthenticated access...');
    const noAuthResponse = await fetch(`${BASE_URL}/api/profile`);
    console.log(`   Status: ${noAuthResponse.status}`);

    if (noAuthResponse.status === 401) {
      console.log('   ✅ Authentication required correctly enforced\n');
    } else {
      console.log('   ❌ Authentication not properly enforced\n');
    }

    // Test 5: Test invalid token
    console.log('5️⃣  Testing invalid token...');
    const invalidTokenResponse = await fetch(`${BASE_URL}/api/profile`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    console.log(`   Status: ${invalidTokenResponse.status}`);

    if (invalidTokenResponse.status === 401) {
      console.log('   ✅ Invalid token correctly rejected\n');
    } else {
      console.log('   ❌ Invalid token not properly rejected\n');
    }

    console.log('🎉 Local authentication testing completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. If all tests pass, you\'re ready to deploy to Render');
    console.log('   2. Follow the RENDER_DEPLOYMENT.md guide');
    console.log('   3. Push your code to GitHub');
    console.log('   4. Connect repository to Render');
    console.log('   5. Deploy and test on Render');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('\n❌ Cannot connect to server');
      console.log('💡 Make sure the backend is running:');
      console.log('   cd backend');
      console.log('   npm install');
      console.log('   npm run init-db');
      console.log('   npm run dev');
    } else {
      console.error('\n❌ Test failed:', error.message);
    }
  }
}

// Run the test
testAuthLocally();
