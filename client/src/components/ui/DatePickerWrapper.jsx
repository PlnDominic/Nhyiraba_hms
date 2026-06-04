import React, { Component, useCallback, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format, isSameDay } from 'date-fns';
import { datePickerConfig } from '../../utils/dateUtils';

/**
 * Error boundary specifically for DatePicker components
 */
class DatePickerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('DatePicker Error:', error, errorInfo);
  }

  render() {
    const { isDarkMode, onChange, selected, field, error, children } = this.props;
    
    if (this.state.hasError) {
      return (
        <div className={`w-full h-10 px-3 py-2 rounded-md border ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'} ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'}`}>
          <div className="flex items-center justify-between">
            <div className="text-sm text-red-500">Error displaying date picker</div>
            <button 
              onClick={() => onChange(null)} 
              className={`ml-2 text-sm ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Clear
            </button>
          </div>
          {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
        </div>
      );
    }

    return children;
  }
}

/**
 * A wrapper for DatePicker that adds error handling
 */
const DatePickerWrapper = ({
  selected, 
  onChange, 
  isDarkMode, 
  field,
  error,
  ...props
}) => {
  const calendarClassName = useMemo(
    () => `datepicker-theme ${isDarkMode ? 'datepicker-theme-dark' : 'datepicker-theme-light'}`,
    [isDarkMode]
  );

  const popperClassName = useMemo(
    () => `datepicker-popper ${isDarkMode ? 'datepicker-popper-dark' : 'datepicker-popper-light'}`,
    [isDarkMode]
  );

  const dayClassName = useCallback(
    (date) => {
      if (!(date instanceof Date) || isNaN(date.getTime())) return 'datepicker-day';

      const classes = ['datepicker-day'];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isSameDay(date, today)) {
        classes.push('datepicker-day--today');
      }

      if (date.getDay() === 0 || date.getDay() === 6) {
        classes.push('datepicker-day--weekend');
      }

      return classes.join(' ');
    },
    []
  );

  const renderHeader = useCallback(({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }) => (
    <div className="datepicker-header">
      <button
        type="button"
        onClick={decreaseMonth}
        className="datepicker-nav-button"
        disabled={prevMonthButtonDisabled}
        aria-label="Previous month"
      >
        <i className="fas fa-chevron-left" />
      </button>
      <div className="datepicker-header__label">{format(date, 'MMMM yyyy')}</div>
      <button
        type="button"
        onClick={increaseMonth}
        className="datepicker-nav-button"
        disabled={nextMonthButtonDisabled}
        aria-label="Next month"
      >
        <i className="fas fa-chevron-right" />
      </button>
    </div>
  ), []);

  return (
    <DatePickerErrorBoundary isDarkMode={isDarkMode} onChange={onChange} selected={selected} field={field} error={error}>
      <DatePicker
        selected={selected}
        onChange={onChange}
        className={`w-full h-10 px-3 py-2 rounded-md border ${error ? 'border-red-500' : isDarkMode ? 'border-gray-600' : 'border-gray-300'} ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} focus:outline-none focus:ring-2 focus:ring-blue-400`}
        wrapperClassName="w-full"
        calendarClassName={calendarClassName}
        popperClassName={popperClassName}
        dayClassName={dayClassName}
        renderCustomHeader={renderHeader}
        {...datePickerConfig}
        {...props}
      />
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </DatePickerErrorBoundary>
  );
};

export default DatePickerWrapper; 