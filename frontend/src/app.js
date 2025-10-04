import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import './App.css';

function App() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('idle');
  const [qrCode, setQrCode] = useState('');
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);

  useEffect(() => {
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [statusCheckInterval]);

  const generatePairCode = async () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }

    try {
      setStatus('loading');
      setError('');
      
      const response = await axios.post('/api/generate-pair-code', {
        phoneNumber
      });
      
      if (response.data.success) {
        setPairCode(response.data.code);
        setSessionId(response.data.sessionId);
        setStatus('codeGenerated');
        
        // Start polling status
        const interval = setInterval(() => checkStatus(response.data.sessionId), 2000);
        setStatusCheckInterval(interval);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate pair code');
      setStatus('idle');
    }
  };

  const checkStatus = async (id) => {
    try {
      const response = await axios.get(`/api/check-status/${id}`);
      
      if (response.data.status === 'connected') {
        setStatus('connected');
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
      } else if (response.data.qr && showQR) {
        generateQRCode(response.data.qr);
      }
      
      if (response.data.status === 'failed') {
        setError('Connection failed. Please try again.');
        setStatus('idle');
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
        }
      }
    } catch (err) {
      console.error('Error checking status:', err);
    }
  };

  const generateQRCode = async (qrData) => {
    try {
      const qr = await QRCode.toDataURL(qrData);
      setQrCode(qr);
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  };

  const switchToQR = async () => {
    setShowQR(true);
    
    if (sessionId) {
      try {
        const response = await axios.get(`/api/get-qr/${sessionId}`);
        if (response.data.qr) {
          generateQRCode(response.data.qr);
        }
      } catch (err) {
        console.error('Error getting QR code:', err);
      }
    }
  };

  const switchToCode = () => {
    setShowQR(false);
  };

  const downloadCreds = async () => {
    try {
      const response = await axios.get(`/api/download-creds/${sessionId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'creds.json');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download credentials');
    }
  };

  const resetForm = () => {
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }
    setPhoneNumber('');
    setPairCode('');
    setSessionId('');
    setStatus('idle');
    setQrCode('');
    setError('');
    setShowQR(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="App">
      <div className="container">
        <div className="card">
          <div className="header">
            <div className="bot-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h1>Knight Bot</h1>
            <p>Link your WhatsApp device</p>
          </div>

          {status === 'idle' && (
            <div className="form-container">
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Enter your phone number (e.g. +1234567890)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              
              {error && <div className="error">{error}</div>}
              
              <div className="button-group">
                <button className="btn primary" onClick={generatePairCode}>
                  Generate Pair Code
                </button>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Generating pair code...</p>
            </div>
          )}

          {status === 'codeGenerated' && (
            <div className="code-container">
              <div className="tabs">
                <button 
                  className={`tab ${!showQR ? 'active' : ''}`}
                  onClick={switchToCode}
                >
                  Pair Code
                </button>
                <button 
                  className={`tab ${showQR ? 'active' : ''}`}
                  onClick={switchToQR}
                >
                  QR Code
                </button>
              </div>
              
              {!showQR ? (
                <div className="pair-code">
                  <p>Enter this code in your WhatsApp:</p>
                  <div className="code-display">{pairCode}</div>
                  <button 
                    className="btn secondary"
                    onClick={() => copyToClipboard(pairCode)}
                  >
                    Copy Code
                  </button>
                </div>
              ) : (
                <div className="qr-code">
                  <p>Scan this QR code with WhatsApp:</p>
                  {qrCode ? (
                    <div className="qr-container">
                      <img src={qrCode} alt="QR Code" />
                    </div>
                  ) : (
                    <div className="loading-container">
                      <div className="spinner"></div>
                      <p>Generating QR code...</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="status-info">
                <p>Waiting for WhatsApp connection...</p>
              </div>
            </div>
          )}

          {status === 'connected' && (
            <div className="success-container">
              <div className="success-icon">✓</div>
              <h2>Successfully Connected!</h2>
              <p>Your WhatsApp is now linked. Download your credentials file below.</p>
              
              <button className="btn primary" onClick={downloadCreds}>
                Download creds.json
              </button>
              
              <button className="btn secondary" onClick={resetForm}>
                Generate New Credentials
              </button>
            </div>
          )}
        </div>
        
        <div className="footer">
          <p>&copy; {new Date().getFullYear()} Knight Bot Pairing Service</p>
        </div>
      </div>
    </div>
  );
}

export default App;