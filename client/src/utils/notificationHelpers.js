import supabase from '../supabaseClient';

/**
 * Notification Helpers for Nhyiraba Hotel Management System
 * Common notification scenarios for hotel operations
 */

// ============================================
// RESERVATION NOTIFICATIONS
// ============================================

/**
 * Notify staff about new reservation
 */
export const notifyNewReservation = async (reservationData) => {
  try {
    // Notify reception staff
    await supabase.rpc('send_notification_to_department', {
      department_name: 'Reception',
      notification_title: 'New Reservation',
      notification_body: `New reservation for Room ${reservationData.roomNumber} - ${reservationData.guestName}`,
      notification_type: 'info',
      notification_url: '/reservations',
      notification_data: { reservationId: reservationData.id }
    });

    // Notify managers
    await supabase.rpc('send_notification_to_role', {
      user_role: 'manager',
      notification_title: 'New Reservation',
      notification_body: `${reservationData.guestName} - Room ${reservationData.roomNumber}`,
      notification_type: 'info',
      notification_url: '/reservations'
    });

    return true;
  } catch (error) {
    console.error('Error sending reservation notification:', error);
    return false;
  }
};

/**
 * Notify about check-in
 */
export const notifyCheckIn = async (guestName, roomNumber) => {
  try {
    await supabase.rpc('send_notification_to_department', {
      department_name: 'Housekeeping',
      notification_title: 'Guest Checked In',
      notification_body: `${guestName} checked into Room ${roomNumber}`,
      notification_type: 'success',
      notification_url: '/rooms'
    });

    return true;
  } catch (error) {
    console.error('Error sending check-in notification:', error);
    return false;
  }
};

/**
 * Notify about check-out
 */
export const notifyCheckOut = async (guestName, roomNumber) => {
  try {
    await supabase.rpc('send_notification_to_department', {
      department_name: 'Housekeeping',
      notification_title: 'Guest Checked Out',
      notification_body: `Room ${roomNumber} needs cleaning - ${guestName} checked out`,
      notification_type: 'warning',
      notification_url: '/tasks'
    });

    return true;
  } catch (error) {
    console.error('Error sending check-out notification:', error);
    return false;
  }
};

// ============================================
// HOUSEKEEPING NOTIFICATIONS
// ============================================

/**
 * Notify about new cleaning task
 */
export const notifyNewTask = async (taskData, assigneeId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: assigneeId,
        title: 'New Task Assigned',
        body: `${taskData.description} - Room ${taskData.room}`,
        type: taskData.priority === 'High' ? 'warning' : 'info',
        url: '/tasks',
        data: { taskId: taskData.id }
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending task notification:', error);
    return false;
  }
};

/**
 * Notify about task completion
 */
export const notifyTaskCompleted = async (taskData, managerId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: managerId,
        title: 'Task Completed',
        body: `${taskData.description} - Room ${taskData.room} completed`,
        type: 'success',
        url: '/tasks',
        data: { taskId: taskData.id }
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending task completion notification:', error);
    return false;
  }
};

// ============================================
// INVENTORY NOTIFICATIONS
// ============================================

/**
 * Notify about low stock
 */
export const notifyLowStock = async (itemName, currentStock, reorderPoint) => {
  try {
    await supabase.rpc('send_notification_to_role', {
      user_role: 'manager',
      notification_title: 'Low Stock Alert',
      notification_body: `${itemName} is low (${currentStock}/${reorderPoint})`,
      notification_type: 'warning',
      notification_url: '/inventory'
    });

    return true;
  } catch (error) {
    console.error('Error sending low stock notification:', error);
    return false;
  }
};

/**
 * Notify about inventory request
 */
export const notifyInventoryRequest = async (requestData) => {
  try {
    await supabase.rpc('send_notification_to_role', {
      user_role: 'manager',
      notification_title: 'New Inventory Request',
      notification_body: `${requestData.requesterName} requested ${requestData.itemCount} items`,
      notification_type: 'info',
      notification_url: '/inventory',
      notification_data: { requestId: requestData.id }
    });

    return true;
  } catch (error) {
    console.error('Error sending inventory request notification:', error);
    return false;
  }
};

/**
 * Notify about inventory request approval
 */
export const notifyInventoryRequestApproved = async (requestData, requesterId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: requesterId,
        title: 'Request Approved',
        body: `Your inventory request has been approved`,
        type: 'success',
        url: '/tasks',
        data: { requestId: requestData.id }
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending approval notification:', error);
    return false;
  }
};

// ============================================
// RESTAURANT/BAR NOTIFICATIONS
// ============================================

/**
 * Notify about new order
 */
