import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Sparkles, Send, User, Mail, Phone, Users, CreditCard, Loader2, AlertCircle, Check, QrCode, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

// DEFAULT UPI ID (VPA) FOR RECEIVING PAYMENTS
const DEFAULT_UPI_ID = "rgopinathreddyreddyvari38@okicici";

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Calculate ticket price based on Single (₹499) or Couple (₹699)
  const getAmount = () => {
    return formData.numberOfPersons === 'Couple' ? 699 : 499;
  };

  // Generate UPI Deep Link for GPay / PhonePe / Paytm
  const getUpiDeepLink = () => {
    const amount = getAmount();
    const note = encodeURIComponent(`VEEGA RAVE - ${formData.numberOfPersons} Pass (${formData.fullName})`);
    const name = encodeURIComponent("VEEGA RAVE 2026");
    return `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;
  };

  // Generate QR Code URL
  const getQrCodeUrl = () => {
    const upiUrl = getUpiDeepLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;
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

    try {
      await addDoc(collection(db, "registrations"), {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        numberOfPersons: formData.numberOfPersons,
        paymentMethod: formData.paymentMethod,
        ticketAmount: amount,
        upiIdUsed: formData.paymentMethod === 'UPI' ? upiId : null,
        createdAt: serverTimestamp(),
        submittedAt: new Date().toISOString()
      });

      setIsSubmitted(true);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ff0a1a', '#ffffff', '#ffd700']
      });

      // IF UPI IS CHOSEN, AUTOMATICALLY TRIGGER UPI DEEP-LINK ON MOBILE
      if (formData.paymentMethod === 'UPI') {
        const deepLink = getUpiDeepLink();
        window.location.href = deepLink;
      }

    } catch (err: any) {
      console.error("Firestore save error:", err);
      setFirestoreError("Unable to connect to Firestore database. Please check connection and try again.");
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

              {/* Dynamic UPI Price & Info Banner */}
              {formData.paymentMethod === 'UPI' && (
                <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255, 10, 26, 0.08)', border: '1px solid rgba(255, 10, 26, 0.25)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>Total Payable Amount:</span>
                    <span style={{ fontSize: '1.25rem', color: '#ff0a1a', fontWeight: 900 }}>₹{getAmount()}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    ⚡ Clicking <strong>Submit & Pay via UPI</strong> will open GPay / PhonePe / Paytm directly on your phone.
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div style={{ marginTop: '8px' }}>
                <button type="submit" disabled={isSubmitting} className="submit-btn">
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Saving & Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>{formData.paymentMethod === 'UPI' ? `Submit & Pay ₹${getAmount()} via UPI` : 'Submit Response'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : (
            /* Confirmation Pass View with UPI Payment Details */
            <div className="confirmation-card">
              <div className="conf-icon">
                <CheckCircle2 size={56} color="#ff0a1a" />
              </div>
              <h3 className="conf-title">Registration Submitted!</h3>
              <p className="conf-desc">
                Your entry pass details have been saved successfully to Firestore.
              </p>

              {/* If UPI option was selected, display QR code and Pay button */}
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

                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>
                    Pay to UPI ID: <strong style={{ color: '#ffffff' }}>{upiId}</strong>
                  </div>

                  <a 
                    href={getUpiDeepLink()}
                    className="submit-btn"
                    style={{ textDecoration: 'none', width: '100%', marginTop: '4px' }}
                  >
                    <ExternalLink size={18} />
                    <span>Pay ₹{getAmount()} via GPay / PhonePe / Paytm</span>
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
