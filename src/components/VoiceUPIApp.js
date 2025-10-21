import React, { useState, useEffect, useRef, useCallback } from 'react';
import './VoiceUPIApp.css';

const VoiceUPIApp = () => {
  // Tab state: 0=Home, 1=SelectContact, 2=Amount, 3=Confirm, 4=Processing, 5=Success, 6=History
  const [currentTab, setCurrentTab] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [currentTransaction, setCurrentTransaction] = useState({
    recipient: '',
    amount: '',
    upiId: '',
    note: ''
  });
  const [status, setStatus] = useState('');
  
  // Predefined contacts
  const [contacts] = useState([
    { id: 1, name: 'Ram', upiId: 'ram@paytm' },
    { id: 2, name: 'John', upiId: 'john@phonepe' },
    { id: 3, name: 'Sarah', upiId: 'sarah@okaxis' },
    { id: 4, name: 'Mike', upiId: 'mike@paytm' },
    { id: 5, name: 'Priya', upiId: 'priya@googlepay' },
    { id: 6, name: 'Amit', upiId: 'amit@paytm' },
    { id: 7, name: 'Lisa', upiId: 'lisa@phonepe' },
    { id: 8, name: 'Raj', upiId: 'raj@bhim' },
    { id: 9, name: 'Emma', upiId: 'emma@okaxis' },
    { id: 10, name: 'David', upiId: 'david@paytm' }
  ]);
  
  const recognitionRef = useRef(null);
  const currentTabRef = useRef(currentTab);
  const synthRef = useRef(window.speechSynthesis);
  const isSpeakingRef = useRef(false);
  const suppressAutoRestartRef = useRef(false);
  const currentTransactionRef = useRef(currentTransaction);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentTransactionRef.current = currentTransaction;
  }, [currentTransaction]);

  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);
  
  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-IN';
      recognitionRef.current.maxAlternatives = 1;

      console.log('✅ Speech Recognition initialized successfully');

      recognitionRef.current.onstart = () => {
        console.log('🎤 Voice recognition started');
        setStatus('🎤 Listening... Speak now!');
      };

      recognitionRef.current.onresult = (event) => {
        // Ignore our own TTS guidance phrases if they slip through
        const ignorePhrases = [
          'i am ready',
          'please state your payment command',
          'you can say a payment command',
          'sorry i did not understand',
          'microphone access',
          'transaction cancelled',
          'who do you want to pay',
          'recipient name',
          'how much do you want to pay',
          'what is the u p i i d',
          'review the details and say confirm',
          'say initiate payment',
          'please select a contact',
          'how much would you like to pay',
        ];
        
        if (isSpeakingRef.current) {
          console.log('🔇 Ignoring transcript while speaking');
          return;
        }
        console.log('📢 Got speech result:', event);
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          console.log(`Result ${i}: "${transcript}" (final: ${event.results[i].isFinal})`);
          
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const cleanedTranscript = finalTranscript.trim();
          const cleanedLower = cleanedTranscript.toLowerCase();
          if (ignorePhrases.some(p => cleanedLower.includes(p))) {
            console.log('🧽 Ignored self-spoken phrase:', cleanedTranscript);
            return;
          }
          console.log('✅ Final transcript:', cleanedTranscript);
          setTranscript(cleanedTranscript);
          setStatus('🔄 Processing command...');
          
          // Small delay to show processing
          setTimeout(() => {
            processVoiceCommand(cleanedTranscript);
          }, 300);
        } else {
          setTranscript(interimTranscript + '...');
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error, event);
        
        if (event.error === 'no-speech') {
          setStatus('⚠ No speech detected. Try speaking louder.');
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setStatus('❌ Microphone access denied. Please enable it in browser settings.');
          setIsListening(false);
          alert('Please allow microphone access in your browser settings.');
        } else if (event.error === 'network') {
          setStatus('❌ Network error. Check your internet connection.');
        } else {
          setStatus(`❌ Error: ${event.error}`);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🛑 Voice recognition ended, isListening:', isListening, 'suppress:', suppressAutoRestartRef.current);
        if (suppressAutoRestartRef.current) {
          console.log('⏸ Auto-restart suppressed during TTS');
          return;
        }
        if (isListening) {
          try {
            console.log('🔄 Restarting recognition...');
            recognitionRef.current.start();
          } catch (error) {
            console.error('Error restarting recognition:', error);
            setIsListening(false);
            setStatus('❌ Recognition stopped. Click button to restart.');
          }
        }
      };
      
      setStatus('✅ Ready! Click the button to start voice commands.');
    } else {
      console.error('❌ Speech recognition NOT supported');
      setStatus('❌ Speech recognition not supported. Please use Chrome or Edge browser.');
      alert('Voice recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const speak = (text) => {
    // Pause recognition while speaking to avoid self-capture
    if (recognitionRef.current && isListening) {
      try {
        suppressAutoRestartRef.current = true;
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Could not stop recognition before speaking:', e);
      }
    }
    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    isSpeakingRef.current = true;
    
    utterance.onend = () => {
      console.log('Speech finished');
      isSpeakingRef.current = false;
      // Resume recognition after TTS completes, if we were listening
      if (recognitionRef.current) {
        setTimeout(() => {
          try {
            suppressAutoRestartRef.current = false;
            if (isListening) {
              recognitionRef.current.start();
            }
          } catch (e) {
            console.error('Failed to restart recognition after speaking:', e);
          }
        }, 150);
      }
    };
    
    utterance.onerror = (event) => {
      console.error('Speech error:', event);
      isSpeakingRef.current = false;
    };
    
    synthRef.current.speak(utterance);
  };

  const cancelTransaction = useCallback(() => {
    setCurrentTransaction({
      recipient: '',
      amount: '',
      upiId: '',
      note: ''
    });
    setCurrentTab(0);
    setStatus('❌ Transaction cancelled');
    speak('Transaction cancelled. Returning to home.');
  }, []);

  const processVoiceCommand = useCallback((command) => {
    const lowerCommand = command.toLowerCase().trim();
    console.log('Processing command:', lowerCommand, 'Tab:', currentTabRef.current);
    
    let commandRecognized = false;
    const tab = currentTabRef.current;
    
    // Global: Show transaction history
    if (/\b(show|view|display)\s+(transaction\s+)?(history|transactions)\b/i.test(lowerCommand)) {
      commandRecognized = true;
      setCurrentTab(6);
      const count = transactions.length;
      speak(`Showing ${count} transaction${count !== 1 ? 's' : ''}`);
      setStatus(`📜 Transaction History (${count} items)`);
      return;
    }
    
    // Global: Cancel
    if (/\b(cancel|stop|abort|go back|home)\b/i.test(lowerCommand)) {
      commandRecognized = true;
      cancelTransaction();
      return;
    }
    
    // Tab 0: Home - Initiate Payment
    if (tab === 0) {
      if (/\b(initiate|start|begin|make)\s+(payment|pay)/i.test(lowerCommand)) {
        commandRecognized = true;
        setCurrentTab(1);
        setStatus('👥 Select Contact');
        speak('Please select a contact by saying their name.');
        return;
      }
    }
    
    // Tab 1: Select Contact
    if (tab === 1) {
      for (const contact of contacts) {
        if (lowerCommand.includes(contact.name.toLowerCase())) {
          commandRecognized = true;
          setCurrentTransaction(prev => ({
            ...prev,
            recipient: contact.name,
            upiId: contact.upiId
          }));
          setCurrentTab(2);
          setStatus(`💰 Enter Amount for ${contact.name}`);
          speak(`How much would you like to pay ${contact.name}?`);
          return;
        }
      }
    }
    
    // Tab 2: Enter Amount
    if (tab === 2) {
      const amountMatch = lowerCommand.match(/(\d{1,7})(?:\s*rupees?|\s*rs)?/i);
      if (amountMatch) {
        commandRecognized = true;
        const amount = amountMatch[1];
        setCurrentTransaction(prev => ({ ...prev, amount }));
        setCurrentTab(3);
        setStatus('🔍 Confirm Payment');
        const ct = { ...currentTransactionRef.current, amount };
        speak(`Confirm payment of ${amount} rupees to ${ct.recipient} at ${ct.upiId}. Say approve to proceed.`);
        return;
      }
    }
    
    // Tab 3: Confirm
    if (tab === 3) {
      if (/\b(approve|confirm|yes|proceed)\b/i.test(lowerCommand)) {
        commandRecognized = true;
        setCurrentTab(4);
        setStatus('⏳ Processing Payment...');
        speak('Processing your payment. Please wait.');
        
        // Simulate payment processing
        setTimeout(() => {
          const ct = currentTransactionRef.current;
          const newTransaction = {
            ...ct,
            id: Date.now(),
            timestamp: new Date().toLocaleString(),
            status: 'Success'
          };
          setTransactions(prev => [newTransaction, ...prev]);
          setCurrentTab(5);
          setStatus('✅ Payment Successful!');
          speak(`Payment successful! ${ct.amount} rupees sent to ${ct.recipient}.`);
          
          // Auto-return to home after 3 seconds
          setTimeout(() => {
            setCurrentTransaction({
              recipient: '',
              amount: '',
              upiId: '',
              note: ''
            });
            setCurrentTab(0);
            setStatus('');
          }, 3000);
        }, 2000);
        return;
      }
    }
    
    if (!commandRecognized) {
      setStatus(`❓ Command not recognized. Try again.`);
      speak('Sorry, I did not understand that command.');
    }
  }, [cancelTransaction, contacts, transactions]);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      setStatus('⏸ Stopped listening');
      setTranscript('');
      speak('Voice command stopped');
    } else {
      if (!recognitionRef.current) {
        setStatus('❌ Voice recognition not initialized. Please refresh the page.');
        alert('Voice recognition not supported. Please use Chrome or Edge browser.');
        return;
      }
      
      setTranscript('');
      setStatus('🎤 Starting...');

      try {
        recognitionRef.current.start();
        setIsListening(true);
        setTimeout(() => {
          const tab = currentTabRef.current;
          if (tab === 0) {
            setStatus('🏠 Say "Initiate Payment"');
            speak('Say initiate payment to begin.');
          } else if (tab === 1) {
            setStatus('👥 Select a contact');
            speak('Please say the name of the contact.');
          } else if (tab === 2) {
            setStatus('💰 Enter amount');
            speak('How much would you like to pay?');
          } else if (tab === 3) {
            setStatus('🔍 Review and approve');
            speak('Say approve to confirm the payment.');
          } else if (tab === 6) {
            setStatus('📜 Transaction History');
            speak('Showing transaction history.');
          }
        }, 500);
      } catch (error) {
        console.error('Error starting recognition:', error);
        setStatus('❌ Could not start voice recognition. Error: ' + error.message);
        alert('Microphone error. Please allow microphone access and try again.');
      }
    }
  };

  // Render tab content
  const renderTabContent = () => {
    switch (currentTab) {
      case 0: // Home
        return (
          <div className="tab-content home-tab">
            <div className="welcome-card">
              <h2>🏠 Welcome to Voice UPI</h2>
              <p className="instruction">Say <strong>"Initiate Payment"</strong> to begin</p>
              <div className="quick-actions">
                <button className="action-btn" onClick={() => { setCurrentTab(1); speak('Select a contact'); }}>
                  💳 New Payment
                </button>
                <button className="action-btn" onClick={() => { setCurrentTab(6); speak('Showing transaction history'); }}>
                  📜 Transaction History
                </button>
              </div>
            </div>
          </div>
        );
      
      case 1: // Select Contact
        return (
          <div className="tab-content contacts-tab">
            <h2>👥 Select Contact</h2>
            <p className="instruction">Say the name of the contact you want to pay</p>
            <div className="contacts-grid">
              {contacts.map(contact => (
                <div 
                  key={contact.id} 
                  className="contact-card"
                  onClick={() => {
                    setCurrentTransaction(prev => ({
                      ...prev,
                      recipient: contact.name,
                      upiId: contact.upiId
                    }));
                    setCurrentTab(2);
                    speak(`How much would you like to pay ${contact.name}?`);
                  }}
                >
                  <div className="avatar">{contact.name.charAt(0)}</div>
                  <div className="contact-info">
                    <div className="contact-name">{contact.name}</div>
                    <div className="contact-upi">{contact.upiId}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 2: // Enter Amount
        return (
          <div className="tab-content amount-tab">
            <h2>💰 Enter Amount</h2>
            <p className="instruction">Paying to <strong>{currentTransaction.recipient}</strong></p>
            <p className="sub-instruction">Say the amount in rupees</p>
            <div className="amount-display">
              <span className="currency">₹</span>
              <input 
                type="number" 
                className="amount-input"
                value={currentTransaction.amount}
                onChange={(e) => setCurrentTransaction(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="quick-amounts">
              {[100, 500, 1000, 2000, 5000].map(amt => (
                <button 
                  key={amt}
                  className="quick-amt-btn"
                  onClick={() => {
                    setCurrentTransaction(prev => ({ ...prev, amount: amt.toString() }));
                    setCurrentTab(3);
                    speak(`Confirm payment of ${amt} rupees to ${currentTransaction.recipient}.`);
                  }}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>
        );
      
      case 3: // Confirm
        return (
          <div className="tab-content confirm-tab">
            <h2>🔍 Confirm Payment</h2>
            <div className="payment-summary">
              <div className="summary-row">
                <span className="label">To:</span>
                <span className="value">{currentTransaction.recipient}</span>
              </div>
              <div className="summary-row">
                <span className="label">UPI ID:</span>
                <span className="value">{currentTransaction.upiId}</span>
              </div>
              <div className="summary-row amount-row">
                <span className="label">Amount:</span>
                <span className="value">₹{currentTransaction.amount}</span>
              </div>
            </div>
            <p className="instruction">Say <strong>"Approve"</strong> to confirm</p>
            <div className="action-buttons">
              <button className="btn-approve" onClick={() => processVoiceCommand('approve')}>
                ✅ Approve Payment
              </button>
              <button className="btn-cancel" onClick={cancelTransaction}>
                ❌ Cancel
              </button>
            </div>
          </div>
        );
      
      case 4: // Processing
        return (
          <div className="tab-content processing-tab">
            <div className="processing-animation">
              <div className="spinner"></div>
              <h2>⏳ Processing Payment...</h2>
              <p>Please wait while we process your transaction</p>
            </div>
          </div>
        );
      
      case 5: // Success
        return (
          <div className="tab-content success-tab">
            <div className="success-animation">
              <div className="checkmark">✓</div>
              <h2>✅ Payment Successful!</h2>
              <div className="success-details">
                <p>₹{currentTransaction.amount} sent to</p>
                <p><strong>{currentTransaction.recipient}</strong></p>
                <p className="upi-id">{currentTransaction.upiId}</p>
              </div>
              <p className="auto-return">Returning to home...</p>
            </div>
          </div>
        );
      
      case 6: // History
        return (
          <div className="tab-content history-tab">
            <h2>📜 Transaction History</h2>
            {transactions.length === 0 ? (
              <p className="no-transactions">No transactions yet</p>
            ) : (
              <div className="transactions-list">
                {transactions.map(transaction => (
                  <div key={transaction.id} className="transaction-item">
                    <div className="transaction-header">
                      <span className="recipient-name">{transaction.recipient}</span>
                      <span className="amount">₹{transaction.amount}</span>
                    </div>
                    <div className="transaction-details">
                      <span className="upi-id">{transaction.upiId}</span>
                      <span className="timestamp">{transaction.timestamp}</span>
                    </div>
                    <span className={`status-badge ${transaction.status.toLowerCase()}`}>
                      {transaction.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-back" onClick={() => setCurrentTab(0)}>
              ← Back to Home
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="voice-upi-container">
      <header className="header">
        <h1>🎤 Voice UPI Payment Platform</h1>
        <p className="subtitle">Tab-by-tab voice-guided payments</p>
      </header>

      <div className="main-content-tabs">
        {/* Voice Control Panel */}
        <section className="voice-control-panel">
          <button 
            className={`voice-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
          >
            {isListening ? '🔴 Listening...' : '🎤 Start Voice Command'}
          </button>
          
          <div className="transcript-box">
            <p className="label">Voice Input:</p>
            <p className="transcript">{transcript || 'Say a command...'}</p>
          </div>

          <div className="status-box">
            <p className="status">{status || 'Ready'}</p>
          </div>

          <div className="voice-commands-help">
            <h3>📢 Voice Commands:</h3>
            <ul>
              <li>🏠 <strong>"Initiate Payment"</strong> - Start new payment</li>
              <li>👥 <strong>"[Contact Name]"</strong> - Select contact (Ram, John, Sarah...)</li>
              <li>💰 <strong>"[Amount]"</strong> - Say amount (e.g., "1000 rupees")</li>
              <li>✅ <strong>"Approve"</strong> - Confirm payment</li>
              <li>📜 <strong>"Show transaction history"</strong></li>
              <li>❌ <strong>"Cancel"</strong> - Go back to home</li>
            </ul>
          </div>
        </section>

        {/* Tab Content Area */}
        <section className="tab-content-area">
          {renderTabContent()}
        </section>
      </div>
    </div>
  );
};

export default VoiceUPIApp;
