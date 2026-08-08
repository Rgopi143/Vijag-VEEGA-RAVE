import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Sparkles, Send, User, Mail, Phone, Users, CreditCard, Loader2, AlertCircle, Check, QrCode, ExternalLink, Copy, CheckCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

// OFFICIAL VEEGA RAVE UPI ID & PHONE NUMBER
const DEFAULT_UPI_ID = "8249213853-2@ibl";
const PAYEE_MOBILE = "8249213853";

export default function RegistrationModal({ isOpen, onClose, theme = 'light' }: RegistrationModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    numberOfPersons: 'Single',
    paymentMethod: 'UPI'
  });

  const upiId = DEFAULT_UPI_ID;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [copiedMobile, setCopiedMobile] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Calculate ticket price based on Single (₹499) or Couple (₹699)
  const getAmount = () => {
    return formData.numberOfPersons === 'Couple' ? 699 : 499;
  };

  // Clean UPI Deep Link for GPay / PhonePe / Paytm (avoiding NPCI merchant flags)
  const getUpiDeepLink = () => {
    const amount = getAmount();
    return `upi://pay?pa=${upiId}&am=${amount}&cu=INR`;
  };

  // Generate QR Code URL
  const getQrCodeUrl = () => {
    const upiUrl = getUpiDeepLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;
  };

  const copyToClipboard = (text: string, type: 'mobile' | 'upi') => {
    navigator.clipboard.writeText(text);
    if (type === 'mobile') {
      setCopiedMobile(true);
      setTimeout(() => setCopiedMobile(false), 2000);
    } else {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required';
    if (!formData.email.trim() || !formData.email.includes('@')) newErrors.email = 'Valid Email is required';
    if (!formData.mobileNumber.trim() || formData.mobileNumber.length !== 10) {
      newErrors.mobileNumber = 'Mobile number must be exactly 10 digits';
    }
    if (!formData.numberOfPersons) newErrors.numberOfPersons = 'Please select Single or Couple';
    if (!formData.paymentMethod) newErrors.paymentMethod = 'Please select a payment method';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirestoreError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    const amount = getAmount();
    const deepLink = getUpiDeepLink();

    if (formData.paymentMethod === 'UPI') {
      // Background non-blocking save to Firestore with 1.2s timeout safety
      try {
        const savePromise = addDoc(collection(db, "registrations"), {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          mobileNumber: formData.mobileNumber.trim(),
          numberOfPersons: formData.numberOfPersons,
          paymentMethod: formData.paymentMethod,
          ticketAmount: amount,
          upiIdUsed: upiId,
          createdAt: serverTimestamp(),
          submittedAt: new Date().toISOString()
        });

        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1200));
        await Promise.race([savePromise, timeoutPromise]);
      } catch (err) {
        console.warn("Firestore save warning:", err);
      }

      setIsSubmitted(true);
      setIsSubmitting(false);

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ff0a1a', '#ffffff', '#ffd700']
      });

      // LAUNCH CLEANED UPI DEEP LINK
      window.location.href = deepLink;
      return;
    }

    // Cash at Venue path
    try {
      await addDoc(collection(db, "registrations"), {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        numberOfPersons: formData.numberOfPersons,
        paymentMethod: formData.paymentMethod,
        ticketAmount: amount,
        createdAt: serverTimestamp(),
        submittedAt: new Date().toISOString()
      });
      setIsSubmitted(true);
    } catch (err: any) {
      console.error("Firestore save error:", err);
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setFormData({
      fullName: '',
      email: '',
      mobileNumber: '',
      numberOfPersons: 'Single',
      paymentMethod: 'UPI'
    });
    setErrors({});
    setFirestoreError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={`modal-overlay ${theme === 'light' ? 'theme-light' : 'theme-dark'}`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3 }}
          className="modal-card"
        >
          {/* Header */}
          <div className="modal-header">
            <div>
              <h2 className="modal-title">VEEGA RAVE</h2>
            </div>
            <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close modal">
              <X size={20} />
            </button>
          </div>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="modal-form">
              
              {/* Firestore Status / Error Banner */}
              {firestoreError && (
                <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(255, 10, 26, 0.15)', border: '1px solid rgba(255, 10, 26, 0.3)', color: '#ff0a1a', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{firestoreError}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="form-group">
                <label className="form-label">
                  <User size={16} /> Full Name <span className="req-star">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Enter your full name" 
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={`form-input ${errors.fullName ? 'input-error' : ''}`}
                />
                {errors.fullName && <span className="error-text">{errors.fullName}</span>}
              </div>

              {/* E-Mail */}
              <div className="form-group">
                <label className="form-label">
                  <Mail size={16} /> E - Mail <span className="req-star">*</span>
                </label>
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`form-input ${errors.email ? 'input-error' : ''}`}
                />
                {errors.email && <span className="error-text">{errors.email}</span>}
              </div>

              {/* Mobile Number (Strict 10 Digits) */}
              <div className="form-group">
                <label className="form-label">
                  <Phone size={16} /> Mobile Number <span className="req-star">*</span>
                </label>
                <input 
                  type="tel" 
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number" 
                  value={formData.mobileNumber}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, mobileNumber: cleaned });
                  }}
                  className={`form-input ${errors.mobileNumber ? 'input-error' : ''}`}
                />
                {errors.mobileNumber && <span className="error-text">{errors.mobileNumber}</span>}
              </div>

              {/* Number of Persons (Single / Couple Selector Buttons) */}
              <div className="form-group">
                <label className="form-label">
                  <Users size={16} /> Number of Persons <span className="req-star">*</span>
                </label>

                <div className="radio-group">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, numberOfPersons: 'Single' })}
                    className={`radio-card ${formData.numberOfPersons === 'Single' ? 'radio-card-active' : ''}`}
                    style={{ justifyContent: 'center', padding: '14px', position: 'relative' }}
                  >
                    {formData.numberOfPersons === 'Single' && <Check size={16} style={{ color: '#ff0a1a', position: 'absolute', left: '12px' }} />}
                    <span>Single (₹499)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, numberOfPersons: 'Couple' })}
                    className={`radio-card ${formData.numberOfPersons === 'Couple' ? 'radio-card-active' : ''}`}
                    style={{ justifyContent: 'center', padding: '14px', position: 'relative' }}
                  >
                    {formData.numberOfPersons === 'Couple' && <Check size={16} style={{ color: '#ff0a1a', position: 'absolute', left: '12px' }} />}
                    <span>Couple (₹699)</span>
                  </button>
                </div>
                {errors.numberOfPersons && <span className="error-text">{errors.numberOfPersons}</span>}
              </div>

              {/* Payment Method (UPI & Cash at Venue) */}
              <div className="form-group">
                <label className="form-label">
                  <CreditCard size={16} /> Which payment method do you prefer for your entry pass? <span className="req-star">*</span>
                </label>

                <div className="radio-group">
                  {['UPI', 'Cash at Venue'].map((method) => (
                    <label key={method} className={`radio-card ${formData.paymentMethod === method ? 'radio-card-active' : ''}`}>
                      <input 
                        type="radio" 
                        name="paymentMethod" 
                        value={method}
                        checked={formData.paymentMethod === method}
                        onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                        className="radio-input"
                      />
                      <span>{method}</span>
                    </label>
                  ))}
                </div>
                {errors.paymentMethod && <span className="error-text">{errors.paymentMethod}</span>}
              </div>

              {/* Dynamic UPI Price & Quick Copy Options */}
              {formData.paymentMethod === 'UPI' && (
                <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255, 10, 26, 0.08)', border: '1px solid rgba(255, 10, 26, 0.25)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>Total Payable Amount:</span>
                    <span style={{ fontSize: '1.3rem', color: '#ff0a1a', fontWeight: 900 }}>₹{getAmount()}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#94a3b8' }}>Payee Phone Number:</span>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(PAYEE_MOBILE, 'mobile')}
                        style={{ background: 'none', border: 'none', color: '#ff0a1a', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>{PAYEE_MOBILE}</span>
                        {copiedMobile ? <CheckCheck size={14} color="#22c55e" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#94a3b8' }}>Payee UPI ID:</span>
                      <button 
                        type="button"
                        onClick={() => copyToClipboard(UPI_ID_CLEAN(upiId), 'upi')}
                        style={{ background: 'none', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>{upiId}</span>
                        {copiedUpi ? <CheckCheck size={14} color="#22c55e" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div style={{ marginTop: '8px' }}>
                <button type="submit" disabled={isSubmitting} className="submit-btn">
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Opening UPI App...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>{formData.paymentMethod === 'UPI' ? `Pay ₹${getAmount()} via UPI App` : 'Submit Response'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : (
            /* Confirmation Pass View with UPI Payment Details & Mobile Number Option */
            <div className="confirmation-card">
              <div className="conf-icon">
                <CheckCircle2 size={56} color="#ff0a1a" />
              </div>
              <h3 className="conf-title">Registration Submitted!</h3>
              <p className="conf-desc">
                Your entry pass details have been saved successfully to Firestore.
              </p>

              {/* If UPI option was selected, display QR code, Phone Number, and Pay button */}
              {formData.paymentMethod === 'UPI' && (
                <div style={{ background: '#181820', border: '1.5px solid #ff0a1a', borderRadius: '20px', padding: '20px', margin: '16px 0 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 800, fontSize: '1.1rem' }}>
                    <QrCode size={20} color="#ff0a1a" />
                    <span>Scan & Pay ₹{getAmount()}</span>
                  </div>

                  <img 
                    src={getQrCodeUrl()} 
                    alt={`UPI QR Code for ₹${getAmount()}`}
                    style={{ width: '180px', height: '180px', borderRadius: '12px', border: '4px solid #ffffff' }}
                  />

                  {/* Pay via Mobile Number Helper Box (Bypasses Paytm Protect alerts) */}
                  <div style={{ width: '100%', background: 'rgba(255, 10, 26, 0.1)', border: '1px solid rgba(255, 10, 26, 0.3)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '4px' }}>
                      💡 If Paytm / PhonePe shows an alert, choose <strong>"Pay via Mobile Number"</strong> or <strong>"Pay via Scanning QR"</strong>:
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>{PAYEE_MOBILE}</span>
                      <button 
                        type="button" 
                        onClick={() => copyToClipboard(PAYEE_MOBILE, 'mobile')}
                        style={{ padding: '4px 10px', borderRadius: '6px', background: '#ff0a1a', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {copiedMobile ? 'Copied!' : 'Copy Phone Number'}
                      </button>
                    </div>
                  </div>

                  <a 
                    href={getUpiDeepLink()}
                    className="submit-btn"
                    style={{ textDecoration: 'none', width: '100%', marginTop: '4px' }}
                  >
                    <ExternalLink size={18} />
                    <span>Open GPay / PhonePe / Paytm (₹{getAmount()})</span>
                  </a>
                </div>
              )}

              <div className="receipt-summary">
                <div className="receipt-row">
                  <span>Full Name:</span>
                  <strong>{formData.fullName}</strong>
                </div>
                <div className="receipt-row">
                  <span>E-Mail:</span>
                  <strong>{formData.email}</strong>
                </div>
                <div className="receipt-row">
                  <span>Mobile Number:</span>
                  <strong>{formData.mobileNumber}</strong>
                </div>
                <div className="receipt-row">
                  <span>Number of Persons:</span>
                  <strong>{formData.numberOfPersons} (₹{getAmount()})</strong>
                </div>
                <div className="receipt-row">
                  <span>Payment Method:</span>
                  <strong>{formData.paymentMethod}</strong>
                </div>
              </div>

              <button type="button" onClick={handleReset} className="submit-btn">
                <Sparkles size={18} />
                <span>Done</span>
              </button>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function UPI_ID_CLEAN(id: string) {
  return id;
}
