// Professional Reports Component - Enhanced version with real data
// This is a wrapper that uses the enhanced reporting system

import React from 'react';
import EnhancedReportsWithRealData from './EnhancedReportsWithRealData';

const ProfessionalReports = () => {
  React.useEffect(() => {
    console.log('[Reports] Mounted ProfessionalReports wrapper at', new Date().toISOString());
  }, []);
  return <EnhancedReportsWithRealData />;
};

export default ProfessionalReports;
