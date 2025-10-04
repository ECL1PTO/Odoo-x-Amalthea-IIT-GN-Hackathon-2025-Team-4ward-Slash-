# 📱 React Native Frontend Integration Guide

## 🎯 Complete Guide to Connect React Native App with Express Backend

---

## ⚠️ **CRITICAL: React Native Can't Use `localhost`!**

React Native apps run on a **physical device or emulator**, NOT in a browser. They need your computer's **actual IP address**.

---

## 🚀 **Step-by-Step Integration**

### **Step 1: Find Your Computer's IP Address**

#### **On macOS:**
```bash
# Quick way
ipconfig getifaddr en0

# Or detailed way
ifconfig | grep "inet " | grep -v 127.0.0.1
```

#### **On Windows:**
```bash
ipconfig
# Look for "IPv4 Address" under your active network
```

**Example IP:** `192.168.1.100` or `10.0.0.5`

**⚠️ IMPORTANT:** Save this IP! You'll use it everywhere.

---

### **Step 2: Backend is Already Configured! ✅**

I've already updated your backend to accept React Native connections:
- CORS enabled for all origins
- Accepts connections from any IP
- Server running on port **5001**

**Your backend URL:**
```
http://YOUR_IP_ADDRESS:5001/api
```

**Example:**
```
http://192.168.1.100:5001/api
```

---

### **Step 3: Update React Native API Configuration**

Tell your friend to update the API base URL in their React Native app.

#### **Option 1: Environment Variables (Recommended)**

Create or update `.env` file in React Native project root:

```env
# .env
API_BASE_URL=http://192.168.1.100:5001/api
```

**⚠️ Replace `192.168.1.100` with YOUR actual IP!**

Then in the code:
```javascript
import { API_BASE_URL } from '@env';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

#### **Option 2: Direct in Config File**

Create `src/config/api.js`:

```javascript
// src/config/api.js
export const API_BASE_URL = 'http://192.168.1.100:5001/api';

// ⚠️ CHANGE THIS IP TO YOUR COMPUTER'S IP!
```

---

### **Step 4: Create API Service for React Native**

Your friend should create this file:

**File: `src/services/api.js`**

```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ CHANGE THIS IP TO YOUR COMPUTER'S IP!
const API_BASE_URL = 'http://192.168.1.100:5001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      // Navigate to login screen
      // navigation.navigate('Login'); // Your friend should add navigation
    }
    return Promise.reject(error);
  }
);

// ========================================
// AUTH API CALLS
// ========================================

export const authAPI = {
  // Register company + admin
  register: async (data) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  // Login
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  // Get profile
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
};

// ========================================
// EXPENSE API CALLS
// ========================================

