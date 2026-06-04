import supabase from '../supabaseClient';

/**
 * Synchronizes room status with guest data.
 * Finds rooms that are marked as 'Occupied' but have no corresponding active guest.
 * Resets those rooms to 'Available'.
 */
export const syncRoomStatus = async () => {
    console.log('Starting room status synchronization...');
    const results = {
        totalChecked: 0,
        fixed: 0,
        errors: []
    };

    try {
        // 1. Get all rooms that are currently 'Occupied'
        const { data: occupiedRooms, error: roomsError } = await supabase
            .from('rooms')
            .select('id, room_number, status')
            .eq('status', 'Occupied');

        if (roomsError) throw roomsError;

        console.log(`Found ${occupiedRooms.length} occupied rooms.`);
        results.totalChecked = occupiedRooms.length;

        // 2. Get all active guests (checked in)
        const { data: activeGuests, error: guestsError } = await supabase
            .from('guests')
            .select('room')
            .neq('status', 'Checked Out');

        if (guestsError) throw guestsError;

        // Create a set of occupied room IDs from the guests table
        const occupiedRoomIds = new Set(activeGuests.map(g => String(g.room)));
        console.log(`Found ${activeGuests.length} active guests.`);

        // 3. Find rooms that are Occupied but not in the active guests list
        const ghostRooms = occupiedRooms.filter(room => !occupiedRoomIds.has(String(room.id)));

        console.log(`Found ${ghostRooms.length} ghost rooms (Occupied but no guest).`, ghostRooms);

        // 4. Fix the ghost rooms
        for (const room of ghostRooms) {
            try {
                console.log(`Fixing room ${room.id} (Room ${room.room_number})...`);
                const { error: updateError } = await supabase
                    .from('rooms')
                    .update({
                        status: 'Available',
                        guest: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', room.id);

                if (updateError) {
                    console.error(`Failed to fix room ${room.id}:`, updateError);
                    results.errors.push(`Room ${room.room_number}: ${updateError.message}`);
                } else {
                    results.fixed++;
                }
            } catch (err) {
                console.error(`Exception fixing room ${room.id}:`, err);
                results.errors.push(`Room ${room.room_number}: ${err.message}`);
            }
        }

        // 5. Get all rooms that are currently 'Reserved'
        const { data: reservedRooms, error: reservedRoomsError } = await supabase
            .from('rooms')
            .select('id, room_number, status')
            .eq('status', 'Reserved');

        if (reservedRoomsError) throw reservedRoomsError;

        console.log(`Found ${reservedRooms.length} reserved rooms.`);
        results.totalChecked += reservedRooms.length;

        if (reservedRooms.length > 0) {
            // 6. Get all active reservations
            const { data: activeReservations, error: reservationsError } = await supabase
                .from('reservations')
                .select('room_id')
                .in('status', ['Reserved', 'Confirmed']);

            if (reservationsError) throw reservationsError;

            const reservedRoomIds = new Set(activeReservations.map(r => String(r.room_id)));
            console.log(`Found ${activeReservations.length} active reservations.`);

            // 7. Find rooms that are Reserved but not in the active reservations list
            const ghostReservations = reservedRooms.filter(room => !reservedRoomIds.has(String(room.id)));

            console.log(`Found ${ghostReservations.length} ghost reservations.`, ghostReservations);

            // 8. Fix the ghost reservations
            for (const room of ghostReservations) {
                try {
                    console.log(`Fixing room ${room.id} (Room ${room.room_number})...`);
                    const { error: updateError } = await supabase
                        .from('rooms')
                        .update({
                            status: 'Available',
                            guest: null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', room.id);

                    if (updateError) {
                        console.error(`Failed to fix room ${room.id}:`, updateError);
                        results.errors.push(`Room ${room.room_number}: ${updateError.message}`);
                    } else {
                        results.fixed++;
                    }
                } catch (err) {
                    console.error(`Exception fixing room ${room.id}:`, err);
                    results.errors.push(`Room ${room.room_number}: ${err.message}`);
                }
            }
        }

        return {
            success: true,
            message: `Sync complete. Fixed ${results.fixed} rooms.`,
            results
        };

    } catch (error) {
        console.error('Error during room sync:', error);
        return {
            success: false,
            message: error.message,
            results
        };
    }
};
