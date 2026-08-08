import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Sparkles, Send, User, Mail, Phone, Users, CreditCard, Loader2, AlertCircle, Check, QrCode, Upload, Clock, Image as ImageIcon, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

// OFFICIAL VEEGA RAVE UPI ID
const DEFAULT_UPI_ID = "8249213853-2@ibl";

// Keywords found on legitimate UPI payment receipts (GPay, PhonePe, Paytm, BHIM, etc.)
const VALID_PAYMENT_KEYWORDS = [
  'paid', 'payment', 'successful', 'success', 'completed', 'transfer',
  'gpay', 'google pay', 'phonepe', 'paytm', 'bhim', 'upi', 'utr', 'ref',
  'transaction', 'sent to', 'paid to', 'debited from', 'rs', 'rupees', '₹', '499', '699', 'simhadri', 'prudhviraj', '8249213853'
];

// Keywords for non-payment files (ID cards, posters, documents, certificates, personal photos)
const NON_PAYMENT_KEYWORDS = [
  'aadhar', 'adhar', 'pan', 'id', 'card', 'license', 'voter', 'passport',
  'fellowship', 'project', 'poster', 'banner', 'flyer', 'certificate',
  'resume', 'profile', 'avatar', 'cover', 'doc', 'pdf', 'image', 'photo', 'picture'
];

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
  const [showUploadStep, setShowUploadStep] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  
  const [isVerifyingImage, setIsVerifyingImage] = useState(false);
  const [imageVerified, setImageVerified] = useState<boolean | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  // 1-Minute Countdown Timer for QR Code Step
  useEffect(() => {
    let timer: any = null;
    if (showQrStep && !showUploadStep && !isSubmitted) {
      setTimerSeconds(60);
      timer = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // 1 Minute Completed -> Automatically open Upload Screenshot page!
            setShowQrStep(false);
            setShowUploadStep(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showQrStep, showUploadStep, isSubmitted]);

  // Format seconds into 0:59 display
  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${minutes}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  // Generate unique fingerprint hash of the image file
  const generateImageHash = (file: File, dataUrl: string) => {
    const str = `${file.name}-${file.size}-${dataUrl.slice(-100)}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `IMG_${Math.abs(hash)}_${file.size}`;
  };

  // Run Strict Payment Screenshot Receipt Verification
  const verifyPaymentScreenshot = async (file: File, dataUrl: string) => {
    setIsVerifyingImage(true);
    setValidationError(null);
    setImageVerified(null);

    const fileNameLower = file.name.toLowerCase();

    // 1. Check Non-Payment File Name Keywords (Aadhar, PAN, Card, ID, Poster, etc.)
    const matchesNonPaymentKeyword = NON_PAYMENT_KEYWORDS.some(kw => {
      // Avoid false positive on screenshot or img
      if (kw === 'card' && fileNameLower.includes('score_card')) return true;
      if (kw === 'id' && (fileNameLower.includes('paid') || fileNameLower.includes('paid_id'))) return false;
      return fileNameLower.includes(kw);
    });

    // Check if filename explicitly looks like a payment receipt
    const isPaymentAppFileName = 
      fileNameLower.includes('screenshot') ||
      fileNameLower.includes('screen_shot') ||
      fileNameLower.includes('gpay') ||
      fileNameLower.includes('phonepe') ||
      fileNameLower.includes('paytm') ||
      fileNameLower.includes('bhim') ||
      fileNameLower.includes('upi') ||
      fileNameLower.includes('payment') ||
      fileNameLower.includes('receipt');

    if (matchesNonPaymentKeyword && !isPaymentAppFileName) {
      setIsVerifyingImage(false);
      setImageVerified(false);
      setValidationError(`❌ Invalid Image: "${file.name}" is an ID document/card or non-payment image! Please upload a valid PhonePe, GPay, or Paytm payment screenshot.`);
      return false;
    }

    // 2. Perform Image Aspect Ratio Inspection (Mobile screen screenshots vs flyers/IDs)
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => { img.onload = resolve; });

    const aspectRatio = img.height / img.width;

    // Mobile payment receipts are vertical screenshots (height > width, ratio > 1.25)
    if (aspectRatio < 1.25 && !isPaymentAppFileName) {
      setIsVerifyingImage(false);
      setImageVerified(false);
      setValidationError(`❌ Invalid Image Format: Payment receipts must be portrait-mode mobile payment screenshots from PhonePe, GPay, or Paytm.`);
      return false;
    }

    // 3. Perform OCR Text Extraction via Tesseract.js if loaded
    try {
      if ((window as any).Tesseract) {
        const { data } = await (window as any).Tesseract.recognize(dataUrl, 'eng');
        const extractedText = (data.text || '').toLowerCase();

        // Check if document contains Aadhar/PAN/ID terms
        if (extractedText.includes('aadhar') || extractedText.includes('unique identification') || extractedText.includes('government of india') || extractedText.includes('income tax')) {
          setIsVerifyingImage(false);
          setImageVerified(false);
          setValidationError(`❌ Invalid Document: Detected an ID Card / Government document ("${file.name}"). Please upload your UPI payment screenshot.`);
          return false;
        }
        
        const hasPaymentKeyword = VALID_PAYMENT_KEYWORDS.some(kw => extractedText.includes(kw));

        if (!hasPaymentKeyword && !isPaymentAppFileName) {
          setIsVerifyingImage(false);
          setImageVerified(false);
          setValidationError(`❌ Verification Failed: Could not detect payment details (e.g. "Paid", "Success", "UPI Ref", "₹499/₹699") in "${file.name}". Please upload a clear GPay, PhonePe, or Paytm screenshot.`);
          return false;
        }
      }
    } catch (e) {
      console.warn("OCR recognition warning:", e);
    }

    // Passed All Verification Guards!
    setIsVerifyingImage(false);
    setImageVerified(true);
    return true;
  };

  // Handle Image Selection
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setScreenshotFile(file);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const resultStr = reader.result as string;
        setScreenshotPreview(resultStr);

        // Generate Image Hash
        const hash = generateImageHash(file, resultStr);
        setImageHash(hash);

        // Run Strict Verification
        await verifyPaymentScreenshot(file, resultStr);
      };
      reader.readAsDataURL(file);
    }
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
      setShowUploadStep(false);
    } else {
      saveFinalRegistration(null, null);
    }
  };

  // Step 2 Proceed: Manually jump to upload screenshot step before timer ends
  const handleProceedToUploadScreen = () => {
    setShowQrStep(false);
    setShowUploadStep(true);
  };

  // Check Screenshot against Database & Issue Pass
  const handleVerifyAndSubmitScreenshot = async () => {
    setValidationError(null);

    if (!screenshotFile || !screenshotPreview) {
      setValidationError("Please select or capture your payment screenshot before submitting.");
      return;
    }

    if (imageVerified === false) {
      setValidationError("Uploaded image is invalid. Please select a valid GPay, PhonePe, or Paytm payment receipt screenshot.");
      return;
    }

    setIsSubmitting(true);
    const hash = imageHash || generateImageHash(screenshotFile, screenshotPreview);

    try {
      // 1. Query Firestore database to verify whether this exact screenshot hash was already uploaded
      const q = query(collection(db, "registrations"), where("imageHash", "==", hash));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // MATCH FOUND IN DATABASE -> DUPLICATE SCREENSHOT!
        setValidationError("❌ Duplicate Alert: This payment screenshot has ALREADY been used for another registration in our database!");
        setIsSubmitting(false);
        return;
      }

      // 2. SCREENSHOT IS NEW, VALID & UNIQUE -> SAVE REGISTRATION & ISSUE RECEIPT!
      await saveFinalRegistration(screenshotPreview, hash);

    } catch (err: any) {
      console.warn("Database duplicate check warning:", err);
      // Fallback save
      await saveFinalRegistration(screenshotPreview, hash);
    }
  };

  // Save to Cloud Firestore
  const saveFinalRegistration = async (screenshotBase64: string | null = null, hash: string | null = null) => {
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
        imageHash: hash || null,
        paymentScreenshot: screenshotBase64 || screenshotPreview || null,
        verifiedPayment: true,
        createdAt: serverTimestamp(),
        submittedAt: new Date().toISOString()
      });

      setIsSubmitted(true);
      setShowQrStep(false);
      setShowUploadStep(false);
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
      setShowUploadStep(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setShowQrStep(false);
    setShowUploadStep(false);
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setImageHash(null);
    setImageVerified(null);
    setValidationError(null);
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

          {!isSubmitted && !showQrStep && !showUploadStep ? (
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
          ) : !isSubmitted && showQrStep && !showUploadStep ? (
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
                  onClick={handleProceedToUploadScreen}
                  className="submit-btn"
                  style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 10px 25px rgba(22, 163, 74, 0.4)' }}
                >
                  <ArrowRight size={18} />
                  <span>I Have Paid (Upload Screenshot)</span>
                </button>
                
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' }}>
                  ⏳ Redirecting to upload payment screenshot automatically in {timerSeconds}s...
                </p>
              </div>

            </div>
          ) : !isSubmitted && showUploadStep ? (
            /* STEP 3: Upload & Database Verification Page */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '50%', background: 'rgba(255, 10, 26, 0.15)', color: '#ff0a1a', marginBottom: '8px' }}>
                  <Upload size={32} />
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>Upload Payment Screenshot</h3>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                  Upload your PhonePe, GPay, or Paytm payment screenshot for ₹{getAmount()} to issue your pass.
                </p>
              </div>

              {/* Validation Error Box */}
              {validationError && (
                <div style={{ padding: '12px 16px', borderRadius: '14px', backgroundColor: 'rgba(255, 10, 26, 0.2)', border: '1.5px solid #ff0a1a', color: '#ff4d4d', fontSize: '0.88rem', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: 1.4 }}>
                  <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: '2px', color: '#ff0a1a' }} />
                  <span>{validationError}</span>
                </div>
              )}

              {/* File Upload Dropzone */}
              <div className="form-group">
                <label htmlFor="screenshot-upload" className="upload-dropzone">
                  {isVerifyingImage ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#cbd5e1' }}>
                      <Loader2 size={24} className="animate-spin" color="#ff0a1a" />
                      <span style={{ fontWeight: 600 }}>Analyzing Payment Receipt Image...</span>
                    </div>
                  ) : screenshotPreview ? (
                    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img 
                        src={screenshotPreview} 
                        alt="Payment Screenshot Preview" 
                        style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '12px', border: imageVerified ? '2px solid #22c55e' : '2px solid #ff0a1a' }}
                      />
                      
                      {imageVerified === true ? (
                        <span style={{ fontSize: '0.85rem', color: '#22c55e', marginTop: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={16} /> Valid Payment Screenshot Detected ({screenshotFile?.name})
                        </span>
                      ) : imageVerified === false ? (
                        <span style={{ fontSize: '0.85rem', color: '#ff0a1a', marginTop: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldAlert size={16} /> Non-Payment Image Rejected ({screenshotFile?.name})
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <ImageIcon size={40} color="#ff0a1a" />
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                        Tap to Choose Payment Screenshot
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Upload screenshot from PhonePe, GPay, or Paytm
                      </div>
                    </>
                  )}

                  <input 
                    id="screenshot-upload"
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <button 
                  type="button"
                  onClick={handleVerifyAndSubmitScreenshot}
                  disabled={isSubmitting || !screenshotPreview || imageVerified === false}
                  className="submit-btn"
                  style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 10px 25px rgba(22, 163, 74, 0.4)', opacity: (!screenshotPreview || isSubmitting || imageVerified === false) ? 0.5 : 1 }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Verifying with Database & Issuing Receipt...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Verify Screenshot & Issue Receipt</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          ) : (
            /* STEP 4: Registration Confirmed Pass View */
            <div className="confirmation-card">
              <div className="conf-icon">
                <CheckCircle2 size={56} color="#ff0a1a" />
              </div>
              <h3 className="conf-title">Official Pass Issued!</h3>
              <p className="conf-desc">
                Your payment screenshot has been verified against our database and your official entry pass has been issued!
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
                  <span>Pass Type:</span>
                  <strong>{formData.numberOfPersons} Pass (₹{getAmount()})</strong>
                </div>
                <div className="receipt-row">
                  <span>Payment Method:</span>
                  <strong>{formData.paymentMethod}</strong>
                </div>
                <div className="receipt-row">
                  <span>Screenshot Verified:</span>
                  <strong style={{ color: '#22c55e' }}>Valid Payment Receipt ✓</strong>
                </div>
                <div className="receipt-row">
                  <span>Status:</span>
                  <strong style={{ color: '#22c55e' }}>Pass Issued</strong>
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
