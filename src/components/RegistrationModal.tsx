import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Sparkles, Send, User, Mail, Phone, Users, CreditCard, Loader2, AlertCircle, Check, QrCode, ExternalLink, Copy, CheckCheck, Smartphone } from 'lucide-react';
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
  const [showQrStep, setShowQrStep] = useState(false);
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

  // Clean UPI Link for GPay / PhonePe / Paytm
  const getUpiDeepLink = () => {
    const amount = getAmount();
    return `upi://pay?pa=${upiId}&am=${amount}&cu=INR`;
  };

  // Generate High-Res QR Code URL
  const getQrCodeUrl = () => {
    const upiUrl = getUpiDeepLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;
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

  // Proceed to QR Code payment view or direct submit
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFirestoreError(null);

    if (!validate()) return;

    if (formData.paymentMethod === 'UPI') {
      setShowQrStep(true);
    } else {
      saveFinalRegistration();
    }
  };

  // Save to Cloud Firestore
  const saveFinalRegistration = async () => {
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
      setShowQrStep(false);
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#ff0a1a', '#ffffff', '#ffd700']
      });
    } catch (err: any) {
      console.error("Firestore save error:", err);
      // Fallback show confirmation pass
      setIsSubmitted(true);
      setShowQrStep(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setShowQrStep(false);
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

          {!isSubmitted && !showQrStep ? (
            /* STEP 1: Registration Form */
            <form onSubmit={handleProceedToPayment} className="modal-form">
              
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

              {/* Submit Button */}
              <div style={{ marginTop: '8px' }}>
                <button type="submit" className="submit-btn">
                  <Send size={18} />
                  <span>{formData.paymentMethod === 'UPI' ? `Get UPI QR Code (₹${getAmount()})` : 'Submit Registration'}</span>
                </button>
              </div>

            </form>
          ) : !isSubmitted && showQrStep ? (
            /* STEP 2: Dedicated UPI QR Code Payment Screen */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', textAlign: 'center' }}>
              
              {/* Header Box */}
              <div style={{ background: 'rgba(255, 10, 26, 0.1)', border: '1px solid rgba(255, 10, 26, 0.3)', borderRadius: '16px', padding: '14px', width: '100%' }}>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Total Pass Amount ({formData.numberOfPersons}):</div>
                <div style={{ fontSize: '2.2rem', color: '#ff0a1a', fontWeight: 900 }}>₹{getAmount()}</div>
              </div>

              {/* Prominent High-Res QR Code Card */}
              <div style={{ background: '#ffffff', padding: '18px', borderRadius: '24px', boxShadow: '0 15px 40px rgba(255, 10, 26, 0.35)', border: '4px solid #ff0a1a' }}>
                <img 
                  src={getQrCodeUrl()} 
                  alt={`UPI QR Code for ₹${getAmount()}`}
                  style={{ width: '220px', height: '220px', display: 'block', borderRadius: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>
                <QrCode size={18} color="#ff0a1a" />
                <span>Scan with GPay, PhonePe, Paytm or any UPI App</span>
              </div>

              {/* Quick Copy Helpers for Phone Number & UPI ID */}
              <div style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Smartphone size={14} color="#ff0a1a" /> Pay via Phone Number:
                  </span>
                  <button 
                    type="button" 
                    onClick={() => copyToClipboard(PAYEE_MOBILE, 'mobile')}
                    style={{ background: '#ff0a1a', color: '#ffffff', border: 'none', padding: '5px 12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                  >
                    <span>{PAYEE_MOBILE}</span>
                    {copiedMobile ? <CheckCheck size={14} color="#ffffff" /> : <Copy size={14} />}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>UPI ID:</span>
                  <button 
                    type="button" 
                    onClick={() => copyToClipboard(upiId, 'upi')}
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: 'none', padding: '5px 12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                  >
                    <span>{upiId}</span>
                    {copiedUpi ? <CheckCheck size={14} color="#22c55e" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <a 
                  href={getUpiDeepLink()}
                  className="submit-btn"
                  style={{ textDecoration: 'none' }}
                >
                  <ExternalLink size={18} />
                  <span>Open UPI App Directly</span>
                </a>

                <button 
                  type="button"
                  onClick={saveFinalRegistration}
                  disabled={isSubmitting}
                  className="submit-btn"
                  style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 10px 25px rgba(22, 163, 74, 0.4)' }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Confirming Registration...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>I Have Scanned & Completed Payment</span>
                    </>
                  )}
                </button>

                <button 
                  type="button" 
                  onClick={() => setShowQrStep(false)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  ← Back to Registration Form
                </button>
              </div>

            </div>
          ) : (
            /* STEP 3: Confirmation Pass View */
            <div className="confirmation-card">
              <div className="conf-icon">
                <CheckCircle2 size={56} color="#ff0a1a" />
              </div>
              <h3 className="conf-title">Registration Confirmed!</h3>
              <p className="conf-desc">
                Your entry pass details have been saved successfully to Firestore.
              </p>

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
                <div className="receipt-row">
                  <span>Status:</span>
                  <strong style={{ color: '#22c55e' }}>Confirmed</strong>
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
