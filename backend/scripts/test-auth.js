import fetch from 'node-fetch';
import { config } from '../config/environment.js';

const BASE_URL = `http://localhost:${config.PORT}`;

async function testAuthentication() {
  console.log('🧪 Testing Authentication System...\n');

  try {
    // Test 1: Register a new user
    console.log('1️⃣  Testing User Registration...');
    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123',
        firstName: 'Test',
        lastName: 'User',
        role: 'student'
      })
    });

    const registerData = await registerResponse.json();
    console.log(`   Status: ${registerResponse.status}`);
    console.log(`   Response: ${JSON.stringify(registerData, null, 2)}`);

    if (registerResponse.ok) {
      console.log('   ✅ Registration successful\n');
    } else {
      console.log('   ❌ Registration failed\n');
    }

    // Test 2: Login with demo credentials
    console.log('2️⃣  Testing Login with Demo Credentials...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'student@exam.com',
        password: 'demo123'
      })
    });

    const loginData = await loginResponse.json();
    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Response: ${JSON.stringify(loginData, null, 2)}`);

    if (loginResponse.ok && loginData.token) {
      console.log('   ✅ Login successful\n');
      const token = loginData.token;

      // Test 3: Access protected route
      console.log('3️⃣  Testing Protected Route Access...');
      const profileResponse = await fetch(`${BASE_URL}/api/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const profileData = await profileResponse.json();
      console.log(`   Status: ${profileResponse.status}`);
      console.log(`   Response: ${JSON.stringify(profileData, null, 2)}`);

      if (profileResponse.ok) {
        console.log('   ✅ Protected route access successful\n');
      } else {
        console.log('   ❌ Protected route access failed\n');
      }

      // Test 4: Test role-based access (should fail for student)
      console.log('4️⃣  Testing Role-Based Access (Student trying admin route)...');
      const adminResponse = await fetch(`${BASE_URL}/api/admin/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const adminData = await adminResponse.json();
      console.log(`   Status: ${adminResponse.status}`);
      console.log(`   Response: ${JSON.stringify(adminData, null, 2)}`);

      if (adminResponse.status === 403) {
        console.log('   ✅ Role-based access control working (student blocked from admin route)\n');
      } else {
        console.log('   ❌ Role-based access control failed\n');
      }

    } else {
      console.log('   ❌ Login failed\n');
    }

    // Test 5: Login with admin credentials
    console.log('5️⃣  Testing Admin Login...');
    const adminLoginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@exam.com',
        password: 'demo123'
      })
    });

    const adminLoginData = await adminLoginResponse.json();
    console.log(`   Status: ${adminLoginResponse.status}`);

    if (adminLoginResponse.ok && adminLoginData.token) {
      console.log('   ✅ Admin login successful\n');
      const adminToken = adminLoginData.token;

      // Test admin route access
      console.log('6️⃣  Testing Admin Route Access...');
      const adminStatsResponse = await fetch(`${BASE_URL}/api/admin/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        }
      });

      const adminStatsData = await adminStatsResponse.json();
      console.log(`   Status: ${adminStatsResponse.status}`);
      console.log(`   Response: ${JSON.stringify(adminStatsData, null, 2)}`);

      if (adminStatsResponse.ok) {
        console.log('   ✅ Admin route access successful\n');
      } else {
        console.log('   ❌ Admin route access failed\n');
      }
    }

    console.log('🎉 Authentication testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAuthentication();
}

export { testAuthentication };