export const notifyNewOrder = async (orderData, barLocation) => {
  try {
    // Get staff assigned to this bar location
    const { data: staff, error: staffError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('raw_user_meta_data->>department', 'Food & Beverage')
      .eq('raw_user_meta_data->>assigned_location', barLocation);

    if (staffError) throw staffError;

    if (staff && staff.length > 0) {
      const userIds = staff.map(s => s.id);
      
      const { error } = await supabase
        .from('notifications')
        .insert(
          userIds.map(userId => ({
            user_id: userId,
            title: 'New Order',
            body: `New order at ${barLocation} - ${orderData.itemCount} items`,
            type: 'info',
            url: '/restaurant',
            data: { orderId: orderData.id }
          }))
        );

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error sending order notification:', error);
    return false;
  }
};

/**
 * Notify about order ready
 */
export const notifyOrderReady = async (orderData, guestId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: guestId,
        title: 'Order Ready',
        body: `Your order is ready for pickup/delivery`,
        type: 'success',
        url: '/orders',
        data: { orderId: orderData.id }
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending order ready notification:', error);
    return false;
  }
};

// ============================================
// MAINTENANCE NOTIFICATIONS
// ============================================

/**
 * Notify about maintenance request
 */
export const notifyMaintenanceRequest = async (requestData) => {
  try {
    await supabase.rpc('send_notification_to_department', {
      department_name: 'Maintenance',
      notification_title: 'Maintenance Request',
      notification_body: `${requestData.description} - Room ${requestData.roomNumber}`,
      notification_type: 'warning',
      notification_url: '/services',
      notification_data: { requestId: requestData.id }
    });

    return true;
  } catch (error) {
    console.error('Error sending maintenance notification:', error);
    return false;
  }
};

// ============================================
// BILLING NOTIFICATIONS
// ============================================

/**
 * Notify about payment received
 */
export const notifyPaymentReceived = async (paymentData, managerId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: managerId,
        title: 'Payment Received',
        body: `GH₵${paymentData.amount} received from ${paymentData.guestName}`,
        type: 'success',
        url: '/billing',
        data: { paymentId: paymentData.id }
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending payment notification:', error);
    return false;
  }
};

/**
 * Notify about overdue payment
 */
export const notifyOverduePayment = async (invoiceData) => {
  try {
    await supabase.rpc('send_notification_to_role', {
      user_role: 'manager',
      notification_title: 'Overdue Payment',
      notification_body: `Invoice #${invoiceData.invoiceNumber} is overdue - GH₵${invoiceData.amount}`,
      notification_type: 'error',
      notification_url: '/billing',
      notification_data: { invoiceId: invoiceData.id }
    });

    return true;
  } catch (error) {
    console.error('Error sending overdue payment notification:', error);
    return false;
  }
};

// ============================================
// STAFF NOTIFICATIONS
// ============================================

/**
 * Notify about shift start
 */
export const notifyShiftStart = async (staffId, shiftData) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: staffId,
        title: 'Shift Starting Soon',
        body: `Your shift starts in 30 minutes - ${shiftData.startTime}`,
        type: 'info',
        url: '/time-attendance',
        data: { shiftId: shiftData.id }
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending shift notification:', error);
    return false;
  }
};

/**
 * Notify about shift end
 */
export const notifyShiftEnd = async (staffId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: staffId,
        title: 'Shift Ending Soon',
        body: `Your shift ends in 15 minutes. Please complete handover.`,
        type: 'warning',
        url: '/time-attendance'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending shift end notification:', error);
    return false;
  }
};

// ============================================
// SYSTEM NOTIFICATIONS
// ============================================

/**
 * Notify about system update
 */
export const notifySystemUpdate = async () => {
  try {
    // Notify all users
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id');

    if (usersError) throw usersError;

    if (users && users.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .insert(
          users.map(user => ({
            user_id: user.id,
            title: 'System Update Available',
            body: 'A new version is available. Please refresh to update.',
            type: 'info',
            url: '/'
          }))
        );

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error sending system update notification:', error);
    return false;
  }
};

/**
 * Notify about scheduled maintenance
 */
export const notifyScheduledMaintenance = async (maintenanceData) => {
  try {
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id');

    if (usersError) throw usersError;

    if (users && users.length > 0) {
      const { error } = await supabase
        .from('notifications')
        .insert(
          users.map(user => ({
            user_id: user.id,
            title: 'Scheduled Maintenance',
            body: `System maintenance scheduled for ${maintenanceData.date} at ${maintenanceData.time}`,
            type: 'warning',
            url: '/'
          }))
        );

      if (error) throw error;
    }

    return true;
  } catch (error) {
    console.error('Error sending maintenance notification:', error);
    return false;
  }
};

export default {
  // Reservations
  notifyNewReservation,
  notifyCheckIn,
  notifyCheckOut,
  
  // Housekeeping
  notifyNewTask,
  notifyTaskCompleted,
  
  // Inventory
  notifyLowStock,
  notifyInventoryRequest,
  notifyInventoryRequestApproved,
  
  // Restaurant/Bar
  notifyNewOrder,
  notifyOrderReady,
  
  // Maintenance
  notifyMaintenanceRequest,
  
  // Billing
  notifyPaymentReceived,
  notifyOverduePayment,
  
  // Staff
  notifyShiftStart,
  notifyShiftEnd,
  
  // System
  notifySystemUpdate,
  notifyScheduledMaintenance
};
