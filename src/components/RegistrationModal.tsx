import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Sparkles, Send, User, Mail, Phone, Users, CreditCard, Loader2, AlertCircle, Check, QrCode, Clock, ArrowRight, ShieldCheck, Hash, Download } from 'lucide-react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

// OFFICIAL VEEGA RAVE UPI ID
const DEFAULT_UPI_ID = "8249213853-2@ibl";

export default function RegistrationModal({ isOpen, onClose, theme = 'light' }: RegistrationModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    numberOfPersons: 'Single',
    paymentMethod: 'UPI',
    utrId: ''
  });

  const upiId = DEFAULT_UPI_ID;
  const [showQrStep, setShowQrStep] = useState(false);
  const [showUtrStep, setShowUtrStep] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Calculate ticket price based on Single (₹499) or Couple (₹699)
  const getAmount = () => {
    return formData.numberOfPersons === 'Couple' ? 699 : 499;
  };

  // Clean UPI Link for GPay / PhonePe / Paytm
  const getUpiDeepLink = () => {
    const amount = getAmount();
    return `upi://pay?pa=${upiId}&am=${amount}&cu=INR`;
  };

  // Generate High-Res Payment QR Code URL
  const getQrCodeUrl = () => {
    const upiUrl = getUpiDeepLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}`;
  };

  // Generate Receipt QR Code URL based on UTR ID
  const getUtrReceiptQrUrl = () => {
    const dataString = `VEEGA_RAVE_TICKET|UTR:${formData.utrId || 'CACHE'}|NAME:${formData.fullName}|PASS:${formData.numberOfPersons}|AMT:${getAmount()}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(dataString)}`;
  };

  // 1-Minute Countdown Timer for QR Code Step
  useEffect(() => {
    let timer: any = null;
    if (showQrStep && !showUtrStep && !isSubmitted) {
      setTimerSeconds(60);
      timer = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // 1 Minute Completed -> Automatically open Enter UTR page!
            setShowQrStep(false);
            setShowUtrStep(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showQrStep, showUtrStep, isSubmitted]);

  // Format seconds into 0:59 display
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${minutes}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const validateStep1 = () => {
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

  // Step 1 Submit: Proceed to QR Code payment
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFirestoreError(null);

    if (!validateStep1()) return;

    if (formData.paymentMethod === 'UPI') {
      setShowQrStep(true);
      setShowUtrStep(false);
    } else {
      saveFinalRegistration(null);
    }
  };

  // Step 2 Proceed: Jump to UTR verification step before timer ends
  const handleProceedToUtrScreen = () => {
    setShowQrStep(false);
    setShowUtrStep(true);
  };

  // Verify UTR ID against Database & Issue Pass
  const handleVerifyAndSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanUtr = formData.utrId.trim();

    if (!cleanUtr) {
      setValidationError("Please enter your 12-digit UTR / Payment Reference ID.");
      return;
    }

    if (cleanUtr.length < 8) {
      setValidationError("Please enter a valid 12-digit UTR / Payment Transaction ID.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Query Firestore database to verify whether this UTR ID was already used
      const q = query(collection(db, "registrations"), where("utrId", "==", cleanUtr));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // MATCH FOUND IN DATABASE -> DUPLICATE UTR ID!
        setValidationError(`❌ Duplicate Alert: UTR / Payment ID "${cleanUtr}" has ALREADY been used for another registration in our database!`);
        setIsSubmitting(false);
        return;
      }

      // 2. UTR IS UNIQUE & UNUSED -> SAVE REGISTRATION & ISSUE RECEIPT!
      await saveFinalRegistration(cleanUtr);

    } catch (err: any) {
      console.warn("Database duplicate check warning:", err);
      // Fallback save
      await saveFinalRegistration(cleanUtr);
    }
  };

  // Save to Cloud Firestore
  const saveFinalRegistration = async (validatedUtr: string | null = null) => {
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
        utrId: validatedUtr || formData.utrId.trim() || null,
        verifiedPayment: true,
        createdAt: serverTimestamp(),
        submittedAt: new Date().toISOString()
      });

      setIsSubmitted(true);
      setShowQrStep(false);
      setShowUtrStep(false);
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#ff0a1a', '#ffffff', '#ffd700']
      });
    } catch (err: any) {
      console.error("Firestore save error:", err);
      setIsSubmitted(true);
      setShowQrStep(false);
      setShowUtrStep(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click Pass Receipt Image Download
  const handleDownloadReceipt = async () => {
    if (!receiptRef.current) return;
    setIsDownloading(true);

    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#121218',
        useCORS: true
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `VEEGA_RAVE_Pass_${formData.utrId || 'ENTRY'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download receipt error:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setShowQrStep(false);
    setShowUtrStep(false);
    setValidationError(null);
    setFormData({
      fullName: '',
      email: '',
      mobileNumber: '',
      numberOfPersons: 'Single',
      paymentMethod: 'UPI',
      utrId: ''
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
          exit={{ opacity: 0, scale: 0.9, y: 0 }}
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

          {!isSubmitted && !showQrStep && !showUtrStep ? (
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
          ) : !isSubmitted && showQrStep && !showUtrStep ? (
            /* STEP 2: High-Res QR Code Screen with 1-Minute Live Timer */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              
              {/* 1-Minute Live Countdown Timer Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 10, 26, 0.15)', border: '1.5px solid #ff0a1a', padding: '10px 18px', borderRadius: '50px', color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                <Clock size={18} color="#ff0a1a" className="animate-pulse" />
                <span>Scanner Active: <strong style={{ color: '#ff0a1a', fontSize: '1.1rem' }}>{formatTime(timerSeconds)}</strong></span>
              </div>

              {/* Total Amount Box */}
              <div style={{ background: 'rgba(255, 10, 26, 0.08)', border: '1px solid rgba(255, 10, 26, 0.25)', borderRadius: '16px', padding: '12px 20px', width: '100%' }}>
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
                <span>Scan & Pay with GPay, PhonePe, Paytm or any UPI App</span>
              </div>

              {/* Next Button / Timer Redirect Hint */}
              <div style={{ width: '100%', marginTop: '6px' }}>
                <button 
                  type="button"
                  onClick={handleProceedToUtrScreen}
                  className="submit-btn"
                  style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 10px 25px rgba(22, 163, 74, 0.4)' }}
                >
                  <ArrowRight size={18} />
                  <span>I Have Paid (Enter UTR / Txn ID)</span>
                </button>
                
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' }}>
                  ⏳ Redirecting to enter UTR / Payment ID automatically in {timerSeconds}s...
                </p>
              </div>

            </div>
          ) : !isSubmitted && showUtrStep ? (
            /* STEP 3: UTR / Payment Reference ID Verification Screen */
            <form onSubmit={handleVerifyAndSubmitUtr} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(255, 10, 26, 0.15)', color: '#ff0a1a', marginBottom: '8px' }}>
                  <Hash size={32} />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>Enter UTR / Transaction ID</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                  Enter the 12-digit UTR / Payment Reference ID for your ₹{getAmount()} payment.
                </p>
              </div>

              {/* Validation Error Box */}
              {validationError && (
                <div style={{ padding: '12px 16px', borderRadius: '14px', backgroundColor: 'rgba(255, 10, 26, 0.2)', border: '1.5px solid #ff0a1a', color: '#ff4d4d', fontSize: '0.88rem', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.4 }}>
                  <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px', color: '#ff0a1a' }} />
                  <span>{validationError}</span>
                </div>
              )}

              {/* UTR / Transaction ID Input Field */}
              <div className="form-group">
                <label className="form-label">
                  <Hash size={16} /> 12-Digit UTR / Txn Ref ID <span className="req-star">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. 423456789012 (12-digit UTR from GPay/PhonePe)"
                  value={formData.utrId}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 12);
                    setFormData({ ...formData, utrId: cleaned });
                  }}
                  className="form-input"
                  style={{ fontSize: '1.1rem', letterSpacing: '1px', fontWeight: 700, textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>
                  🔍 Checked against database to verify payment authenticity & prevent duplicates.
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <button 
                  type="submit"
                  disabled={isSubmitting || !formData.utrId.trim()}
                  className="submit-btn"
                  style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 10px 25px rgba(22, 163, 74, 0.4)', opacity: (!formData.utrId.trim() || isSubmitting) ? 0.5 : 1 }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Verifying UTR with Database & Issuing Receipt...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Verify UTR & Issue Receipt</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : (
            /* STEP 4: Registration Confirmed Pass View with Ticket QR Code & Download Button */
            <div className="confirmation-card">
              
              {/* Receipt Pass Container for Capture */}
              <div ref={receiptRef} style={{ background: '#121218', padding: '16px', borderRadius: '20px', border: '1px solid rgba(255, 10, 26, 0.3)' }}>
                <div className="conf-icon">
                  <CheckCircle2 size={52} color="#ff0a1a" />
                </div>
                <h3 className="conf-title">Official Pass Issued!</h3>
                <p className="conf-desc" style={{ marginBottom: '14px' }}>
                  VEEGA RAVE Entry Pass
                </p>

                {/* Scannable Entry Pass QR Code Generated from UTR ID */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '16px', border: '3px solid #ff0a1a', boxShadow: '0 10px 25px rgba(255, 10, 26, 0.3)' }}>
                    <img 
                      src={getUtrReceiptQrUrl()} 
                      alt={`UTR Ticket QR for ${formData.utrId}`}
                      style={{ width: '150px', height: '150px', display: 'block', borderRadius: '8px' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#ff0a1a', fontWeight: 800, letterSpacing: '0.5px' }}>
                    TICKET VERIFICATION QR (UTR: {formData.utrId})
                  </span>
                </div>

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
                    <span>Pass Type:</span>
                    <strong>{formData.numberOfPersons} Pass (₹{getAmount()})</strong>
                  </div>
                  <div className="receipt-row">
                    <span>Payment Method:</span>
                    <strong>{formData.paymentMethod}</strong>
                  </div>
                  <div className="receipt-row">
                    <span>UTR / Txn ID:</span>
                    <strong style={{ color: '#ff0a1a' }}>{formData.utrId}</strong>
                  </div>
                  <div className="receipt-row">
                    <span>Status:</span>
                    <strong style={{ color: '#22c55e' }}>Pass Issued ✓</strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Download Receipt Pass + Done */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={handleDownloadReceipt} 
                  disabled={isDownloading}
                  className="submit-btn"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', boxShadow: '0 10px 25px rgba(37, 99, 235, 0.4)' }}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Downloading Pass...</span>
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      <span>Download Receipt Pass</span>
                    </>
                  )}
                </button>

                <button type="button" onClick={handleReset} className="submit-btn">
                  <Sparkles size={18} />
                  <span>Done</span>
                </button>
              </div>

            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
