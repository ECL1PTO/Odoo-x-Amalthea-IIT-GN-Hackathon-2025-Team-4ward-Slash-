import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
// Make sure you have a CSS file for styling
// import './Login.css'; 

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', companyName: '' });
  const [errors, setErrors] = useState({});
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // In a real app, you'd call your backend here.
    // For now, we'll simulate a successful login.
    console.log("Form submitted", formData);

    // MOCK LOGIN: Determine role based on email for testing
    let role = 'employee'; // default
    if (formData.email.includes('manager')) role = 'manager';
    if (formData.email.includes('admin')) role = 'admin';
    
    const mockUserData = {
      email: formData.email,
      role: role,
      token: 'fake-jwt-token' // Simulate a token
    };

    login(mockUserData); // Update auth context
    
    // Navigate to the correct dashboard
    navigate(`/${role}/dashboard`);
  };

  const switchAuthMode = () => setIsLogin(prev => !prev);

  return (
    <div className="auth-container">
      <h1>LOGIN PAGE TEST</h1>
      <div className="auth-card">
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Company Name</label>
              <input type="text" name="companyName" onChange={handleChange} required />
            </div>
          )}
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" name="email" onChange={handleChange} required />
            {/* For testing, you can use: admin@test.com, manager@test.com, employee@test.com */}
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" name="password" onChange={handleChange} required />
          </div>
          <button type="submit" className="submit-btn">{isLogin ? 'Login' : 'Create Account'}</button>
        </form>
        <div className="switch-auth">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button onClick={switchAuthMode} className="switch-btn">
              {isLogin ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;