export const expenseAPI = {
  // Submit expense with file
  submitExpense: async (expenseData, receiptFile) => {
    const formData = new FormData();
    
    // Add expense data
    formData.append('amount', expenseData.amount);
    formData.append('currency', expenseData.currency);
    formData.append('category', expenseData.category);
    formData.append('description', expenseData.description);
    formData.append('date', expenseData.date);
    
    // Add receipt file if exists
    if (receiptFile) {
      formData.append('receipt', {
        uri: receiptFile.uri,
        type: receiptFile.type || 'image/jpeg',
        name: receiptFile.name || 'receipt.jpg',
      });
    }

    const response = await api.post('/expenses', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Get my expenses
  getMyExpenses: async () => {
    const response = await api.get('/expenses/my');
    return response.data;
  },

  // Get expense by ID
  getExpenseById: async (id) => {
    const response = await api.get(`/expenses/${id}`);
    return response.data;
  },

  // Get all expenses (with filters)
  getAllExpenses: async (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    const response = await api.get(`/expenses?${params}`);
    return response.data;
  },
};

// ========================================
// APPROVAL API CALLS
// ========================================

export const approvalAPI = {
  // Get pending approvals
  getPendingApprovals: async () => {
    const response = await api.get('/approvals/pending');
    return response.data;
  },

  // Approve expense
  approveExpense: async (approvalId, comments) => {
    const response = await api.post(`/approvals/${approvalId}/approve`, {
      comments,
    });
    return response.data;
  },

  // Reject expense
  rejectExpense: async (approvalId, comments) => {
    const response = await api.post(`/approvals/${approvalId}/reject`, {
      comments,
    });
    return response.data;
  },

  // Get approval history
  getApprovalHistory: async (expenseId) => {
    const response = await api.get(`/approvals/expense/${expenseId}`);
    return response.data;
  },
};

// ========================================
// USER API CALLS
// ========================================

export const userAPI = {
  // Create user
  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  // Get all users
  getAllUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  // Update user
  updateUser: async (userId, userData) => {
    const response = await api.put(`/users/${userId}`, userData);
    return response.data;
  },
};

// ========================================
// CONFIG API CALLS (Admin only)
// ========================================

export const configAPI = {
  // Add approver
  addApprover: async (data) => {
    const response = await api.post('/config/approvers', data);
    return response.data;
  },

  // Get approvers
  getApprovers: async () => {
    const response = await api.get('/config/approvers');
    return response.data;
  },

  // Set approval rule
  setApprovalRule: async (ruleData) => {
    const response = await api.post('/config/rules', ruleData);
    return response.data;
  },

  // Get approval rules
  getApprovalRules: async () => {
    const response = await api.get('/config/rules');
    return response.data;
  },
};

export default api;
```

---

### **Step 5: Install Required Dependencies**

Your friend needs to install these packages:

```bash
# Navigate to React Native project
cd your-react-native-app

# Install axios for API calls
npm install axios

# Install AsyncStorage for token storage
npm install @react-native-async-storage/async-storage

# For environment variables (optional)
npm install react-native-dotenv
```

---

### **Step 6: Usage Examples in React Native**

#### **Example 1: Login Screen**

```javascript
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from './services/api';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      
      // Call login API
      const response = await authAPI.login(email, password);
      
      // Save token and user data
      await AsyncStorage.setItem('token', response.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.user));
      
      // Navigate to home
      navigation.navigate('Home');
      
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title={loading ? 'Loading...' : 'Login'}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
};

export default LoginScreen;
```

#### **Example 2: Submit Expense**

```javascript
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { expenseAPI } from './services/api';

const SubmitExpenseScreen = ({ navigation }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Travel');
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setReceipt(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const expenseData = {
        amount: parseFloat(amount),
        currency: 'USD',
        category,
        description,
        date: new Date().toISOString().split('T')[0],
      };

      const response = await expenseAPI.submitExpense(expenseData, receipt);
      
      Alert.alert('Success', 'Expense submitted successfully!');
      navigation.goBack();
      
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to submit expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      <TextInput
        placeholder="Category"
        value={category}
        onChangeText={setCategory}
      />
      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Button title="Pick Receipt Image" onPress={pickImage} />
      <Button
        title={loading ? 'Submitting...' : 'Submit Expense'}
        onPress={handleSubmit}
        disabled={loading}
      />
    </View>
  );
};

export default SubmitExpenseScreen;
```

#### **Example 3: Get My Expenses**

```javascript
import React, { useState, useEffect } from 'react';
import { View, FlatList, Text, ActivityIndicator } from 'react-native';
import { expenseAPI } from './services/api';

const MyExpensesScreen = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await expenseAPI.getMyExpenses();
      setExpenses(response.expenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <FlatList
      data={expenses}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderBottomWidth: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            ${item.amount} - {item.category}
          </Text>
          <Text>{item.description}</Text>
          <Text>Status: {item.status}</Text>
          <Text>Date: {item.date}</Text>
        </View>
      )}
    />
  );
};

export default MyExpensesScreen;
```

---

## 🧪 **Testing the Connection**

### **Step 1: Make Sure Backend is Running**

```bash
# In backend folder
npm run dev

