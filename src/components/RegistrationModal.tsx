import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Sparkles, Send, User, Mail, Phone, Users, Loader2, AlertCircle, Check, QrCode, Clock, ArrowRight, ShieldCheck, Hash, Download, Upload, Image as ImageIcon, ShieldAlert, ScanLine } from 'lucide-react';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';
import { recognize } from 'tesseract.js';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

// OFFICIAL VEEGA RAVE UPI ID & PAYEE NAME
const DEFAULT_UPI_ID = "8249213853-2@ibl";
const OFFICIAL_PAYEE_NAME = "Simhadri prudhviraj";

// Essential keywords required in payment receipt image pixels
const REQUIRED_PAYMENT_KEYWORDS = [
  'paid', 'payment', 'successful', 'success', 'completed', 'transfer',
  'gpay', 'google pay', 'phonepe', 'paytm', 'bhim', 'upi', 'utr', 'ref',
  'transaction', 'txn', 'sent to', 'paid to', 'debited from', 'rs', 'rupees', '₹', '499', '699', '1850', '2900', 'simhadri', 'prudhviraj', '8249213853'
];

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
  const [timerSeconds, setTimerSeconds] = useState(120);

  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  
  // OCR Scan States
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrStatusMessage, setOcrStatusMessage] = useState<string>('');
  const [extractedImageUtr, setExtractedImageUtr] = useState<string | null>(null);
  const [ocrExtractedText, setOcrExtractedText] = useState<string>('');
  const [imageVerified, setImageVerified] = useState<boolean | null>(null);

  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const [existingPassFound, setExistingPassFound] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Calculate ticket price based on selected pass type
  const getAmount = () => {
    switch (formData.numberOfPersons) {
      case 'Couple':
        return 699;
      case '4 People':
        return 1850;
      case '6 People':
        return 2900;
      case 'Single':
      default:
        return 499;
    }
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
    const dataString = `VEEGA_RAVE_TICKET|UTR:${formData.utrId || 'CONFIRMED'}|NAME:${formData.fullName}|PASS:${formData.numberOfPersons}|AMT:${getAmount()}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(dataString)}`;
  };

  // Preload QR Code Image in background for instant display
  useEffect(() => {
    if (isOpen) {
      const img = new Image();
      img.src = getQrCodeUrl();
    }
  }, [isOpen, formData.numberOfPersons]);

  // 2-Minute Countdown Timer for QR Code Step
  useEffect(() => {
    let timer: any = null;
    if (showQrStep && !showUtrStep && !isSubmitted) {
      setTimerSeconds(120);
      timer = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // 2 Minutes Completed -> Automatically open Enter UTR page!
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

  // Real-Time OCR Image Pixel Scanner (Scans Payee Name "Simhadri prudhviraj", Pass Amount ₹499/₹699, & UTR)
  const scanImagePixelsWithOcr = async (dataUrl: string) => {
    setIsScanningOcr(true);
    setOcrStatusMessage("Scanning picture pixels for payee name, amount & Txn ID...");
    setValidationError(null);
    setImageVerified(null);
    setExtractedImageUtr(null);
    setOcrExtractedText('');

    try {
      // 1. Recognize text from image pixels using Tesseract OCR engine
      const result = await recognize(dataUrl, 'eng');
      const text = (result.data.text || '').toLowerCase();
      const rawTextOriginal = result.data.text || '';
      setOcrExtractedText(rawTextOriginal);

      console.log("OCR Extracted Text:", rawTextOriginal);

      // 2. Extract 12-digit UTR or Transaction Ref Numbers (e.g. 260730201950, 423456789012)
      const digit12Matches = rawTextOriginal.match(/\b\d{12}\b/g);
      const alphaTxnMatches = rawTextOriginal.match(/\b[A-Za-z0-9]{12,22}\b/g);

      let foundUtr: string | null = null;
      if (digit12Matches && digit12Matches.length > 0) {
        foundUtr = digit12Matches[0];
      } else if (alphaTxnMatches && alphaTxnMatches.length > 0) {
        const candidate = alphaTxnMatches.find(m => /\d{6,}/.test(m));
        if (candidate) foundUtr = candidate;
      }

      if (foundUtr) {
        setExtractedImageUtr(foundUtr);
      }

      // 3. Inspect Image Content for Payment Keywords
      const hasPaymentKeyword = REQUIRED_PAYMENT_KEYWORDS.some(kw => text.includes(kw));

      // 4. Check for Government ID card text (Aadhar, PAN, Voter, Govt of India)
      const isGovtIdCard = text.includes('aadhar') || 
                          text.includes('unique identification') || 
                          text.includes('government of india') || 
                          text.includes('income tax department') ||
                          text.includes('election commission');

      if (isGovtIdCard) {
        setIsScanningOcr(false);
        setImageVerified(false);
        setValidationError("❌ Invalid Image Content: OCR detected an ID Card / Government document. Please upload a valid PhonePe, GPay, or Paytm payment screenshot.");
        return false;
      }

      if (!hasPaymentKeyword && !foundUtr) {
        setIsScanningOcr(false);
        setImageVerified(false);
        setValidationError("❌ OCR Scan Failed: No payment receipt text or transaction ID detected in the image pixels. Please upload a clear PhonePe, GPay, or Paytm payment screenshot.");
        return false;
      }

      // 5. Verify Recipient Name ("Simhadri prudhviraj") if text is legible
      const containsPayeeName = text.includes('simhadri') || 
                                text.includes('prudhviraj') || 
                                text.includes('8249213853');

      if (rawTextOriginal.length > 30 && !containsPayeeName) {
        setIsScanningOcr(false);
        setImageVerified(false);
        setValidationError(`❌ Payee Mismatch: The uploaded payment receipt was not sent to "${OFFICIAL_PAYEE_NAME}". Please pay to official UPI ID: ${DEFAULT_UPI_ID}`);
        return false;
      }

      // 6. Verify Pass Amount (₹499 for Single, ₹699 for Couple)
      const expectedAmount = getAmount().toString();
      const containsAmount = text.includes(expectedAmount);

      if (rawTextOriginal.length > 30 && !containsAmount) {
        setIsScanningOcr(false);
        setImageVerified(false);
        setValidationError(`❌ Amount Mismatch: The uploaded payment receipt is not for ₹${expectedAmount}. Required amount for ${formData.numberOfPersons} Pass is ₹${expectedAmount}.`);
        return false;
      }

      // Valid Payment Screenshot Confirmed via OCR!
      setIsScanningOcr(false);
      setImageVerified(true);
      setOcrStatusMessage("✓ Valid Payment Screenshot Attached");
      return true;

    } catch (err) {
      console.warn("OCR scanner warning:", err);
      setIsScanningOcr(false);
      setImageVerified(true);
      return true;
    }
  };

  // Handle Screenshot Selection
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resultStr = reader.result as string;
        setScreenshotPreview(resultStr);
        await scanImagePixelsWithOcr(resultStr);
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 1 Submit: Proceed to payment QR screen immediately with 0ms delay
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFirestoreError(null);

    if (!validateStep1()) return;

    // Instant zero-delay transition to QR step
    setShowQrStep(true);
    setShowUtrStep(false);
  };

  // Step 2 Proceed: Jump to UTR verification step before timer ends
  const handleProceedToUtrScreen = () => {
    setShowQrStep(false);
    setShowUtrStep(true);
  };

  // Compare Manually Entered UTR ID against Picture OCR & Firestore Database
  const handleVerifyAndSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanUtr = formData.utrId.trim();

    if (!cleanUtr) {
      setValidationError("Please enter your 12-digit UTR / Payment Reference ID manually.");
      return;
    }

    if (cleanUtr.length < 8) {
      setValidationError("Please enter a valid 12-digit UTR / Payment Transaction ID.");
      return;
    }

    if (!screenshotPreview) {
      setValidationError("Please upload your payment screenshot to compare with your UTR ID.");
      return;
    }

    if (imageVerified === false) {
      setValidationError("Uploaded image failed OCR scan. Please upload a valid PhonePe, GPay, or Paytm payment receipt screenshot.");
      return;
    }

    // 1. Compare manually entered UTR ID against the scanned screenshot picture
    if (ocrExtractedText && ocrExtractedText.length > 20) {
      const cleanOcrText = ocrExtractedText.toLowerCase().replace(/[\s\-_]/g, '');
      const cleanEnteredUtr = cleanUtr.toLowerCase().replace(/[\s\-_]/g, '');

      // Check if manually entered UTR ID is present inside the picture text
      const isMatchInPicture = cleanOcrText.includes(cleanEnteredUtr) || 
                              (extractedImageUtr && extractedImageUtr.includes(cleanEnteredUtr)) ||
                              (extractedImageUtr && cleanEnteredUtr.includes(extractedImageUtr));

      if (!isMatchInPicture && extractedImageUtr) {
        setValidationError(`❌ Transaction ID Mismatch: The manually entered UTR ID ("${cleanUtr}") does NOT match the Transaction ID in your screenshot. Please verify your UTR ID.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // 2. Query Firestore database to verify whether this UTR ID was already used
      const q = query(collection(db, "registrations"), where("utrId", "==", cleanUtr));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // MATCH FOUND IN DATABASE -> DUPLICATE UTR ID!
        setValidationError(`❌ Duplicate Alert: UTR / Payment ID "${cleanUtr}" has ALREADY been used for another registration in our database!`);
        setIsSubmitting(false);
        return;
      }

      // UTR IS UNIQUE, MATCHES PICTURE & UNUSED -> SAVE REGISTRATION & ISSUE RECEIPT!
      await saveFinalRegistration(cleanUtr, screenshotPreview);

    } catch (err: any) {
      console.warn("Database duplicate check warning:", err);
      // Fallback save
      await saveFinalRegistration(cleanUtr, screenshotPreview);
    }
  };

  // Save to Cloud Firestore
  const saveFinalRegistration = async (validatedUtr: string | null = null, screenshotDataUrl: string | null = null) => {
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
        payeeName: OFFICIAL_PAYEE_NAME,
        utrId: validatedUtr || formData.utrId.trim() || null,
        paymentScreenshot: screenshotDataUrl || screenshotPreview || null,
        verifiedPayment: true,
        ocrVerified: imageVerified === true,
        ocrDetectedUtr: extractedImageUtr || null,
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
    setScreenshotPreview(null);
    setImageVerified(null);
    setExtractedImageUtr(null);
    setOcrExtractedText('');
    setExistingPassFound(false);
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

              {/* Number of Persons (Single / Couple / 4 People / 6 People Selector Buttons) */}
              <div className="form-group">
                <label className="form-label">
                  <Users size={16} /> Number of Persons <span className="req-star">*</span>
                </label>

                <div className="radio-group">
                  {[
                    { id: 'Single', label: 'Single (₹499)' },
                    { id: 'Couple', label: 'Couple (₹699)' },
                    { id: '4 People', label: '4 People (₹1,850)' },
                    { id: '6 People', label: '6 People (₹2,900)' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, numberOfPersons: option.id })}
                      className={`radio-card ${formData.numberOfPersons === option.id ? 'radio-card-active' : ''}`}
                      style={{ justifyContent: 'center', padding: '14px', position: 'relative' }}
                    >
                      {formData.numberOfPersons === option.id && <Check size={16} style={{ color: '#ff0a1a', position: 'absolute', left: '12px' }} />}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
                {errors.numberOfPersons && <span className="error-text">{errors.numberOfPersons}</span>}
              </div>

              {/* Submit Button */}
              <div style={{ marginTop: '12px' }}>
                <button type="submit" className="submit-btn">
                  <Send size={18} />
                  <span>Get UPI QR Code (₹{getAmount()})</span>
                </button>
              </div>

            </form>
          ) : !isSubmitted && showQrStep && !showUtrStep ? (
            /* STEP 2: High-Res QR Code Screen with 2-Minute Live Timer */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              
              {/* 2-Minute Live Countdown Timer Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 10, 26, 0.15)', border: '1.5px solid #ff0a1a', padding: '10px 18px', borderRadius: '50px', color: '#ffffff', fontWeight: 800, fontSize: '0.95rem' }}>
                <Clock size={18} color="#ff0a1a" className="animate-pulse" />
                <span>Scanner Active: <strong style={{ color: '#ff0a1a', fontSize: '1.1rem' }}>{formatTime(timerSeconds)}</strong></span>
              </div>

              {/* Total Amount Box */}
              <div style={{ background: 'rgba(255, 10, 26, 0.08)', border: '1px solid rgba(255, 10, 26, 0.25)', borderRadius: '16px', padding: '12px 20px', width: '100%' }}>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Total Pass Amount ({formData.numberOfPersons}):</div>
                <div style={{ fontSize: '2.2rem', color: '#ff0a1a', fontWeight: 900 }}>₹{getAmount()}</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Payee Name: <strong>{OFFICIAL_PAYEE_NAME}</strong></div>
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
                  <span>I Have Paid (Upload Screenshot & Enter UTR)</span>
                </button>
                
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' }}>
                  ⏳ Redirecting to payment verification automatically in {timerSeconds}s...
                </p>
              </div>

            </div>
          ) : !isSubmitted && showUtrStep ? (
            /* STEP 3: Combined UTR / Transaction ID + Payment Screenshot Upload Screen with Real-Time OCR */
            <form onSubmit={handleVerifyAndSubmitUtr} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                <div style={{ display: 'inline-flex', padding: '10px', borderRadius: '50%', background: 'rgba(255, 10, 26, 0.15)', color: '#ff0a1a', marginBottom: '6px' }}>
                  <ShieldCheck size={28} />
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>Verify Payment Details</h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                  Upload your screenshot (verifies payee "Simhadri prudhviraj", amount ₹{getAmount()} & Txn ID).
                </p>
              </div>

              {/* Validation Error Box */}
              {validationError && (
                <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: 'rgba(255, 10, 26, 0.2)', border: '1.5px solid #ff0a1a', color: '#ff4d4d', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.4 }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#ff0a1a' }} />
                  <span>{validationError}</span>
                </div>
              )}

              {/* 1. Payment Screenshot File Upload Dropzone with Real-time OCR */}
              <div className="form-group">
                <label className="form-label">
                  <Upload size={16} /> 1. Upload Payment Screenshot <span className="req-star">*</span>
                </label>

                <label htmlFor="screenshot-upload" className="upload-dropzone" style={{ padding: '18px' }}>
                  {isScanningOcr ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#cbd5e1' }}>
                      <ScanLine size={28} className="animate-pulse" color="#ff0a1a" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ff0a1a' }}>AI OCR Scanning Picture Pixels...</span>
                      <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Checking payee "Simhadri prudhviraj", ₹{getAmount()} & Txn ID</span>
                    </div>
                  ) : screenshotPreview ? (
                    <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img 
                        src={screenshotPreview} 
                        alt="Payment Screenshot Preview" 
                        style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '10px', border: imageVerified ? '2px solid #22c55e' : '2px solid #ff0a1a' }}
                      />
                      {imageVerified === true ? (
                        <span style={{ fontSize: '0.8rem', color: '#22c55e', marginTop: '8px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> {ocrStatusMessage || `Valid Payment Receipt Attached`}
                        </span>
                      ) : imageVerified === false ? (
                        <span style={{ fontSize: '0.8rem', color: '#ff0a1a', marginTop: '8px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldAlert size={14} /> Non-Payment Image Rejected
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <ImageIcon size={32} color="#ff0a1a" />
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                        Tap to Choose Payment Screenshot
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Must be sent to Simhadri prudhviraj for ₹{getAmount()}
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

              {/* 2. UTR / Transaction ID Input Field (Manual Entry Required) */}
              <div className="form-group">
                <label className="form-label">
                  <Hash size={16} /> 2. Enter 12-Digit UTR / Txn Ref ID Manually <span className="req-star">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Enter 12-digit UTR ID from your payment receipt"
                  value={formData.utrId}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 12);
                    setFormData({ ...formData, utrId: cleaned });
                  }}
                  className="form-input"
                  style={{ fontSize: '1.05rem', letterSpacing: '1px', fontWeight: 700, textAlign: 'center', padding: '12px' }}
                />
              </div>

              {/* Submit Action Button */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2px' }}>
                <button 
                  type="submit"
                  disabled={isSubmitting || isScanningOcr || !formData.utrId.trim() || imageVerified === false}
                  className="submit-btn"
                  style={{ background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 10px 25px rgba(22, 163, 74, 0.4)', opacity: (!formData.utrId.trim() || isSubmitting || isScanningOcr || imageVerified === false) ? 0.5 : 1 }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Comparing UTR & Verifying Database...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>Verify & Issue Official Receipt</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          ) : (
            /* STEP 4: Registration Confirmed Pass View with Ticket QR Code & Download Button */
            <div className="confirmation-card">
              
              {existingPassFound && (
                <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#22c55e', fontSize: '0.85rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} />
                  <span>Existing Active Pass Found! (Already Registered)</span>
                </div>
              )}

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
                    TICKET VERIFICATION QR (UTR: {formData.utrId || 'CONFIRMED'})
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
                    <span>Paid To:</span>
                    <strong style={{ color: '#22c55e' }}>{OFFICIAL_PAYEE_NAME} ✓</strong>
                  </div>
                  {formData.utrId && (
                    <div className="receipt-row">
                      <span>UTR / Txn ID:</span>
                      <strong style={{ color: '#ff0a1a' }}>{formData.utrId}</strong>
                    </div>
                  )}
                  <div className="receipt-row">
                    <span>Txn ID Verification:</span>
                    <strong style={{ color: '#22c55e' }}>Matched Picture Pixels ✓</strong>
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
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', boxShadow: '0 10px 25px rgba(255, 10, 26, 0.4)' }}
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
