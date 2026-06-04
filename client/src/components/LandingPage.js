import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';


function LandingPage() {
  const { setCurrentUser } = useUser();
  const navigate = useNavigate();
  const [showLoginOptions, setShowLoginOptions] = useState(false);

  // Function to login as admin or manager
  const handleLogin = (role) => {
    setCurrentUser({
      id: `demo-${role}-id`,
      email: `${role}@example.com`,
      role: role,
      fullName: `${role.charAt(0).toUpperCase() + role.slice(1)} User`,
      position: role === 'admin' ? 'Administrator' : 'Hotel Manager',
      department: 'Management',
      contactNumber: '123-456-7890',
      avatar_url: null
    });

    // Redirect to the appropriate page
    if (role === 'admin') {
      navigate('/admin/access-control');
    } else if (role === 'manager') {
      navigate('/manager/access-control');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div 
      className="landing-page relative min-h-screen flex flex-col"
      style={{
        background: '#e94e00',
      }}
    >


      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-md lg:max-w-4xl">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            
            {/* Content Section */}
            <div className="w-full lg:w-1/2 text-center lg:text-left space-y-6">
              
              {/* Logo Container - Matching Splash Screen */}
              <div className="flex justify-center lg:justify-start mb-4">
                <div 
                  className="bg-white p-6 shadow-2xl border-4"
                  style={{
                    borderRadius: '16px',
                    borderColor: '#ffffff',
                  }}
                >
                  <img
                    src="/logo256.png"
                    alt="Nhyiraba Hotel Logo"
                    className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                  />
                </div>
              </div>

              {/* Hotel Name - Extra Bold like Splash Screen */}
              <h1 
                className="text-white text-4xl sm:text-5xl lg:text-6xl mb-2"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: '900',
                  textShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              >
                Nhyiraba
              </h1>

              {/* Subtitle */}
              <h2 className="text-white/90 text-xl sm:text-2xl font-light tracking-wide">
                Hotel Management System
              </h2>

              {/* Decorative Line */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-white to-transparent w-full max-w-xs mx-auto lg:mx-0" />

              {/* Description */}
              <p className="text-white/80 text-base sm:text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
                Experience the future of hotel management with our comprehensive solution designed for modern establishments.
              </p>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center lg:justify-start">
                <Link 
                  to="/login" 
                  className="bg-white text-orange-600 hover:bg-orange-50 px-8 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                  style={{ color: '#e94e00' }}
                >
                  <i className="fas fa-sign-in-alt"></i>
                  <span>Login to Dashboard</span>
                </Link>
                <Link 
                  to="/request-access" 
                  className="bg-transparent border-2 border-white text-white hover:bg-white/10 px-8 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-user-plus"></i>
                  <span>Request Access</span>
                </Link>
              </div>


            </div>

            {/* Image Section - Desktop Only */}
            <div className="hidden lg:block w-full lg:w-1/2">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20">
                <img
                  src="/hero1.jpg"
                  alt="Luxury Hotel - Nhyiraba Hotel"
                  className="w-full h-auto object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full text-sm font-medium">
                    <i className="fas fa-star text-yellow-400"></i>
                    <span>Luxury Hotel Experience</span>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* Footer Text */}
      <div className="text-center pb-6 px-4">
        <p className="text-white/60 text-sm">
          Powered by <span className="font-semibold text-white">Ecstasy Geospatial Services</span>
        </p>
      </div>
    </div>
  );
}

export default LandingPage;