# Should show:
# ✅ Database connected successfully
# 🚀 Server running on port 5001
```

### **Step 2: Test from React Native**

Your friend can test the connection with a simple fetch:

```javascript
// Test connection
const testConnection = async () => {
  try {
    const response = await fetch('http://192.168.1.100:5001/health');
    const data = await response.json();
    console.log('Backend connected:', data);
    // Should show: { status: "OK", timestamp: "...", environment: "development" }
  } catch (error) {
    console.error('Connection failed:', error);
  }
};
```

---

## 🔧 **Troubleshooting**

### **Issue 1: "Network request failed"**

**Causes:**
- Wrong IP address
- Backend not running
- Phone/emulator not on same network

**Fix:**
```bash
# 1. Verify backend is running
npm run dev

# 2. Check your IP again
ipconfig getifaddr en0

# 3. Make sure phone is on same WiFi as computer
```

### **Issue 2: "Connection timeout"**

**Causes:**
- Firewall blocking connections
- Wrong port

**Fix:**
```bash
# Allow port 5001 through firewall (macOS)
# System Preferences → Security & Privacy → Firewall → Firewall Options
# Add Node.js to allowed apps
```

### **Issue 3: Android Emulator Can't Connect**

**For Android Emulator, use:**
```javascript
const API_BASE_URL = 'http://10.0.2.2:5001/api';
// 10.0.2.2 is the special IP for Android emulator to reach host machine
```

### **Issue 4: iOS Simulator Can't Connect**

**For iOS Simulator, use:**
```javascript
const API_BASE_URL = 'http://localhost:5001/api';
// iOS simulator CAN use localhost
```

---

## 📱 **Platform-Specific Configuration**

```javascript
import { Platform } from 'react-native';

const getApiUrl = () => {
  if (Platform.OS === 'android') {
    // Android emulator
    if (__DEV__) {
      return 'http://10.0.2.2:5001/api';
    }
  }
  
  if (Platform.OS === 'ios') {
    // iOS simulator
    if (__DEV__) {
      return 'http://localhost:5001/api';
    }
  }
  
  // Physical devices - use your computer's IP
  return 'http://192.168.1.100:5001/api';
};

export const API_BASE_URL = getApiUrl();
```

---

## ✅ **Integration Checklist**

Tell your friend to:

- [ ] Get your computer's IP address
- [ ] Update API_BASE_URL in their React Native code
- [ ] Install axios and AsyncStorage
- [ ] Copy the API service file
- [ ] Test connection with health endpoint
- [ ] Implement login screen
- [ ] Test authentication
- [ ] Implement expense submission
- [ ] Test file upload
- [ ] Implement expense list
- [ ] Test all features

---

## 🎯 **Quick Start for Your Friend**

**1. Get IP Address (You do this):**
```bash
ipconfig getifaddr en0
# Example output: 192.168.1.100
```

**2. Share with Friend:**
```
Backend URL: http://192.168.1.100:5001/api
Health Check: http://192.168.1.100:5001/health
```

**3. Friend Updates Their Code:**
```javascript
const API_BASE_URL = 'http://192.168.1.100:5001/api';
```

**4. Test:**
```javascript
fetch('http://192.168.1.100:5001/health')
  .then(res => res.json())
  .then(data => console.log('Connected!', data));
```

---

## 📚 **API Documentation for Your Friend**

Share these files with your friend:
- `API_QUICK_REFERENCE.md` - Complete API documentation
- `REACT_NATIVE_INTEGRATION.md` - This file
- `Expense_Management_API.postman_collection.json` - For testing

---

## 🎉 **Summary**

**Backend (You):**
- ✅ CORS enabled for React Native
- ✅ Server running on port 5001
- ✅ All endpoints ready

**Frontend (Your Friend):**
- Update API_BASE_URL with your IP
- Install axios and AsyncStorage
- Use the API service file provided
- Test connection
- Build the UI!

---

**Your backend is ready for React Native! Just share your IP address and this guide with your friend!** 🚀📱
