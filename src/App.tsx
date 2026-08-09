import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ExternalLink } from 'lucide-react';
import confetti from 'canvas-confetti';
import RegistrationModal from './components/RegistrationModal';

const WhatsAppIcon = ({ className = "whatsapp-icon" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width="24" 
    height="24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M19.05 4.91A9.816 9.816 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.217 8.217 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.197 8.197 0 0 1 2.41 5.83c.02 4.54-3.68 8.23-8.22 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.8-.23-.09-.39-.12-.56.12-.17.25-.66.8-.81.97-.15.17-.3.19-.55.07-.25-.12-1.05-.39-2.01-1.24-.74-.66-1.25-1.48-1.39-1.73-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43s-.56-1.35-.77-1.85c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.12.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.6.19 1.15.16 1.59.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3z"/>
  </svg>
);

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const whatsappUrl = import.meta.env.VITE_WHATSAPP_URL || 'https://wa.me/919398435150?text=Hi!%20I%20have%20a%20query%20about%20Veega%20Rave%202026';

  useEffect(() => {
    // Default dark theme for pitch black background
    document.body.className = 'theme-dark';
  }, []);

  const handleButtonHover = () => {
    confetti({
      particleCount: 25,
      spread: 60,
      origin: { y: 0.5 },
      colors: ['#ff0a1a', '#ffffff', '#ffd700']
    });
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalOpen(true);
  };

  return (
    <div className="app-container theme-dark">
      
      {/* Background Ambient Spotlight */}
      <div className="bg-spotlight">
        <div className="spotlight-orb" />
      </div>

      {/* Focused Poster Container */}
      <main className="poster-main">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="poster-card"
        >
          <div style={{ position: 'relative', width: '100%' }}>
            {/* Top Right WhatsApp Button inside Poster Card */}
            <motion.a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-btn-poster"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Contact us on WhatsApp"
              title="Contact us on WhatsApp"
            >
              <WhatsAppIcon />
            </motion.a>

            {/* Poster Image */}
            <img 
              src="/landing pic.PNG" 
              alt="VEEGA RAVE 2026 Poster" 
              className="poster-img"
            />

            {/* Pulse Ring Animation Behind Button */}
            <div className="pulse-ring" />

            {/* CENTERED INTERACTIVE "get Launch" BUTTON WRAPPER */}
            <div className="btn-wrapper">
              <motion.button
                type="button"
                onClick={handleButtonClick}
                onMouseEnter={handleButtonHover}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="btn-get-launch"
              >
                <Sparkles className="btn-icon" />
                <span>get Launch</span>
                <ExternalLink className="btn-icon" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Interactive Registration Modal */}
      <RegistrationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        theme="dark"
      />

    </div>
  );
}
