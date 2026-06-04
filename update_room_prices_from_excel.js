const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bviglsgfbwjhioeyhnin.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2aWdsc2dmYndqaGlvZXlobmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjEyODM5MSwiZXhwIjoyMDcxNzA0MzkxfQ.lC27GFNAA61dvCwPVBEK2ios7JHPcGE_qivrbVF4vnA';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function updateRoomPrices() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║     Room Prices Update from Excel              ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    try {
        // Read the exported JSON data
        const roomDataPath = path.join(__dirname, 'room_prices_data.json');
        
        if (!fs.existsSync(roomDataPath)) {
            throw new Error('room_prices_data.json not found. Run read_all_room_data.js first.');
        }

        const roomsData = JSON.parse(fs.readFileSync(roomDataPath, 'utf8'));
        
        console.log(`📊 Found ${roomsData.length} rooms in Excel data\n`);
        
        // First, check if block column exists
        console.log('🔍 Checking if block column exists...');
        const { data: existingRooms, error: checkError } = await supabase
            .from('rooms')
            .select('*')
            .limit(1);
        
        if (checkError) {
            console.log('⚠️  Warning:', checkError.message);
            console.log('\n📝 Please run add_block_column_to_rooms.sql first!');
            console.log('   Execute this in Supabase SQL Editor:\n');
            console.log('   ' + fs.readFileSync(path.join(__dirname, 'add_block_column_to_rooms.sql'), 'utf8').split('\n').join('\n   '));
            return;
        }
        
        console.log('✓ Database connection successful\n');
        
        // Get all existing rooms
        const { data: allRooms, error: fetchError } = await supabase
            .from('rooms')
            .select('*')
            .order('room_number', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        console.log(`📦 Found ${allRooms.length} rooms in database\n`);
        console.log('='.repeat(60));
        console.log('Updating Rooms...');
        console.log('='.repeat(60));
        
        let updateCount = 0;
        let createCount = 0;
        let skipCount = 0;
        let errors = [];
        
        for (const excelRoom of roomsData) {
            const roomNum = excelRoom.roomNumber.replace('R-', '');
            const roomNumber = parseInt(roomNum);
            const price = parseFloat(excelRoom.price);
            const block = excelRoom.block;
            
            // Find existing room
            const existingRoom = allRooms.find(r => 
                r.room_number === roomNumber || 
                r.room_number === `R-${roomNum}` ||
                r.room_number === excelRoom.roomNumber
            );
            
            process.stdout.write(`  ${excelRoom.roomNumber} (${block}) - GHS ${price}... `);
            
            if (existingRoom) {
                // Update existing room
                const { error: updateError } = await supabase
                    .from('rooms')
                    .update({
                        price: price,
                        block: block,
                        room_number: excelRoom.roomNumber
                    })
                    .eq('id', existingRoom.id);
                
                if (updateError) {
                    console.log(`✗ Error`);
                    errors.push({ room: excelRoom.roomNumber, error: updateError.message });
                } else {
                    console.log(`✓ Updated`);
                    updateCount++;
                }
            } else {
                // Create new room
                const { error: insertError } = await supabase
                    .from('rooms')
                    .insert([{
                        room_number: excelRoom.roomNumber,
                        type: 'Standard',
                        status: 'Available',
                        price: price,
                        capacity: 2,
                        amenities: ['WiFi', 'TV', 'Air Conditioning'],
                        block: block
                    }]);
                
                if (insertError) {
                    console.log(`✗ Error`);
                    errors.push({ room: excelRoom.roomNumber, error: insertError.message });
                } else {
                    console.log(`✓ Created`);
                    createCount++;
                }
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`✓ Rooms Updated: ${updateCount}`);
        console.log(`✓ Rooms Created: ${createCount}`);
        console.log(`✗ Errors: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('\n⚠️  Errors encountered:');
            errors.forEach(err => {
                console.log(`   - ${err.room}: ${err.error}`);
            });
        }
        
        // Show price distribution
        console.log('\n' + '='.repeat(60));
        console.log('PRICE DISTRIBUTION');
        console.log('='.repeat(60));
        
        const mainBlockRooms = roomsData.filter(r => r.block === 'Main Block');
        const aquarianBlockRooms = roomsData.filter(r => r.block === 'Aquarian Block');
        
        const mainPrices = [...new Set(mainBlockRooms.map(r => r.price))].sort((a, b) => b - a);
        const aquarianPrices = [...new Set(aquarianBlockRooms.map(r => r.price))].sort((a, b) => b - a);
        
        console.log('\nMain Block:');
        mainPrices.forEach(price => {
            const count = mainBlockRooms.filter(r => r.price === price).length;
            console.log(`  GHS ${price}: ${count} rooms`);
        });
        
        console.log('\nAquarian Block:');
        aquarianPrices.forEach(price => {
            const count = aquarianBlockRooms.filter(r => r.price === price).length;
            console.log(`  GHS ${price}: ${count} rooms`);
        });
        
        console.log('\n✨ Room prices update completed!\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

updateRoomPrices();
