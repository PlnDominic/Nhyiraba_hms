// Where the app's own API lives (SMS endpoints). Shared by the SMS service and the sync engine.
export const API_BASE_URL = process.env.REACT_APP_API_URL
  || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api');
