import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Sparkles, Send, User, Mail, Phone, Users, CreditCard, HelpCircle, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLScwOfwR7hWB1A_UBKbesq7f9TCZ7FH6p9GNCDPx0Vj8YU0clQ/viewform?usp=publish-editor";

export default function RegistrationModal({ isOpen, onClose }: RegistrationModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobileNumber: '',
    numberOfPersons: '1',
    paymentMethod: 'UPI',
    referralSource: ''
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required';
    if (!formData.email.trim() || !formData.email.includes('@')) newErrors.email = 'Valid Email is required';
    if (!formData.mobileNumber.trim() || formData.mobileNumber.length < 10) newErrors.mobileNumber = 'Valid 10-digit mobile number required';
    if (!formData.numberOfPersons || parseInt(formData.numberOfPersons) < 1) newErrors.numberOfPersons = 'Number of persons must be at least 1';
    if (!formData.paymentMethod) newErrors.paymentMethod = 'Please select a payment method';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSubmitted(true);
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ff0a1a', '#ffffff', '#ffd700']
      });
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setFormData({
      fullName: '',
      email: '',
      mobileNumber: '',
      numberOfPersons: '1',
      paymentMethod: 'UPI',
      referralSource: ''
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay">
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
              <p className="modal-subtitle">* Indicates required question</p>
            </div>
            <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close modal">
              <X size={20} />
            </button>
          </div>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="modal-form">
              
              {/* Email Record Banner */}
              <div className="account-banner">
                <Mail size={16} className="text-[#ff0a1a]" />
                <span>Record <strong>{formData.email || 'your email'}</strong> as the email to be included with response.</span>
              </div>

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

              {/* Mobile Number */}
              <div className="form-group">
                <label className="form-label">
                  <Phone size={16} /> Mobile Number <span className="req-star">*</span>
                </label>
                <input 
                  type="tel" 
                  placeholder="Enter 10-digit phone number" 
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                  className={`form-input ${errors.mobileNumber ? 'input-error' : ''}`}
                />
                {errors.mobileNumber && <span className="error-text">{errors.mobileNumber}</span>}
              </div>

              {/* Number of Persons */}
              <div className="form-group">
                <label className="form-label">
                  <Users size={16} /> Number of Persons <span className="req-star">*</span>
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="20"
                  value={formData.numberOfPersons}
                  onChange={(e) => setFormData({ ...formData, numberOfPersons: e.target.value })}
                  className={`form-input ${errors.numberOfPersons ? 'input-error' : ''}`}
                />
                {errors.numberOfPersons && <span className="error-text">{errors.numberOfPersons}</span>}
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label className="form-label">
                  <CreditCard size={16} /> Which payment method do you prefer for your entry pass? <span className="req-star">*</span>
                </label>

                <div className="radio-group">
                  {['UPI', 'Credit/Debit Card', 'Net Banking', 'Cash at Venue'].map((method) => (
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

              {/* Referral Source */}
              <div className="form-group">
                <label className="form-label">
                  <HelpCircle size={16} /> How did you hear about the Veega Rave event?
                </label>
                <input 
                  type="text" 
                  placeholder="Instagram, Friends, Poster, Cafe, etc." 
                  value={formData.referralSource}
                  onChange={(e) => setFormData({ ...formData, referralSource: e.target.value })}
                  className="form-input"
                />
              </div>

              {/* Submit Button & Direct Google Form Option */}
              <div className="flex flex-col gap-2 mt-2">
                <button type="submit" className="submit-btn">
                  <Send size={18} />
                  <span>Submit Response</span>
                </button>
                
                <a 
                  href={GOOGLE_FORM_URL} 
                  target="_self"
                  className="text-[#94a3b8] text-xs text-center no-underline flex items-center justify-center gap-1 mt-2 hover:underline"
                >
                  <span>Or open original Google Form</span>
                  <ExternalLink size={14} />
                </a>
              </div>

            </form>
          ) : (
            /* Confirmation Pass View */
            <div className="confirmation-card">
              <div className="conf-icon">
                <CheckCircle2 size={56} color="#ff0a1a" />
              </div>
              <h3 className="conf-title">Registration Submitted!</h3>
              <p className="conf-desc">
                A copy of your responses will be emailed to <strong>{formData.email}</strong>.
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
                  <strong>{formData.numberOfPersons}</strong>
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
